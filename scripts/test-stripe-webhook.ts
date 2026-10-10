/**
 * Local check for POST /api/stripe/webhook.
 *
 * Starts the Express server against a temporary sqlite file, places an order,
 * then posts a Stripe event signed with stripe.webhooks.generateTestHeaderString.
 * Stock must stay put at checkout, drop once when payment is paid, and stay
 * put when that same event is sent again. A bad signature must get 400.
 *
 * Run from the repo root: npx tsx scripts/test-stripe-webhook.ts
 */
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";

const WEBHOOK_SECRET = "whsec_test_local_webhook_secret";
const BASE = "http://127.0.0.1:3000";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const stripe = new Stripe("sk_test_local_webhook_test_key");

type OrderRow = {
  id: string;
  status: string;
  items: { product_id: string; quantity: number }[];
};

let failed = false;

function check(condition: boolean, message: string): void {
  if (condition) {
    console.log(`ok   ${message}`);
  } else {
    failed = true;
    console.error(`FAIL ${message}`);
  }
}

async function waitForServer(child: ChildProcess): Promise<string> {
  let logs = "";
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Server did not start.\n${logs}`));
    }, 20000);
    let settled = false;
    const onData = (chunk: Buffer) => {
      logs += chunk.toString();
      if (!settled && logs.includes("Server running")) {
        settled = true;
        clearTimeout(timer);
        resolve(logs);
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Server exited early (${code}).\n${logs}`));
    });
  });
}

async function getStock(productId: string): Promise<number> {
  const res = await fetch(`${BASE}/api/products/${productId}`);
  const product = (await res.json()) as { stock: number };
  return product.stock;
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@goldenceramic.com",
      password: "admin123",
    }),
  });
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new Error(`Admin login failed: ${res.status}`);
  return body.token;
}

async function getOrder(token: string, orderId: string): Promise<OrderRow | undefined> {
  const res = await fetch(`${BASE}/api/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const orders = (await res.json()) as OrderRow[];
  return orders.find((order) => order.id === orderId);
}

async function checkout(productId: string, quantity: number): Promise<{ status: number; orderId?: string; error?: string }> {
  const res = await fetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ id: productId, quantity }],
      customerEmail: "buyer@example.com",
      shippingAddress: "123 Test Street",
    }),
  });
  const body = (await res.json()) as { orderId?: string; error?: string; success?: boolean };
  return { status: res.status, orderId: body.orderId, error: body.error };
}

function signedEvent(payload: string, secret = WEBHOOK_SECRET): string {
  return stripe.webhooks.generateTestHeaderString({ payload, secret });
}

async function postWebhook(payload: string, header: string): Promise<{ status: number; body: { received?: boolean; error?: string } }> {
  const res = await fetch(`${BASE}/api/stripe/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": header,
    },
    body: payload,
  });
  const body = (await res.json()) as { received?: boolean; error?: string };
  return { status: res.status, body };
}

function eventPayload(options: {
  type: string;
  orderId: string;
  paymentStatus?: string;
  includeMetadata?: boolean;
  includeReference?: boolean;
}): string {
  const includeMetadata = options.includeMetadata !== false;
  const includeReference = options.includeReference !== false;
  return JSON.stringify({
    id: `evt_${options.type}_${options.orderId}_${options.paymentStatus ?? "none"}`,
    object: "event",
    api_version: "2026-04-22.dahlia",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: options.type,
    data: {
      object: {
        id: `cs_test_${options.orderId}`,
        object: "checkout.session",
        payment_status: options.paymentStatus ?? "unpaid",
        client_reference_id: includeReference ? options.orderId : null,
        metadata: includeMetadata ? { orderId: options.orderId } : {},
        payment_intent: `pi_test_${options.orderId}`,
        mode: "payment",
        status: options.type === "checkout.session.expired" ? "expired" : "complete",
      },
    },
  });
}

async function main(): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stripe-webhook-"));
  const tsxBin = path.join(ROOT, "node_modules", ".bin", "tsx");
  const child = spawn(tsxBin, [path.join(ROOT, "server.ts")], {
    cwd: tempDir,
    env: {
      ...process.env,
      NODE_ENV: "production",
      STRIPE_SECRET_KEY: "sk_test_local_webhook_test_key",
      STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
      STRIPE_ALLOW_LIVE: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let serverLogs = "";
  const followLogs = (chunk: Buffer) => {
    serverLogs += chunk.toString();
  };
  child.stdout?.on("data", followLogs);
  child.stderr?.on("data", followLogs);

  try {
    await waitForServer(child);
    const token = await login();

    const stockBefore = await getStock("p3");
    const placed = await checkout("p3", 2);
    const stockAfterCheckout = await getStock("p3");
    const pending = placed.orderId ? await getOrder(token, placed.orderId) : undefined;

    check(placed.status === 200 && !!placed.orderId, `checkout returned 200 and an order id (${placed.orderId ?? placed.error})`);
    check(pending?.status === "pending", `new order status is pending (got ${pending?.status})`);
    check(stockAfterCheckout === stockBefore, `stock unchanged after checkout (${stockBefore} -> ${stockAfterCheckout})`);

    const unpaidPayload = eventPayload({
      type: "checkout.session.completed",
      orderId: placed.orderId ?? "missing",
      paymentStatus: "unpaid",
    });
    const unpaid = await postWebhook(unpaidPayload, signedEvent(unpaidPayload));
    const stockAfterUnpaid = await getStock("p3");
    check(unpaid.status === 200 && unpaid.body.received === true, `unpaid checkout.session.completed returned 200 {received:true}`);
    check(stockAfterUnpaid === stockBefore, `stock unchanged when payment_status is unpaid (${stockAfterUnpaid})`);

    const paidPayload = eventPayload({
      type: "checkout.session.completed",
      orderId: placed.orderId ?? "missing",
      paymentStatus: "paid",
    });
    const paidHeader = signedEvent(paidPayload);
    const paid = await postWebhook(paidPayload, paidHeader);
    const stockAfterPaid = await getStock("p3");
    const paidOrder = placed.orderId ? await getOrder(token, placed.orderId) : undefined;
    check(paid.status === 200 && paid.body.received === true, `paid webhook returned 200 {received:true}`);
    check(paidOrder?.status === "paid", `order status is paid (got ${paidOrder?.status})`);
    check(stockAfterPaid === stockBefore - 2, `stock dropped once by the ordered quantity (${stockBefore} -> ${stockAfterPaid})`);

    const replay = await postWebhook(paidPayload, paidHeader);
    const stockAfterReplay = await getStock("p3");
    const replayOrder = placed.orderId ? await getOrder(token, placed.orderId) : undefined;
    check(replay.status === 200 && replay.body.received === true, `replayed webhook returned 200 {received:true}`);
    check(replayOrder?.status === "paid", `replay left the order paid`);
    check(stockAfterReplay === stockAfterPaid, `replay did not lower stock again (${stockAfterPaid} -> ${stockAfterReplay})`);

    const bad = await postWebhook(paidPayload, signedEvent(paidPayload, "whsec_wrong_secret"));
    const stockAfterBad = await getStock("p3");
    check(bad.status === 400, `bad signature returned ${bad.status} (expected 400)`);
    check(stockAfterBad === stockAfterPaid, `bad signature left stock unchanged (${stockAfterBad})`);

    await new Promise((resolve) => setTimeout(resolve, 5));
    const stockP1 = await getStock("p1");
    const expiring = await checkout("p1", 1);
    const expiredPayload = eventPayload({
      type: "checkout.session.expired",
      orderId: expiring.orderId ?? "missing",
    });
    const expired = await postWebhook(expiredPayload, signedEvent(expiredPayload));
    const expiredOrder = expiring.orderId ? await getOrder(token, expiring.orderId) : undefined;
    const stockP1After = await getStock("p1");
    check(expired.status === 200 && expired.body.received === true, `expired webhook returned 200 {received:true}`);
    check(expiredOrder?.status === "canceled", `expired session marked the order canceled (got ${expiredOrder?.status})`);
    check(stockP1After === stockP1, `expired session did not change stock (${stockP1} -> ${stockP1After})`);

    await new Promise((resolve) => setTimeout(resolve, 5));
    const stockP4 = await getStock("p4");
    const referenceOrder = await checkout("p4", 1);
    const referencePayload = eventPayload({
      type: "checkout.session.completed",
      orderId: referenceOrder.orderId ?? "missing",
      paymentStatus: "paid",
      includeMetadata: false,
      includeReference: true,
    });
    const reference = await postWebhook(referencePayload, signedEvent(referencePayload));
    const referenceRow = referenceOrder.orderId ? await getOrder(token, referenceOrder.orderId) : undefined;
    const stockP4After = await getStock("p4");
    check(reference.status === 200, `client_reference_id webhook returned 200`);
    check(referenceRow?.status === "paid", `order found from client_reference_id was marked paid`);
    check(stockP4After === stockP4 - 1, `client_reference_id event lowered stock once (${stockP4} -> ${stockP4After})`);

    const stockP2 = await getStock("p2");
    const rejected = await checkout("p2", stockP2 + 5);
    const stockP2After = await getStock("p2");
    check(rejected.status === 400, `checkout over available stock returned ${rejected.status} (expected 400)`);
    check(stockP2After === stockP2, `rejected checkout left stock unchanged (${stockP2} -> ${stockP2After})`);

    console.log("");
    console.log("Summary");
    console.log(`  checkout: stock ${stockBefore} -> ${stockAfterCheckout}, status ${pending?.status}`);
    console.log(`  paid webhook: stock ${stockAfterCheckout} -> ${stockAfterPaid}, status ${paidOrder?.status}, http ${paid.status}`);
    console.log(`  replay: stock ${stockAfterPaid} -> ${stockAfterReplay}, http ${replay.status}`);
    console.log(`  bad signature: http ${bad.status}, stock ${stockAfterBad}`);
    if (failed) {
      console.error("\nServer log:\n" + serverLogs);
      process.exitCode = 1;
    }
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve(undefined);
      }, 2000);
      child.on("exit", () => {
        clearTimeout(timer);
        resolve(undefined);
      });
    });
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
