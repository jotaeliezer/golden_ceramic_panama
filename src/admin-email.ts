import { sql } from "./db.js";
import { sendResendEmail } from "./resend-email.js";

export const MAX_RECIPIENTS_PER_REQUEST = 50;
const WINDOW_MS = 60_000;
const MAX_EMAILS_PER_WINDOW = 50;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 5000;
const SEND_CONCURRENCY = 5;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type WindowState = { resetAt: number; used: number };
const windows = new Map<string, WindowState>();

export function resetAdminEmailRateLimit(): void {
  windows.clear();
}

export function emailIsConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export type AdminEmailResult =
  | { status: 200; sent: number; failed: number }
  | { status: 400 | 429 | 502 | 503; error: string; sent?: number; failed?: number };

function consumeBudget(key: string, count: number): boolean {
  const now = Date.now();
  const current = windows.get(key);
  if (!current || now >= current.resetAt) {
    windows.set(key, { resetAt: now + WINDOW_MS, used: count });
    return true;
  }
  if (current.used + count > MAX_EMAILS_PER_WINDOW) return false;
  current.used += count;
  return true;
}

function normalizeRecipients(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") return null;
    const trimmed = entry.trim();
    if (!EMAIL_PATTERN.test(trimmed) || trimmed.length > 320) return null;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push(trimmed);
  }
  return recipients;
}

/**
 * Send one Resend email per recipient so addresses are not shared.
 * Logs counts only. Never logs the subject, the message, or the API key.
 */
export async function sendAdminEmails(input: {
  to: unknown;
  subject: unknown;
  message: unknown;
  rateLimitKey: string;
  fetchImpl?: typeof fetch;
}): Promise<AdminEmailResult> {
  const recipients = normalizeRecipients(input.to);
  if (!recipients) {
    return { status: 400, error: "Choose at least one valid customer email." };
  }
  if (recipients.length > MAX_RECIPIENTS_PER_REQUEST) {
    return { status: 400, error: "Send at most 50 emails at a time." };
  }

  const subject = typeof input.subject === "string" ? input.subject.replace(/\0/g, "").trim() : "";
  const message = typeof input.message === "string" ? input.message.replace(/\0/g, "").trim() : "";
  if (!subject || !message) {
    return { status: 400, error: "Add a subject and a message." };
  }
  if (subject.length > MAX_SUBJECT) {
    return { status: 400, error: "Subject is too long." };
  }
  if (message.length > MAX_MESSAGE) {
    return { status: 400, error: "Message is too long." };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.EMAIL_FROM?.trim() ?? "";
  if (!apiKey || !from) {
    return { status: 503, error: "email not configured" };
  }

  const recipientKeys = recipients.map((email) => email.toLowerCase());
  const known = await sql<{ email: string }[]>`
    SELECT DISTINCT lower(btrim(customer_email)) AS email
    FROM orders
    WHERE lower(btrim(customer_email)) = ANY(${recipientKeys})
  `;
  const knownEmails = new Set(known.map((row) => row.email));
  if (recipients.some((email) => !knownEmails.has(email.toLowerCase()))) {
    return { status: 400, error: "One or more addresses are not customers." };
  }

  if (!consumeBudget(input.rateLimitKey || "admin", recipients.length)) {
    return { status: 429, error: "Too many emails. Try again in a minute." };
  }

  const doFetch = input.fetchImpl ?? fetch;
  let sent = 0;
  let failed = 0;
  let cursor = 0;

  const workerCount = Math.min(SEND_CONCURRENCY, recipients.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < recipients.length) {
        const recipient = recipients[cursor];
        cursor += 1;
        try {
          const result = await sendResendEmail({
            to: recipient,
            subject,
            text: message,
            fetchImpl: doFetch,
          });
          if (result.ok) sent += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
      }
    }),
  );

  console.log(`Admin email send finished. requested=${recipients.length} sent=${sent} failed=${failed}`);

  if (sent === 0) {
    return { status: 502, error: "Email could not be sent.", sent, failed };
  }
  return { status: 200, sent, failed };
}
