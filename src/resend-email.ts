const RESEND_URL = "https://api.resend.com/emails";

export type ResendSendResult = { ok: true; status: number } | { ok: false; status: number | null };

/**
 * POST one message to Resend.
 * Shared by the admin composer and the paid-order notice.
 * Returns false when the key or from-address is missing. Does not log the key,
 * the recipient, or the message.
 */
export async function sendResendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  fetchImpl?: typeof fetch;
}): Promise<ResendSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.EMAIL_FROM?.trim() ?? "";
  if (!apiKey || !from) return { ok: false, status: null };

  const payload: {
    from: string;
    to: string[];
    subject: string;
    text: string;
    html?: string;
  } = {
    from,
    to: [input.to],
    subject: input.subject,
    text: input.text,
  };
  if (input.html) payload.html = input.html;

  const doFetch = input.fetchImpl ?? fetch;
  const response = await doFetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  await response.text().catch(() => "");
  return response.ok ? { ok: true, status: response.status } : { ok: false, status: response.status };
}
