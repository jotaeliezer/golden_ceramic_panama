import { contactFromShippingAddress } from "./customers.js";
import { sql } from "./db.js";
import { deliverPaidOrderNotice, type PaidOrderNotice } from "./paid-order-notice.js";

type ItemRow = {
  name: string | null;
  quantity: number | string;
  price: number | string;
};

function textField(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Read a delivery address from a string or from a loose object. Missing values stay null. */
function addressField(value: unknown): string | null {
  const direct = textField(value);
  if (direct) return direct;
  if (Array.isArray(value)) {
    const lines = value.map((entry) => textField(entry)).filter((line): line is string => Boolean(line));
    return lines.length ? lines.join("\n") : null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const keys = [
    "line1",
    "line2",
    "street",
    "address",
    "address1",
    "address2",
    "city",
    "state",
    "region",
    "postal_code",
    "postalCode",
    "zip",
    "country",
  ];
  const lines = keys.map((key) => textField(record[key])).filter((line): line is string => Boolean(line));
  return lines.length ? lines.join("\n") : null;
}

function rowRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return rowRecord(JSON.parse(value) as unknown);
    } catch {
      return null;
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return null;
}

/**
 * Delivery address for the notice.
 * A separate change may add `address` (or `delivery_address`). Those keys are
 * read only when present on the row. `shipping_address` is the address stored today.
 * An empty or missing value omits the address from the email.
 */
export function deliveryAddressFromOrder(row: Record<string, unknown>): string | null {
  if ("address" in row) {
    const dedicated = addressField(row.address);
    if (dedicated) return dedicated;
  }
  if ("delivery_address" in row) {
    const dedicated = addressField(row.delivery_address);
    if (dedicated) return dedicated;
  }
  return addressField(row.shipping_address);
}

function customerNameFromOrder(row: Record<string, unknown>, address: string | null): string | null {
  const explicit = textField(row.customer_name);
  if (explicit) return explicit;
  const fromShipping = contactFromShippingAddress(textField(row.shipping_address)).name;
  if (fromShipping) return fromShipping;
  return contactFromShippingAddress(address).name;
}

/** Build a notice from an order row. Optional columns may be absent. */
export function noticeFromOrderRow(row: Record<string, unknown>, items: ItemRow[]): PaidOrderNotice | null {
  const id = textField(row.id);
  if (!id) return null;
  const address = deliveryAddressFromOrder(row);
  return {
    id,
    orderNumber: textField(row.order_number) ?? textField(row.display_number),
    customerName: customerNameFromOrder(row, address),
    total: Number(row.total_amount),
    address,
    items: items.map((item) => ({
      name: item.name?.trim() || "Item",
      quantity: Number(item.quantity),
      price: Number(item.price),
    })),
  };
}

async function loadPaidOrderNotice(orderId: string): Promise<PaidOrderNotice | null> {
  // to_jsonb keeps this working when a later migration adds columns, and when it has not.
  const [found] = await sql<{ row: unknown }[]>`
    SELECT to_jsonb(orders) AS row
    FROM orders
    WHERE id = ${orderId}
  `;
  const row = rowRecord(found?.row);
  if (!row) return null;

  const items = await sql<ItemRow[]>`
    SELECT
      COALESCE(NULLIF(btrim(p.name), ''), NULLIF(btrim(oi.product_id), '')) AS name,
      oi.quantity,
      oi.price
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ${orderId}
    ORDER BY oi.id
  `;
  return noticeFromOrderRow(row, items);
}

/**
 * Mail the admin about one newly paid order.
 * Never throws: a mail failure must not fail the Stripe webhook.
 * Call this only after the pending → paid claim. A replay is not a new claim,
 * so a second webhook delivery does not send again.
 */
export async function notifyAdminOfPaidOrder(orderId: string): Promise<void> {
  const id = orderId.trim();
  if (!id) return;
  try {
    const notice = await loadPaidOrderNotice(id);
    if (!notice) {
      console.warn("Admin payment email skipped. The paid order was not found.");
      return;
    }
    await deliverPaidOrderNotice(notice);
  } catch {
    console.warn("Admin payment email failed.");
  }
}
