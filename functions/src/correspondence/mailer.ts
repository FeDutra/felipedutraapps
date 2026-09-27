/**
 * @file mailer.ts
 * @description Native fetch wrapper for Resend API with zero dependencies and safe error handling.
 */

export interface SendEmailOptions {
  apiKey: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  errorCode?: string;
  errorMessage?: string;
}

export const DEFAULT_SENDER =
  process.env.CORRESPONDENCE_FROM_EMAIL ||
  "fe · correspondência <contato@felipedutra.com>";

export const DEFAULT_REPLY_TO =
  process.env.CORRESPONDENCE_REPLY_TO || "contato@felipedutra.com";

const RESEND_API_ENDPOINT = "https://api.resend.com/emails";

export async function sendEmailWithResend(
  options: SendEmailOptions
): Promise<SendEmailResult> {
  const { apiKey, to, subject, html, text, from = DEFAULT_SENDER, replyTo = DEFAULT_REPLY_TO } = options;

  if (!apiKey || apiKey.trim().length === 0) {
    return {
      success: false,
      errorCode: "MISSING_API_KEY",
      errorMessage: "Resend API key is not configured"
    };
  }

  try {
    const payload = {
      from,
      to: [to],
      reply_to: replyTo,
      subject,
      html,
      ...(text ? { text } : {})
    };

    const response = await fetch(RESEND_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {
        // Body was not JSON
      }

      const safeErrorCode = errorData?.name || `HTTP_${response.status}`;
      return {
        success: false,
        errorCode: safeErrorCode,
        errorMessage: `Delivery failed with status ${response.status}`
      };
    }

    const data: any = await response.json();
    return {
      success: true,
      id: data?.id
    };
  } catch (err: any) {
    return {
      success: false,
      errorCode: "NETWORK_ERROR",
      errorMessage: err?.message ? "Network error during email delivery" : "Unknown error"
    };
  }
}
