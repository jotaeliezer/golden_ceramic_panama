import { useEffect, useState } from "react";
import { OrderWithItems } from "../../types";

const ORDER_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "canceled", label: "Canceled" },
] as const;

function statusChoices(status: string) {
  if (ORDER_STATUS_OPTIONS.some((option) => option.value === status)) {
    return ORDER_STATUS_OPTIONS;
  }
  return [...ORDER_STATUS_OPTIONS, { value: status, label: status }];
}

function OrderStatusField({
  status,
  onChange,
  className,
  fieldClassName = "",
}: {
  status: string;
  onChange: (status: string) => void;
  className: string;
  fieldClassName?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${fieldClassName}`}>
      {status === "paid" && (
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          Paid
        </span>
      )}
      <select
        value={status}
        onChange={(event) => onChange(event.target.value)}
        className={className}
      >
        {statusChoices(status).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = () => {
    fetch('/api/orders', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
    })
    .then(r => r.json())
    .then(data => {
      setOrders(data);
      setLoading(false);
    })
    .catch(console.error);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/orders/${id}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      },
      body: JSON.stringify({ status })
    });
    fetchOrders();
  };

  return (
    <div>
      <h1 className="text-3xl font-serif mb-8 text-charcoal">Order Management</h1>

      {loading ? (
        <p>Loading orders...</p>
      ) : orders.length === 0 ? (
        <p className="text-gray-500 dark:text-neutral-300">No orders found.</p>
      ) : (
        <>
        <div className="md:hidden space-y-3">
          {orders.map(order => (
            <article key={order.id} className="bg-white shadow rounded-lg p-4 space-y-3 dark:bg-neutral-900 dark:ring-1 dark:ring-white/10">
              <div>
                <p className="font-mono text-sm text-gray-900 break-all dark:text-neutral-100">{order.id}</p>
                <p className="text-xs text-gray-500 mt-1 break-words dark:text-neutral-300">{order.shipping_address}</p>
              </div>
              <p className="text-sm text-gray-900 break-all dark:text-neutral-100">{order.customer_email}</p>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-500 dark:text-neutral-300">{new Date(order.created_at).toLocaleDateString()}</span>
                <span className="font-semibold text-gray-900 dark:text-neutral-100">${order.total_amount.toFixed(2)}</span>
              </div>
              <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-neutral-300">
                Status
                <OrderStatusField
                  status={order.status}
                  onChange={(status) => updateStatus(order.id, status)}
                  fieldClassName="mt-1 w-full"
                  className="block min-w-0 flex-1 rounded-md border border-gray-300 text-sm text-gray-900 shadow-sm focus:border-gold focus:ring-gold dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100"
                />
              </label>
            </article>
          ))}
        </div>
        <div className="hidden md:block bg-white shadow overflow-x-auto sm:rounded-lg dark:bg-neutral-900 dark:ring-1 dark:ring-white/10">
          <table className="w-full divide-y divide-gray-200 dark:divide-neutral-700">
            <thead className="bg-gray-50 dark:bg-neutral-950">
              <tr>
                <th className="px-3 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-neutral-300">Order ID</th>
                <th className="px-3 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-neutral-300">Customer</th>
                <th className="px-3 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-neutral-300">Date</th>
                <th className="px-3 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-neutral-300">Total</th>
                <th className="px-3 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-neutral-300">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 dark:bg-neutral-900 dark:divide-neutral-700">
              {orders.map(order => (
                <tr key={order.id}>
                  <td className="px-3 py-4 sm:px-6 text-sm text-gray-900 align-top dark:text-neutral-100">
                    <div className="font-mono break-all">{order.id}</div>
                    <div className="text-xs text-gray-500 mt-1 break-words dark:text-neutral-300">{order.shipping_address}</div>
                  </td>
                  <td className="px-3 py-4 sm:px-6 text-sm text-gray-900 break-all align-top dark:text-neutral-100">{order.customer_email}</td>
                  <td className="px-3 py-4 sm:px-6 text-sm text-gray-500 align-top dark:text-neutral-300">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-4 sm:px-6 text-sm text-gray-900 font-semibold align-top dark:text-neutral-100">
                    ${order.total_amount.toFixed(2)}
                  </td>
                  <td className="px-3 py-4 sm:px-6 text-sm align-top">
                    <OrderStatusField
                      status={order.status}
                      onChange={(status) => updateStatus(order.id, status)}
                      className="max-w-full rounded-md border border-gray-300 text-sm text-gray-900 shadow-sm focus:border-gold focus:ring-gold dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
