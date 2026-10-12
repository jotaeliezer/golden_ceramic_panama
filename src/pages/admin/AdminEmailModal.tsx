import { useEffect, useState, type FormEvent } from "react";
import type { CustomerSummary } from "../../types";

function recipientLine(customer: CustomerSummary): string {
  return customer.name ? `${customer.name} <${customer.email}>` : customer.email;
}

export default function AdminEmailModal({
  recipients,
  onClose,
  onSent,
}: {
  recipients: CustomerSummary[];
  onClose: () => void;
  onSent: (result: { sent: number; failed: number }) => void;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !sending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, sending]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSending(true);
    try {
      const response = await fetch("/api/admin/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
        body: JSON.stringify({
          to: recipients.map((customer) => customer.email),
          subject,
          message,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 503) {
        setError(typeof data.error === "string" ? data.error : "email not configured");
        return;
      }
      if (!response.ok) {
        setError(typeof data.error === "string" ? data.error : "Email could not be sent.");
        return;
      }
      const sent = Number(data.sent ?? 0);
      const failed = Number(data.failed ?? 0);
      if (failed > 0) {
        setError(`Sent ${sent}. ${failed} could not be sent.`);
        return;
      }
      onSent({ sent, failed });
    } catch {
      setError("Email could not be sent.");
    } finally {
      setSending(false);
    }
  };

  const countLabel = recipients.length === 1 ? "1 customer" : `${recipients.length} customers`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/40 p-4 md:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !sending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-dialog-title"
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            <h2 id="email-dialog-title" className="font-serif text-2xl text-charcoal">
              Send email
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Separate email to each person. Addresses stay private.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="px-2 text-sm text-gray-500 hover:text-charcoal disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <form onSubmit={send} className="grid min-h-0 flex-1 gap-0 overflow-y-auto md:grid-cols-2">
          <div className="space-y-4 border-gray-200 p-5 md:border-r">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                To ({countLabel})
              </p>
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-sm text-gray-800">
                {recipients.map((customer) => (
                  <li key={customer.email} className="break-all">
                    {recipientLine(customer)}
                  </li>
                ))}
              </ul>
            </div>
            <label className="block text-sm font-medium text-gray-700">
              Subject
              <input
                required
                autoFocus
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={200}
                className="mt-1 w-full rounded border border-gray-300 p-2 text-sm shadow-sm focus:border-gold focus:ring-gold"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Message
              <textarea
                required
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={8}
                maxLength={5000}
                className="mt-1 w-full rounded border border-gray-300 p-2 text-sm shadow-sm focus:border-gold focus:ring-gold"
              />
            </label>
            {error && (
              <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
                {error === "email not configured" && " Nothing was sent."}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={sending || recipients.length === 0}
                className="rounded bg-charcoal px-4 py-2 text-sm font-semibold text-white hover:bg-charcoal-light disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send email"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>

          <div className="bg-ivory p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Preview</p>
            <div className="mt-3 rounded border border-charcoal/10 bg-white p-4 text-sm text-charcoal">
              <p className="text-xs uppercase tracking-wider text-gray-500">To</p>
              <ul className="mt-1 space-y-1">
                {recipients.map((customer) => (
                  <li key={customer.email} className="break-all">
                    {recipientLine(customer)}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs uppercase tracking-wider text-gray-500">Subject</p>
              <p className="mt-1 font-medium">{subject.trim() || "No subject yet"}</p>
              <p className="mt-4 text-xs uppercase tracking-wider text-gray-500">Message</p>
              <p className="mt-1 whitespace-pre-wrap">
                {message.trim() || "The message will appear here."}
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
