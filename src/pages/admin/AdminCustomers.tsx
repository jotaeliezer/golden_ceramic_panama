import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import type { CustomerSummary } from "../../types";
import AdminEmailModal from "./AdminEmailModal";

type SortKey = "email" | "name" | "orderCount" | "totalSpent" | "lastOrderAt";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "lastOrderAt", label: "Last order" },
  { value: "totalSpent", label: "Total spent" },
  { value: "orderCount", label: "Orders" },
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
];

function money(value: number): string {
  return `$${Number(value).toFixed(2)}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function display(value: string | null): string {
  return value?.trim() ? value : "Not on file";
}

export default function AdminCustomers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("lastOrderAt");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [compose, setCompose] = useState<CustomerSummary[] | null>(null);
  const mobileSelectAllRef = useRef<HTMLInputElement>(null);
  const desktopSelectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ q, sort, dir });
    setLoading(true);
    fetch(`/api/admin/customers?${params}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(typeof data.error === "string" ? data.error : "Could not load customers.");
          setCustomers([]);
          return;
        }
        setError("");
        setCustomers(Array.isArray(data.customers) ? data.customers : []);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Could not load customers.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [q, sort, dir]);

  useEffect(() => {
    setSelected((current) => {
      const visible = new Set(customers.map((customer) => customer.email));
      const next = new Set([...current].filter((email) => visible.has(email)));
      return next.size === current.size ? current : next;
    });
  }, [customers]);

  const allSelected = customers.length > 0 && customers.every((customer) => selected.has(customer.email));
  const someSelected = customers.some((customer) => selected.has(customer.email));

  useEffect(() => {
    const indeterminate = someSelected && !allSelected;
    if (mobileSelectAllRef.current) mobileSelectAllRef.current.indeterminate = indeterminate;
    if (desktopSelectAllRef.current) desktopSelectAllRef.current.indeterminate = indeterminate;
  }, [someSelected, allSelected]);

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(customers.map((customer) => customer.email)));
  };

  const toggleOne = (email: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const toggleSort = (next: SortKey) => {
    if (sort === next) {
      setDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSort(next);
    setDir(next === "name" || next === "email" ? "asc" : "desc");
  };

  const openCustomer = (email: string) => {
    navigate(`/admin/customers/${encodeURIComponent(email)}`);
  };

  const selectedCustomers = customers.filter((customer) => selected.has(customer.email));

  const sortMark = (key: SortKey) => (sort === key ? (dir === "asc" ? " ↑" : " ↓") : "");

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl text-charcoal">Customers</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-neutral-300">
            Grouped from orders by email. Name and phone appear when they are stored on the latest shipping address.
          </p>
        </div>
        <button
          type="button"
          disabled={selectedCustomers.length === 0}
          onClick={() => setCompose(selectedCustomers)}
          className="inline-flex items-center justify-center gap-2 rounded bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink-light disabled:opacity-50 dark:ring-1 dark:ring-white/40"
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          Send email{selectedCustomers.length > 0 ? ` (${selectedCustomers.length})` : ""}
        </button>
      </div>

      {notice && (
        <p role="status" className="mb-4 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="block flex-1 text-sm font-medium text-gray-700 dark:text-neutral-200">
          Search
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Email, name, phone, or address"
            className="mt-1 w-full rounded border border-gray-300 p-2 text-sm shadow-sm focus:border-gold focus:ring-gold dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700 dark:text-neutral-200 md:hidden">
          Sort
          <select
            value={`${sort}:${dir}`}
            onChange={(event) => {
              const [nextSort, nextDir] = event.target.value.split(":");
              setSort(nextSort as SortKey);
              setDir(nextDir === "asc" ? "asc" : "desc");
            }}
            className="mt-1 w-full rounded border border-gray-300 p-2 text-sm shadow-sm focus:border-gold focus:ring-gold dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100"
          >
            {SORT_OPTIONS.flatMap((option) => [
              <option key={`${option.value}:desc`} value={`${option.value}:desc`}>
                {option.label} (high / newest)
              </option>,
              <option key={`${option.value}:asc`} value={`${option.value}:asc`}>
                {option.label} (low / oldest)
              </option>,
            ])}
          </select>
        </label>
      </div>

      {loading ? (
        <p>Loading customers...</p>
      ) : customers.length === 0 ? (
        <p className="text-gray-500 dark:text-neutral-300">
          {q.trim() ? "No customers match that search." : "No customers yet. They appear here after an order is placed."}
        </p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-neutral-200">
              <input
                ref={mobileSelectAllRef}
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4 w-4 accent-charcoal"
                aria-label="Select all customers"
              />
              Select all
            </label>
            {customers.map((customer) => (
              <article
                key={customer.email}
                className={`space-y-2 rounded-lg bg-white p-4 shadow dark:bg-neutral-900 ${selected.has(customer.email) ? "ring-2 ring-gold" : "dark:ring-1 dark:ring-white/10"}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(customer.email)}
                    onChange={() => toggleOne(customer.email)}
                    className="mt-1 h-4 w-4 accent-charcoal"
                    aria-label={`Select ${customer.email}`}
                  />
                  <button
                    type="button"
                    onClick={() => openCustomer(customer.email)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="break-all font-medium text-gray-900 dark:text-neutral-100">{customer.email}</p>
                    <p className="text-sm text-gray-700 dark:text-neutral-200">{display(customer.name)}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompose([customer])}
                    className="inline-flex items-center gap-1 text-sm text-charcoal hover:text-gold-dark"
                  >
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    Email
                  </button>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-gray-500 dark:text-neutral-300">Phone</dt>
                    <dd>{display(customer.phone)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-gray-500 dark:text-neutral-300">Orders</dt>
                    <dd>{customer.orderCount}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-gray-500 dark:text-neutral-300">Total spent</dt>
                    <dd>{money(customer.totalSpent)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-gray-500 dark:text-neutral-300">Last order</dt>
                    <dd>{formatDate(customer.lastOrderAt)}</dd>
                  </div>
                </dl>
                <p className="whitespace-pre-line text-sm text-gray-600 dark:text-neutral-300">{display(customer.shippingAddress)}</p>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto bg-white shadow sm:rounded-lg md:block dark:bg-neutral-900 dark:ring-1 dark:ring-white/10">
            <table className="w-full divide-y divide-gray-200 dark:divide-neutral-700">
              <thead className="bg-gray-50 dark:bg-neutral-950">
                <tr>
                  <th className="px-3 py-3 text-left">
                    <input
                      ref={desktopSelectAllRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 accent-charcoal"
                      aria-label="Select all customers"
                    />
                  </th>
                  {(
                    [
                      ["email", "Email"],
                      ["name", "Name"],
                    ] as const
                  ).map(([key, label]) => (
                    <th key={key} className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-300">
                      <button type="button" onClick={() => toggleSort(key)} className="uppercase tracking-wider">
                        {label}
                        {sortMark(key)}
                      </button>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-neutral-300">
                    Phone
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-neutral-300">
                    Shipping address
                  </th>
                  {(
                    [
                      ["orderCount", "Orders"],
                      ["totalSpent", "Total spent"],
                      ["lastOrderAt", "Last order"],
                    ] as const
                  ).map(([key, label]) => (
                    <th key={key} className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-300">
                      <button type="button" onClick={() => toggleSort(key)} className="uppercase tracking-wider">
                        {label}
                        {sortMark(key)}
                      </button>
                    </th>
                  ))}
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-neutral-300">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-neutral-700 dark:bg-neutral-900">
                {customers.map((customer) => (
                  <tr
                    key={customer.email}
                    className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800 ${selected.has(customer.email) ? "bg-gold/10" : ""}`}
                    onClick={() => openCustomer(customer.email)}
                  >
                    <td className="px-3 py-4 align-top" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(customer.email)}
                        onChange={() => toggleOne(customer.email)}
                        className="h-4 w-4 accent-charcoal"
                        aria-label={`Select ${customer.email}`}
                      />
                    </td>
                    <td className="px-3 py-4 align-top text-sm break-all text-gray-900 dark:text-neutral-100">{customer.email}</td>
                    <td className="px-3 py-4 align-top text-sm text-gray-900 dark:text-neutral-100">{display(customer.name)}</td>
                    <td className="px-3 py-4 align-top text-sm text-gray-700 dark:text-neutral-200">{display(customer.phone)}</td>
                    <td className="max-w-xs px-3 py-4 align-top whitespace-pre-line text-sm text-gray-600 dark:text-neutral-300">
                      {display(customer.shippingAddress)}
                    </td>
                    <td className="px-3 py-4 align-top text-sm text-gray-900 dark:text-neutral-100">{customer.orderCount}</td>
                    <td className="px-3 py-4 align-top text-sm font-semibold text-gray-900 dark:text-neutral-100">
                      {money(customer.totalSpent)}
                    </td>
                    <td className="px-3 py-4 align-top text-sm whitespace-nowrap text-gray-500 dark:text-neutral-300">
                      {formatDate(customer.lastOrderAt)}
                    </td>
                    <td className="px-3 py-4 align-top" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setCompose([customer])}
                        className="inline-flex items-center gap-1 text-sm text-charcoal hover:text-gold-dark"
                      >
                        <Mail className="h-4 w-4" aria-hidden="true" />
                        Email
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {compose && (
        <AdminEmailModal
          recipients={compose}
          onClose={() => setCompose(null)}
          onSent={({ sent }) => {
            setCompose(null);
            setSelected(new Set());
            setNotice(`Sent ${sent} ${sent === 1 ? "email" : "emails"}.`);
          }}
        />
      )}
    </div>
  );
}
