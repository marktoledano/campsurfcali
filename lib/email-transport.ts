import { getCfEnv } from "../src/server/cf-env.js";

const DEFAULT_FROM: EmailAddress = { email: "alerts@campsurfcali.com", name: "SurfCampTrackerCali" };

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Send an email via the Cloudflare Email Sending Workers binding. Never
 * throws — a failed send must not break the poll loop or a request handler;
 * callers get back whether it succeeded and can fall back to in-app-only.
 */
export async function sendEmail({ to, subject, html, text }: OutgoingEmail): Promise<boolean> {
  try {
    const env = getCfEnv();
    const from = env.ALERT_FROM_EMAIL
      ? { email: env.ALERT_FROM_EMAIL, name: DEFAULT_FROM.name }
      : DEFAULT_FROM;
    await env.EMAIL.send({ to, from, subject, html, text });
    return true;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}
