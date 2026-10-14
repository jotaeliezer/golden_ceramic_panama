import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Mail } from "lucide-react";
import type { CustomerSummary, OrderWithItems } from "../../types";
import AdminEmailModal from "./AdminEmailModal";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  canceled: "Canceled",
};

function money(value: number): string {
  return `$${Number(value).toFixed(2)}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function display(value: string | null): string {
  return value?.trim() ? value : "Not on file";
}

export default function AdminCustomerDetail() {
  const { email: emailParam } = useParams();
  const email = emailParam ? decodeURIComponent(emailParam) : "";
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [compose, setCompose] = useState(false);

  useEffect(() => {
    if (!email) {
      setError("Customer not found.");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/admin/customers/${encodeURIComponent(email)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(typeof data.error === "string" ? data.error : "Could not load this customer.");
          setCustomer(null);
          setOrders([]);
          return;
        }
        setError("");
        setCustomer(data.customer ?? null);
        setOrders(Array.isArray(data.orders) ? data.orders : []);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Could not load this customer.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [email]);

  return (
    <div>
      <Link to="/admin/customers" className="text-sm text-gray-500 hover:text-charcoal">
        Back to customers
      </Link>

      {loading ? (
        <p className="mt-6">Loading customer...</p>
      ) : error || !customer ? (
        <p role="alert" className="mt-6 text-red-700">
          {error || "Customer not found."}
        </p>
      ) : (
        <>
          <div className="mt-4 mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-serif text-3xl text-charcoal">{display(customer.name)}</h1>
              <p className="mt-1 break-all text-sm text-gray-600">{customer.email}</p>
            </div>
            <button
              type="button"
              onClick={() => setCompose(true)}
              className="inline-flex items-center justify-center gap-2 rounded bg-charcoal px-4 py-2 text-sm font-semibold text-white hover:bg-charcoal-light"
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Send email
            </button>
          </div>

          {notice && (
            <p role="status" className="mb-4 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {notice}
            </p>
          )}

          <dl className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-white p-4 shadow">
              <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">Phone</dt>
              <dd className="mt-1 text-sm text-gray-900">{display(customer.phone)}</dd>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">Orders</dt>
              <dd className="mt-1 text-sm text-gray-900">{customer.orderCount}</dd>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">Total spent</dt>
              <dd className="mt-1 text-sm font-semibold text-gray-900">{money(customer.totalSpent)}</dd>
            </div>
            <div className="rounded-lg bg-white p-4 shadow">
              <dt className="text-xs font-medium uppercase tracking-wider text-gray-500">Last order</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(customer.lastOrderAt)}</dd>
            </div>
          </dl>

          <section className="mb-8 rounded-lg bg-white p-4 shadow">
            <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500">Shipping address</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-gray-800">{display(customer.shippingAddress)}</p>
          </section>

          <h2 className="mb-4 font-serif text-2xl text-charcoal">Orders</h2>
          {orders.length === 0 ? (
            <p className="text-gray-500">No orders for this customer.</p>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <article key={order.id} className="rounded-lg bg-white p-4 shadow">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-mono text-sm break-all text-gray-900">{order.id}</p>
                    <p className="text-sm font-semibold text-gray-900">{money(order.total_amount)}</p>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {formatDate(order.created_at)} · {STATUS_LABELS[order.status] ?? order.status}
                  </p>
                  {order.items?.length > 0 && (
                    <ul className="mt-3 space-y-1 text-sm text-gray-700">
                      {order.items.map((item) => (
                        <li key={item.id}>
                          {item.quantity} × {item.product_name || item.product_id} ({money(item.price)})
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          )}

          {compose && (
            <AdminEmailModal
              recipients={[customer]}
              onClose={() => setCompose(false)}
              onSent={({ sent }) => {
                setCompose(false);
                setNotice(`Sent ${sent} ${sent === 1 ? "email" : "emails"}.`);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
