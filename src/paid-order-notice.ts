import { sendResendEmail } from "./resend-email.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Order ids we already tried to mail in this process. A new process relies on the paid-status claim. */
const claimedOrderIds = new Set<string>();

export function resetPaidOrderEmailClaims(): void {
  claimedOrderIds.clear();
}

export type PaidOrderItem = {
  name: string;
  quantity: number;
  price: number;
};

export type PaidOrderNotice = {
  id: string;
  /** Set when the order row stores a display number. Otherwise the email uses `id`. */
  orderNumber: string | null;
  customerName: string | null;
  total: number;
  /** Delivery address. Null when the order has none. */
  address: string | null;
  items: PaidOrderItem[];
};

export type PaidOrderEmailResult = "sent" | "skipped" | "failed" | "duplicate";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clip(value: string, max = 2000): string {
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function oneLine(value: string): string {
  return clip(value).replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

function money(value: number): string {
  const amount = Number.isFinite(value) ? value : 0;
  return `$${amount.toFixed(2)}`;
}

function quantityLabel(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return String(Math.trunc(value));
}

/** Prefer a stored display number. Otherwise the plain order id. */
export function displayOrderNumber(notice: Pick<PaidOrderNotice, "id" | "orderNumber">): string {
  const nicer = notice.orderNumber?.trim();
  if (nicer) return clip(nicer);
  return clip(notice.id);
}

function htmlText(value: string): string {
  return escapeHtml(clip(value)).replace(/\r\n|\r|\n/g, "<br>");
}

export function buildPaidOrderAdminEmail(notice: PaidOrderNotice): { subject: string; text: string; html: string } {
  const orderNumber = displayOrderNumber(notice);
  const customerName = notice.customerName?.trim() ? clip(notice.customerName) : "";
  const address = notice.address?.trim() ? clip(notice.address).replace(/\u0000/g, "") : "";
  const items = notice.items.map((item) => ({
    name: item.name?.trim() ? clip(item.name) : "Item",
    quantity: quantityLabel(item.quantity),
    price: money(item.price),
  }));
  const total = money(notice.total);
  const subject = oneLine(`Payment received: ${orderNumber}`).slice(0, 180) || "Payment received";

  const textLines = [
    "Payment received",
    "",
    `Order number: ${orderNumber}`,
    `Customer: ${customerName || "—"}`,
    "",
    "Items:",
    ...(items.length > 0
      ? items.map((item) => `- ${item.name} · qty ${item.quantity} · ${item.price}`)
      : ["- No line items were stored on this order."]),
    "",
    `Total: ${total}`,
  ];
  if (address) {
    textLines.push("", "Delivery address:", address);
  }

  const itemRows =
    items.length > 0
      ? items
          .map(
            (item) => `<tr>
              <td style="padding:10px 0;border-bottom:1px solid #E8E6D9;font-family:Georgia,serif;font-size:16px;color:#2D2D2D;">${htmlText(item.name)}</td>
              <td style="padding:10px 8px;border-bottom:1px solid #E8E6D9;text-align:right;font-family:Georgia,serif;font-size:16px;color:#4A4A4A;">${item.quantity}</td>
              <td style="padding:10px 0;border-bottom:1px solid #E8E6D9;text-align:right;font-family:Georgia,serif;font-size:16px;color:#2D2D2D;">${item.price}</td>
            </tr>`,
          )
          .join("")
      : `<tr><td colspan="3" style="padding:10px 0;font-family:Georgia,serif;font-size:16px;color:#4A4A4A;">No line items were stored on this order.</td></tr>`;

  const addressBlock = address
    ? `<p style="margin:28px 0 0;font-family:Georgia,serif;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#AA8638;">Delivery address</p>
       <p style="margin:8px 0 0;font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#2D2D2D;">${htmlText(address)}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F9F8F3;color:#2D2D2D;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9F8F3;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #E8E6D9;">
          <tr>
            <td style="padding:32px 32px 28px;">
              <p style="margin:0;font-family:Georgia,serif;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#AA8638;">Golden Ceramic Panama</p>
              <h1 style="margin:12px 0 0;font-family:Georgia,serif;font-weight:normal;font-size:32px;line-height:1.2;color:#2D2D2D;">Payment received</h1>
              <p style="margin:18px 0 0;font-family:Georgia,serif;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#AA8638;">Order number</p>
              <p style="margin:8px 0 0;font-family:Georgia,serif;font-size:22px;color:#2D2D2D;">${htmlText(orderNumber)}</p>
              <p style="margin:22px 0 0;font-family:Georgia,serif;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#AA8638;">Customer</p>
              <p style="margin:8px 0 0;font-family:Georgia,serif;font-size:18px;color:#2D2D2D;">${customerName ? htmlText(customerName) : "—"}</p>
              <p style="margin:28px 0 8px;font-family:Georgia,serif;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#AA8638;">Items</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <th align="left" style="padding:0 0 8px;border-bottom:1px solid #C9A24A;font-family:Georgia,serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#4A4A4A;font-weight:normal;">Name</th>
                  <th align="right" style="padding:0 8px 8px;border-bottom:1px solid #C9A24A;font-family:Georgia,serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#4A4A4A;font-weight:normal;">Qty</th>
                  <th align="right" style="padding:0 0 8px;border-bottom:1px solid #C9A24A;font-family:Georgia,serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#4A4A4A;font-weight:normal;">Price</th>
                </tr>
                ${itemRows}
              </table>
              <p style="margin:18px 0 0;text-align:right;font-family:Georgia,serif;font-size:18px;color:#2D2D2D;">Total ${total}</p>
              ${addressBlock}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text: textLines.join("\n"), html };
}

function notifyConfig(): { to: string } | null {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.EMAIL_FROM?.trim() ?? "";
  const to = process.env.ADMIN_NOTIFY_EMAIL?.trim() ?? "";
  if (!apiKey || !from || !to) {
    console.warn(
      "Admin payment email skipped. RESEND_API_KEY, EMAIL_FROM, or ADMIN_NOTIFY_EMAIL is not set.",
    );
    return null;
  }
  if (!EMAIL_PATTERN.test(to) || to.length > 320) {
    console.warn("Admin payment email skipped. ADMIN_NOTIFY_EMAIL is not a valid email address.");
    return null;
  }
  return { to };
}

/**
 * Send the paid-order notice at most once per order id in this process.
 * Missing env skips without claiming, so a later call in the same process can still send.
 * A failed send stays claimed: a duplicate webhook must not send a second email.
 */
export async function deliverPaidOrderNotice(
  notice: PaidOrderNotice,
  fetchImpl?: typeof fetch,
): Promise<PaidOrderEmailResult> {
  const id = notice.id.trim();
  if (!id) return "skipped";

  const config = notifyConfig();
  if (!config) return "skipped";

  if (claimedOrderIds.has(id)) {
    console.log("Admin payment email already handled for this order.");
    return "duplicate";
  }
  claimedOrderIds.add(id);

  try {
    const message = buildPaidOrderAdminEmail({ ...notice, id });
    const result = await sendResendEmail({
      to: config.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      fetchImpl,
    });
    if (!result.ok) {
      const status = result.status == null ? "none" : String(result.status);
      console.warn(`Admin payment email was not accepted. status=${status}`);
      return "failed";
    }
    console.log("Admin payment email sent.");
    return "sent";
  } catch {
    console.warn("Admin payment email failed.");
    return "failed";
  }
}
