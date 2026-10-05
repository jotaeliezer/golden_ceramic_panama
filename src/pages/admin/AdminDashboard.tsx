import { useEffect, useState } from "react";
import { OrderWithItems } from "../../types";

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
        <p className="text-gray-500">No orders found.</p>
      ) : (
        <>
        <div className="md:hidden space-y-3">
          {orders.map(order => (
            <article key={order.id} className="bg-white shadow rounded-lg p-4 space-y-3">
              <div>
                <p className="font-mono text-sm text-gray-900 break-all">{order.id}</p>
                <p className="text-xs text-gray-500 mt-1 break-words">{order.shipping_address}</p>
              </div>
              <p className="text-sm text-gray-900 break-all">{order.customer_email}</p>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-500">{new Date(order.created_at).toLocaleDateString()}</span>
                <span className="font-semibold text-gray-900">${order.total_amount.toFixed(2)}</span>
              </div>
              <label className="block text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
                <select
                  value={order.status}
                  onChange={(e) => updateStatus(order.id, e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md text-sm text-gray-900 shadow-sm focus:border-gold focus:ring-gold"
                >
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                </select>
              </label>
            </article>
          ))}
        </div>
        <div className="hidden md:block bg-white shadow overflow-x-auto sm:rounded-lg">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                <th className="px-3 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-3 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-3 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-3 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.map(order => (
                <tr key={order.id}>
                  <td className="px-3 py-4 sm:px-6 text-sm text-gray-900 align-top">
                    <div className="font-mono break-all">{order.id}</div>
                    <div className="text-xs text-gray-500 mt-1 break-words">{order.shipping_address}</div>
                  </td>
                  <td className="px-3 py-4 sm:px-6 text-sm text-gray-900 break-all align-top">{order.customer_email}</td>
                  <td className="px-3 py-4 sm:px-6 text-sm text-gray-500 align-top">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-4 sm:px-6 text-sm text-gray-900 font-semibold align-top">
                    ${order.total_amount.toFixed(2)}
                  </td>
                  <td className="px-3 py-4 sm:px-6 text-sm align-top">
                    <select
                      value={order.status}
                      onChange={(e) => updateStatus(order.id, e.target.value)}
                      className="max-w-full border-gray-300 rounded-md text-sm shadow-sm focus:border-gold focus:ring-gold"
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                    </select>
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
