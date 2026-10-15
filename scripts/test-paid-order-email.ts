/**
 * Checks for the paid-order admin email.
 * No database and no network. Resend is a stub passed as fetchImpl.
 *
 * Run from the repo root: npm run test:paid-email
 */
import {
  buildPaidOrderAdminEmail,
  deliverPaidOrderNotice,
  displayOrderNumber,
  resetPaidOrderEmailClaims,
  type PaidOrderNotice,
} from "../src/paid-order-notice.js";
import { sendResendEmail } from "../src/resend-email.js";

const API_KEY = "re_test_local_only";
const FROM = "Golden Ceramic Panama <orders@example.com>";
const ADMIN = "studio@example.com";

let failed = false;

function check(condition: boolean, message: string): void {
  if (condition) console.log(`ok   ${message}`);
  else {
    failed = true;
    console.error(`FAIL ${message}`);
  }
}

function baseNotice(overrides: Partial<PaidOrderNotice> = {}): PaidOrderNotice {
  return {
    id: "ord_1729000000000",
    orderNumber: null,
    customerName: "Ana Morales",
    total: 214,
    address: "Edificio Sol & Mar\nCalle 50\nCiudad de Panamá, Panamá",
    items: [
      { name: "Molde de columna estriada", quantity: 1, price: 128 },
      { name: "Molde de maceta art déco", quantity: 2, price: 43 },
    ],
    ...overrides,
  };
}

type Captured = { url: string; body: Record<string, unknown>; authorization: string | null };

function installEnv(): void {
  process.env.RESEND_API_KEY = API_KEY;
  process.env.EMAIL_FROM = FROM;
  process.env.ADMIN_NOTIFY_EMAIL = ADMIN;
}

function clearEnv(): void {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
  delete process.env.ADMIN_NOTIFY_EMAIL;
}

async function captureSend(notice: PaidOrderNotice, respond?: () => Promise<Response> | Response): Promise<Captured[]> {
  const calls: Captured[] = [];
  await deliverPaidOrderNotice(notice, async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    calls.push({ url, body, authorization: new Headers(init?.headers).get("authorization") });
    if (respond) return respond();
    return new Response(JSON.stringify({ id: "email_test" }), { status: 200 });
  });
  return calls;
}

async function main(): Promise<void> {
  const plain = buildPaidOrderAdminEmail(baseNotice());
  check(displayOrderNumber(baseNotice()) === "ord_1729000000000", "plain order id is the order number");
  check(plain.subject === "Payment received: ord_1729000000000", "subject uses the order id");
  check(plain.html.includes("Molde de columna estriada"), "html lists the item name");
  check(plain.html.includes(">$128.00<") || plain.html.includes(">$128.00"), "html shows the unit price");
  check(plain.html.includes("Total $214.00"), "html shows the order total");
  check(plain.text.includes("qty 2 · $43.00"), "text lists quantity and price");
  check(plain.html.includes("Edificio Sol &amp; Mar"), "address ampersand is escaped");
  check(plain.text.includes("Edificio Sol & Mar"), "text address keeps the ampersand");
  check(plain.html.includes("Delivery address"), "address section is present");

  const nicer = buildPaidOrderAdminEmail(baseNotice({ orderNumber: "GC-1042" }));
  check(nicer.subject.includes("GC-1042") && !nicer.subject.includes("ord_"), "stored display number replaces the id");
  check(displayOrderNumber({ id: "ord_1", orderNumber: "  GC-15  " }) === "GC-15", "display number is trimmed");

  const hostileName = `Ana <b>Morales</b> & Co`;
  const hostile = buildPaidOrderAdminEmail(
    baseNotice({
      customerName: hostileName,
      orderNumber: `"><script>alert(1)</script>`,
      address: `Apt <1>\nTown & Country`,
      items: [{ name: `</td><script>alert(1)</script>`, quantity: 1, price: 10 }],
    }),
  );
  check(!hostile.html.includes("<script") && !hostile.html.includes("<b>"), "customer html tags are not raw tags");
  check(hostile.html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), "script text is escaped");
  check(hostile.html.includes("Ana &lt;b&gt;Morales&lt;/b&gt; &amp; Co"), "customer name is escaped");
  check(hostile.html.includes("Apt &lt;1&gt;"), "address brackets are escaped");
  check(hostile.text.includes(hostileName), "text part is not html-escaped");

  const noAddress = buildPaidOrderAdminEmail(baseNotice({ address: "  ", customerName: "  " }));
  check(!noAddress.html.includes("Delivery address"), "blank address omits the address section");
  check(!noAddress.text.includes("Delivery address"), "blank address omits the address from text");
  check(noAddress.html.includes(">—<") || noAddress.html.includes(">&#8212;<") || noAddress.html.includes(">—</") || noAddress.html.includes("> —") || noAddress.html.includes(">—"), "missing customer name has a placeholder");
  check(noAddress.html.includes("Customer"), "customer label remains");

  const emptyItems = buildPaidOrderAdminEmail(baseNotice({ items: [] }));
  check(emptyItems.html.includes("No line items"), "missing items are explained");

  clearEnv();
  resetPaidOrderEmailClaims();
  const skipped = await captureSend(baseNotice());
  check(skipped.length === 0, "missing env sends nothing");

  process.env.RESEND_API_KEY = API_KEY;
  process.env.EMAIL_FROM = FROM;
  process.env.ADMIN_NOTIFY_EMAIL = "not-an-email";
  resetPaidOrderEmailClaims();
  const invalid = await captureSend(baseNotice());
  check(invalid.length === 0, "invalid admin address sends nothing");

  installEnv();
  resetPaidOrderEmailClaims();
  const first = await captureSend(baseNotice());
  const second = await captureSend(baseNotice());
  check(first.length === 1 && second.length === 0, "a second send for the same order is skipped");
  check(first[0]?.url === "https://api.resend.com/emails", "Resend endpoint matches the admin mailer");
  check(first[0]?.authorization === `Bearer ${API_KEY}`, "Resend is called with the env API key");
  check(first[0]?.body.from === FROM, "from address is EMAIL_FROM");
  check(Array.isArray(first[0]?.body.to) && (first[0]?.body.to as string[])[0] === ADMIN, "recipient is ADMIN_NOTIFY_EMAIL");
  check(first[0]?.body.subject === plain.subject, "sent subject matches the builder");
  check(typeof first[0]?.body.html === "string" && (first[0]?.body.html as string).includes("Sol &amp; Mar"), "sent html is escaped");
  check(!JSON.stringify(first[0]?.body).includes(API_KEY), "payload does not echo the API key");

  resetPaidOrderEmailClaims();
  let throws = 0;
  const failedSend = await deliverPaidOrderNotice(baseNotice(), async () => {
    throws += 1;
    throw new Error("network down");
  });
  const afterFailure = await captureSend(baseNotice());
  check(failedSend === "failed" && throws === 1 && afterFailure.length === 0, "a failed send is not retried");

  clearEnv();
  const adminShaped = await sendResendEmail({
    to: ADMIN,
    subject: "Hi",
    text: "Plain",
    fetchImpl: async () => new Response("{}", { status: 200 }),
  });
  check(adminShaped.ok === false, "shared sender refuses when Resend is not configured");

  installEnv();
  let adminBody: Record<string, unknown> | undefined;
  const adminSend = await sendResendEmail({
    to: ADMIN,
    subject: "Hi",
    text: "Plain",
    fetchImpl: async (_input, init) => {
      adminBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      return new Response("{}", { status: 200 });
    },
  });
  check(adminSend.ok === true && adminBody?.text === "Plain" && adminBody.html == null, "admin-shaped send stays text only");

  if (!process.env.DATABASE_URL?.trim()) {
    process.env.DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
  }
  const { noticeFromOrderRow, deliveryAddressFromOrder } = await import("../src/paid-order-email.js");

  const current = noticeFromOrderRow(
    {
      id: "ord_current",
      total_amount: 128,
      shipping_address: "Ana Morales\nCalle 50\nPanama City, Panama",
    },
    [{ name: "Molde de columna estriada", quantity: 1, price: 128 }],
  );
  check(current?.orderNumber == null && current?.id === "ord_current", "row without a display number keeps the id");
  check(current?.customerName === "Ana Morales", "customer name comes from the shipping address");
  check(current?.address?.includes("Calle 50") === true, "shipping address is the delivery address today");
  check(
    deliveryAddressFromOrder({ id: "x", shipping_address: "Calle 1" }) === "Calle 1",
    "a row with no address column uses shipping_address",
  );

  const future = noticeFromOrderRow(
    {
      id: "ord_future",
      order_number: 1042,
      customer_name: "Luis Gomez",
      address: { line1: "Apt 4", city: "Colón", country: "Panamá" },
      shipping_address: "Old blob that should not win",
      total_amount: "40",
    },
    [{ name: null, quantity: "2", price: "20" }],
  );
  check(future?.orderNumber === "1042", "numeric order_number is the display number");
  check(future?.customerName === "Luis Gomez", "customer_name wins over the shipping blob");
  check(future?.address === "Apt 4\nColón\nPanamá", "structured address is used when present");
  check(!future?.address?.includes("Old blob"), "shipping blob is not used when address is present");
  check(future?.items[0]?.name === "Item" && future.items[0]?.quantity === 2 && future.items[0]?.price === 20, "item numbers are coerced");

  const absent = noticeFromOrderRow(
    { id: "ord_absent", address: null, shipping_address: null, total_amount: 1 },
    [],
  );
  check(absent?.address == null && absent?.customerName == null, "absent address and name stay empty");
  const absentMail = buildPaidOrderAdminEmail(absent!);
  check(!absentMail.html.includes("Delivery address"), "absent address is left out of the email");

  const onlyShipping = deliveryAddressFromOrder({
    shipping_address: "Ana Morales\nVia España 10",
  });
  check(onlyShipping === "Ana Morales\nVia España 10", "a row with no address key still reads shipping_address");

  clearEnv();
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
