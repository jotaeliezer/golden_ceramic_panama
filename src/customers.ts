import { sql } from "./db.js";
import type { CustomerSummary, OrderWithItems } from "./types.js";

export type { CustomerSummary };

export type CustomerSort =
  | "email"
  | "name"
  | "phone"
  | "orderCount"
  | "totalSpent"
  | "lastOrderAt";

const SORTS = new Set<CustomerSort>([
  "email",
  "name",
  "phone",
  "orderCount",
  "totalSpent",
  "lastOrderAt",
]);

type RawCustomer = {
  email: string;
  shipping_address: string | null;
  order_count: number;
  total_spent: number | string;
  last_order_at: Date | string;
};

const PHONE_LABEL = /^(?:phone|tel|telephone|mobile|cell|whatsapp)\s*[:.-]?\s*/i;

/**
 * Checkout stores the customer name as the first line of shipping_address.
 * A phone is not its own column. When a line is only a phone number (or a
 * short label plus a number), surface it. Otherwise leave phone empty.
 */
export function contactFromShippingAddress(address: string | null | undefined): {
  name: string | null;
  phone: string | null;
} {
  const trimmed = address?.trim() ?? "";
  if (!trimmed) return { name: null, phone: null };

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let phone: string | null = null;
  let phoneIndex = -1;

  for (let index = 0; index < lines.length; index++) {
    const extracted = phoneFromLine(lines[index]);
    if (extracted) {
      phone = extracted;
      phoneIndex = index;
      break;
    }
  }

  if (lines.length < 2) return { name: null, phone };

  const nameLine = lines.find((_, index) => index !== phoneIndex);
  return { name: nameLine ?? null, phone };
}

function phoneFromLine(line: string): string | null {
  const withoutLabel = line.replace(PHONE_LABEL, "").trim();
  if (!withoutLabel || /[A-Za-z]/.test(withoutLabel)) return null;
  const compact = withoutLabel.replace(/[\s().-]/g, "");
  if (!/^\+?\d{7,15}$/.test(compact)) return null;
  return withoutLabel;
}

function iso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

function compareCustomers(sort: CustomerSort, dir: "asc" | "desc") {
  const factor = dir === "asc" ? 1 : -1;
  return (a: CustomerSummary, b: CustomerSummary) => {
    const left = a[sort];
    const right = b[sort];
    if (left == null && right == null) return a.email.localeCompare(b.email);
    if (left == null) return 1;
    if (right == null) return -1;
    if (typeof left === "number" && typeof right === "number") {
      if (left !== right) return (left - right) * factor;
    } else {
      const diff = String(left).localeCompare(String(right), "en", { sensitivity: "base", numeric: true });
      if (diff !== 0) return diff * factor;
    }
    return a.email.localeCompare(b.email);
  };
}

export async function listCustomers(options: {
  q?: string;
  sort?: string;
  dir?: string;
  email?: string;
} = {}): Promise<CustomerSummary[]> {
  const emailKey = options.email?.trim().toLowerCase() ?? "";
  const rows = await sql<RawCustomer[]>`
    WITH normalized AS (
      SELECT
        lower(btrim(customer_email)) AS email_key,
        btrim(customer_email) AS email,
        shipping_address,
        total_amount,
        status,
        created_at,
        id
      FROM orders
      WHERE nullif(btrim(customer_email), '') IS NOT NULL
      ${emailKey ? sql`AND lower(btrim(customer_email)) = ${emailKey}` : sql``}
    ),
    latest AS (
      SELECT DISTINCT ON (email_key)
        email_key,
        email,
        shipping_address
      FROM normalized
      ORDER BY email_key, created_at DESC, id DESC
    ),
    totals AS (
      SELECT
        email_key,
        count(*)::int AS order_count,
        coalesce(
          sum(total_amount) FILTER (WHERE status NOT IN ('pending', 'canceled')),
          0
        )::float8 AS total_spent,
        max(created_at) AS last_order_at
      FROM normalized
      GROUP BY email_key
    )
    SELECT
      latest.email,
      latest.shipping_address,
      totals.order_count,
      totals.total_spent,
      totals.last_order_at
    FROM totals
    JOIN latest USING (email_key)
  `;

  let customers: CustomerSummary[] = rows.map((row) => {
    const shippingAddress = row.shipping_address?.trim() ? row.shipping_address : null;
    const contact = contactFromShippingAddress(shippingAddress);
    return {
      email: row.email,
      name: contact.name,
      phone: contact.phone,
      shippingAddress,
      orderCount: Number(row.order_count),
      totalSpent: Number(row.total_spent),
      lastOrderAt: iso(row.last_order_at),
    };
  });

  const needle = options.q?.trim().toLowerCase() ?? "";
  if (needle) {
    customers = customers.filter((customer) =>
      [customer.email, customer.name, customer.phone, customer.shippingAddress].some((value) =>
        (value ?? "").toLowerCase().includes(needle),
      ),
    );
  }

  const sort: CustomerSort = SORTS.has(options.sort as CustomerSort)
    ? (options.sort as CustomerSort)
    : "lastOrderAt";
  const dir = options.dir === "asc" ? "asc" : "desc";
  customers.sort(compareCustomers(sort, dir));
  return customers;
}

export async function getCustomer(email: string): Promise<{
  customer: CustomerSummary;
  orders: OrderWithItems[];
} | null> {
  const [customer] = await listCustomers({ email });
  if (!customer) return null;

  const orders = await sql`
    SELECT *
    FROM orders
    WHERE lower(btrim(customer_email)) = ${customer.email.trim().toLowerCase()}
    ORDER BY created_at DESC, id DESC
  `;

  const ordersWithItems = [];
  for (const order of orders) {
    const items = await sql`
      SELECT oi.*, p.name AS product_name
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ${order.id}
      ORDER BY oi.id
    `;
    ordersWithItems.push({
      ...order,
      total_amount: Number(order.total_amount),
      created_at: iso(order.created_at as Date | string),
      items,
    });
  }

  return { customer, orders: ordersWithItems };
}
