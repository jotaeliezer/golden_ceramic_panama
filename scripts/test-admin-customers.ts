/**
 * Local check for the admin customers list and Resend email.
 *
 * Creates a throwaway database on local Postgres, seeds orders, and calls the
 * admin API. Resend is stubbed: requests to https://api.resend.com never leave
 * this process.
 *
 * Local Postgres default (override with CUSTOMERS_TEST_ADMIN_URL):
 *   postgresql://postgres:postgres@127.0.0.1:5432/postgres
 *
 * Run from the repo root: npm run test:customers
 */
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import bcrypt from "bcryptjs";
import postgres from "postgres";
import type { CustomerSummary, OrderWithItems } from "../src/types.js";

const ADMIN_URL =
  process.env.CUSTOMERS_TEST_ADMIN_URL || "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "customers-test-password";
const API_KEY = "re_test_local_only";
const FROM = "Golden Ceramic Panama <orders@example.com>";
const SUBJECT = "Kiln notice 8841";
const BODY = "The plaster mold you asked about is cooled and ready for pickup.";

type ResendCall = {
  to: string[];
  subject: string;
  text: string;
  from: string;
  cc?: unknown;
  bcc?: unknown;
  authorization: string | null;
};

let failed = false;
const resendCalls: ResendCall[] = [];
const logs: string[] = [];
let failAddresses = new Set<string>();
const originalFetch = globalThis.fetch;
const originalLog = console.log;

function check(condition: boolean, message: string): void {
  if (condition) console.log(`ok   ${message}`);
  else {
    failed = true;
    console.error(`FAIL ${message}`);
  }
}

function databaseUrlFor(name: string): string {
  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  return url.toString();
}

async function createTestDatabase(name: string): Promise<void> {
  const admin = postgres(ADMIN_URL, { ssl: false, max: 1, prepare: false });
  try {
    await admin.unsafe(`CREATE DATABASE ${name}`);
  } finally {
    await admin.end({ timeout: 5 });
  }
}

async function dropTestDatabase(name: string): Promise<void> {
  const admin = postgres(ADMIN_URL, { ssl: false, max: 1, prepare: false });
  try {
    await admin.unsafe(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '${name}' AND pid <> pg_backend_pid()
    `);
    await admin.unsafe(`DROP DATABASE IF EXISTS ${name}`);
  } finally {
    await admin.end({ timeout: 5 });
  }
}

function installResendStub(): void {
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith("https://api.resend.com/")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as ResendCall;
      const authorization = new Headers(init?.headers).get("authorization");
      resendCalls.push({ ...body, authorization });
      const recipient = Array.isArray(body.to) ? body.to[0] : "";
      if (failAddresses.has(recipient)) {
        return new Response(JSON.stringify({ message: "stub failure" }), { status: 500 });
      }
      return new Response(JSON.stringify({ id: "email_test" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(input, init);
  };
}

function installLogCapture(): void {
  console.log = (...args: unknown[]) => {
    logs.push(args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "));
    originalLog(...args);
  };
}

async function api(
  base: string,
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, data };
}

async function main(): Promise<void> {
  const dbName = `gcp_customers_${Date.now()}`;
  if (!/^[a-z0-9_]+$/.test(dbName)) throw new Error("Unsafe database name");

  let server: Server | undefined;
  let closeDatabase: (() => Promise<void>) | undefined;

  try {
    await createTestDatabase(dbName);
    process.env.DATABASE_URL = databaseUrlFor(dbName);
    process.env.JWT_SECRET = "customers-test-jwt-secret";
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.VERCEL;

    const dbModule = await import("../src/db.js");
    const { contactFromShippingAddress } = await import("../src/customers.js");
    const { resetAdminEmailRateLimit } = await import("../src/admin-email.js");
    const { createApp } = await import("../src/api-app.js");
    closeDatabase = dbModule.closeDatabase;

    const blank = contactFromShippingAddress("123 Test Street");
    check(blank.name === null && blank.phone === null, "a one-line street is not a name or phone");
    const named = contactFromShippingAddress("Ana Morales\nCalle 50\nPanama City, Panama");
    check(named.name === "Ana Morales" && named.phone === null, "the first address line is the name");
    const withPhone = contactFromShippingAddress("Ana Morales\n+507 6000-1111\nCalle 50");
    check(withPhone.name === "Ana Morales" && withPhone.phone === "+507 6000-1111", "a phone line is extracted");
    const labeled = contactFromShippingAddress("María Ortega\nPhone: +507 6111-2222\nCasco Viejo");
    check(labeled.phone === "+507 6111-2222", "a phone label is stripped");

    await dbModule.bootstrapLocalSchema();
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 4);
    await dbModule.sql`
      INSERT INTO admin_users (id, email, password)
      VALUES (${"admin_test"}, ${ADMIN_EMAIL}, ${hash})
    `;
    await dbModule.sql`
      INSERT INTO products (id, name, description, price, "imageUrl", category, stock)
      VALUES
        (${"mold-columna"}, ${"Molde de columna estriada"}, ${"Test"}, ${128}, ${"/molds/columna.svg"}, ${"Columnas"}, ${8}),
        (${"mold-maceta"}, ${"Molde de maceta art déco"}, ${"Test"}, ${96}, ${"/molds/maceta.svg"}, ${"Macetas"}, ${5}),
        (${"mold-pedestal"}, ${"Molde de pedestal barroco"}, ${"Test"}, ${215}, ${"/molds/pedestal.svg"}, ${"Pedestales"}, ${4})
    `;
    await dbModule.sql`
      INSERT INTO orders (id, customer_email, total_amount, status, shipping_address, created_at)
      VALUES
        (
          ${"ord_ana_old"},
          ${"Ana.Morales@example.com"},
          ${100},
          ${"canceled"},
          ${"Ana Morales\nOld street\nPanama City, Panama"},
          ${new Date("2025-12-01T15:00:00Z")}
        ),
        (
          ${"ord_ana_1"},
          ${"Ana.Morales@example.com"},
          ${128},
          ${"paid"},
          ${"Ana Morales\n+507 6000-1111\nCalle 50\nPanama City, Panama"},
          ${new Date("2026-01-10T15:00:00Z")}
        ),
        (
          ${"ord_ana_2"},
          ${"ana.morales@example.com"},
          ${96},
          ${"shipped"},
          ${"Ana Morales\n+507 6000-1111\nVia España 10\nPanama City, Panama"},
          ${new Date("2026-03-02T15:00:00Z")}
        ),
        (
          ${"ord_luis"},
          ${"luis.chen@example.com"},
          ${18},
          ${"pending"},
          ${"Luis Chen\nAvenida Balboa\nPanama City, Panama"},
          ${new Date("2026-02-01T15:00:00Z")}
        ),
        (
          ${"ord_maria"},
          ${"maria.ortega@example.com"},
          ${215},
          ${"delivered"},
          ${"María Ortega\nPhone: +507 6111-2222\nCasco Viejo\nPanama City, Panama"},
          ${new Date("2026-04-04T15:00:00Z")}
        ),
        (
          ${"ord_street"},
          ${"street.only@example.com"},
          ${40},
          ${"paid"},
          ${"123 Test Street"},
          ${new Date("2026-04-01T15:00:00Z")}
        )
    `;
    await dbModule.sql`
      INSERT INTO order_items (id, order_id, product_id, quantity, price)
      VALUES
        (${"item_ana_2"}, ${"ord_ana_2"}, ${"mold-maceta"}, ${1}, ${96}),
        (${"item_ana_1"}, ${"ord_ana_1"}, ${"mold-columna"}, ${1}, ${128}),
        (${"item_maria"}, ${"ord_maria"}, ${"mold-pedestal"}, ${1}, ${215})
    `;

    const app = createApp();
    server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
    });
    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}`;
    installResendStub();
    installLogCapture();

    const login = await api(base, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    const token = String(login.data.token ?? "");
    check(login.status === 200 && token.length > 0, "admin login returns a token");

    const unauthenticated = await api(base, "/api/admin/customers");
    check(unauthenticated.status === 401, "customers list requires admin auth");

    const listed = await api(base, "/api/admin/customers?sort=lastOrderAt&dir=desc", {}, token);
    const customers = (listed.data.customers ?? []) as CustomerSummary[];
    check(listed.status === 200 && customers.length === 4, "four customers are grouped by email");

    const ana = customers.find((customer) => customer.email.toLowerCase() === "ana.morales@example.com");
    const luis = customers.find((customer) => customer.email === "luis.chen@example.com");
    const maria = customers.find((customer) => customer.email === "maria.ortega@example.com");
    const street = customers.find((customer) => customer.email === "street.only@example.com");
    check(Boolean(ana && luis && maria && street), "each seeded email is present once");
    check(ana?.email === "ana.morales@example.com", "grouped email uses the latest casing");
    check(ana?.name === "Ana Morales", "name comes from the latest shipping address");
    check(ana?.phone === "+507 6000-1111", "phone comes from the latest shipping address");
    check(ana?.shippingAddress?.includes("Via España 10") === true, "shipping address is the latest order");
    check(ana?.orderCount === 3, "order count includes every order");
    check(Math.abs((ana?.totalSpent ?? 0) - 224) < 0.001, "total spent skips pending and canceled orders");
    check(luis?.phone === null && luis?.totalSpent === 0, "a pending order stores no phone and no spend");
    check(street?.name === null && street?.phone === null, "a one-line address leaves name and phone empty");
    check(customers[0]?.email === "maria.ortega@example.com", "default sort is last order, newest first");

    const search = await api(base, "/api/admin/customers?q=6000-1111", {}, token);
    const searchRows = (search.data.customers ?? []) as CustomerSummary[];
    check(searchRows.length === 1 && searchRows[0]?.email === "ana.morales@example.com", "search matches a stored phone");

    const nameSearch = await api(base, "/api/admin/customers?q=chen", {}, token);
    const nameRows = (nameSearch.data.customers ?? []) as CustomerSummary[];
    check(nameRows.length === 1 && nameRows[0]?.name === "Luis Chen", "search matches a stored name");

    const bySpend = await api(base, "/api/admin/customers?sort=totalSpent&dir=desc", {}, token);
    const spendRows = (bySpend.data.customers ?? []) as CustomerSummary[];
    check(spendRows[0]?.email === "ana.morales@example.com", "sort by total spent");

    const detail = await api(
      base,
      `/api/admin/customers/${encodeURIComponent("Ana.Morales@example.com")}`,
      {},
      token,
    );
    const detailOrders = (detail.data.orders ?? []) as OrderWithItems[];
    const detailCustomer = detail.data.customer as CustomerSummary | undefined;
    check(detail.status === 200 && detailCustomer?.orderCount === 3, "detail lookup is case-insensitive");
    check(detailOrders.map((order) => order.id).join(",") === "ord_ana_2,ord_ana_1,ord_ana_old", "detail lists orders newest first");
    check(detailOrders[0]?.items?.[0]?.product_name === "Molde de maceta art déco", "detail includes order items");

    const missing = await api(base, "/api/admin/customers/nobody@example.com", {}, token);
    check(missing.status === 404, "unknown customer is 404");

    const emailBody = { to: ["ana.morales@example.com"], subject: SUBJECT, message: BODY };
    const noKey = await api(base, "/api/admin/email", { method: "POST", body: JSON.stringify(emailBody) }, token);
    check(noKey.status === 503 && noKey.data.error === "email not configured", "missing Resend key returns 503");
    check(resendCalls.length === 0, "missing Resend key sends nothing");

    process.env.RESEND_API_KEY = API_KEY;
    const noFrom = await api(base, "/api/admin/email", { method: "POST", body: JSON.stringify(emailBody) }, token);
    check(noFrom.status === 503 && noFrom.data.error === "email not configured", "missing From address returns 503");
    check(resendCalls.length === 0, "missing From address sends nothing");

    process.env.EMAIL_FROM = FROM;
    const noToken = await api(base, "/api/admin/email", { method: "POST", body: JSON.stringify(emailBody) });
    check(noToken.status === 401 && resendCalls.length === 0, "email endpoint requires admin auth");

    const tooMany = Array.from({ length: 51 }, (_, index) => `person${index}@example.com`);
    const capped = await api(
      base,
      "/api/admin/email",
      { method: "POST", body: JSON.stringify({ to: tooMany, subject: SUBJECT, message: BODY }) },
      token,
    );
    check(capped.status === 400 && resendCalls.length === 0, "more than 50 recipients is rejected");

    const stranger = await api(
      base,
      "/api/admin/email",
      {
        method: "POST",
        body: JSON.stringify({ to: ["stranger@example.com"], subject: SUBJECT, message: BODY }),
      },
      token,
    );
    check(stranger.status === 400 && resendCalls.length === 0, "addresses that are not customers are rejected");

    resetAdminEmailRateLimit();
    const deduped = await api(
      base,
      "/api/admin/email",
      {
        method: "POST",
        body: JSON.stringify({
          to: ["ana.morales@example.com", "Ana.Morales@example.com"],
          subject: SUBJECT,
          message: BODY,
        }),
      },
      token,
    );
    check(deduped.status === 200 && deduped.data.sent === 1, "duplicate addresses count once");
    check(resendCalls.length === 1 && resendCalls[0]?.to.length === 1, "one recipient produces one Resend call");
    check(!JSON.stringify(deduped.data).includes(BODY), "the response does not echo the message");

    resetAdminEmailRateLimit();
    resendCalls.length = 0;
    failAddresses = new Set(["maria.ortega@example.com"]);
    const partial = await api(
      base,
      "/api/admin/email",
      {
        method: "POST",
        body: JSON.stringify({
          to: ["ana.morales@example.com", "maria.ortega@example.com"],
          subject: SUBJECT,
          message: BODY,
        }),
      },
      token,
    );
    check(partial.status === 200 && partial.data.sent === 1 && partial.data.failed === 1, "one failed send does not cancel the other");
    check(resendCalls.length === 2 && resendCalls.every((call) => call.to.length === 1), "a partial bulk send is still one call per person");
    failAddresses = new Set();

    resetAdminEmailRateLimit();
    resendCalls.length = 0;
    const bulk = await api(
      base,
      "/api/admin/email",
      {
        method: "POST",
        body: JSON.stringify({
          to: ["ana.morales@example.com", "maria.ortega@example.com"],
          subject: SUBJECT,
          message: BODY,
        }),
      },
      token,
    );
    check(bulk.status === 200 && bulk.data.sent === 2 && bulk.data.failed === 0, "bulk send reports two successes");
    check(
      resendCalls.length === 2 &&
        resendCalls.every((call) => call.to.length === 1 && call.cc == null && call.bcc == null) &&
        new Set(resendCalls.map((call) => call.to[0]?.toLowerCase())).size === 2,
      "bulk send is two individual emails with no shared recipients",
    );
    check(
      resendCalls.every((call) => call.subject === SUBJECT && call.text === BODY && call.from === FROM),
      "Resend receives the subject, text, and from address",
    );
    check(resendCalls.every((call) => call.authorization === `Bearer ${API_KEY}`), "Resend is called with the env API key");

    const emailLogs = logs.filter((line) => line.startsWith("Admin email send finished"));
    check(emailLogs.length >= 1 && emailLogs.every((line) => /requested=\d+ sent=\d+ failed=\d+/.test(line)), "logs include send counts");
    check(
      emailLogs.every((line) => !line.includes("@") && !line.includes(SUBJECT) && !line.includes(BODY) && !line.includes(API_KEY)),
      "logs omit addresses, subject, message, and the API key",
    );

    resetAdminEmailRateLimit();
    resendCalls.length = 0;
    for (let index = 0; index < 50; index += 1) {
      await dbModule.sql`
        INSERT INTO orders (id, customer_email, total_amount, status, shipping_address)
        VALUES (
          ${`ord_rate_${index}`},
          ${`rate${index}@example.com`},
          ${10},
          ${"paid"},
          ${`Rate User ${index}\nCalle ${index}`}
        )
      `;
    }
    const many = Array.from({ length: 50 }, (_, index) => `rate${index}@example.com`);
    const burst = await api(
      base,
      "/api/admin/email",
      { method: "POST", body: JSON.stringify({ to: many, subject: SUBJECT, message: BODY }) },
      token,
    );
    check(burst.status === 200 && burst.data.sent === 50 && resendCalls.length === 50, "a 50-recipient send is allowed");
    check(resendCalls.every((call) => call.to.length === 1), "the 50-recipient send is still one email each");

    const limited = await api(
      base,
      "/api/admin/email",
      {
        method: "POST",
        body: JSON.stringify({ to: ["ana.morales@example.com"], subject: SUBJECT, message: BODY }),
      },
      token,
    );
    check(limited.status === 429 && resendCalls.length === 50, "the next email is rate limited and not sent");
  } finally {
    console.log = originalLog;
    globalThis.fetch = originalFetch;
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((err) => (err ? reject(err) : resolve()));
      });
    }
    if (closeDatabase) await closeDatabase();
    await dropTestDatabase(dbName);
  }

  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
