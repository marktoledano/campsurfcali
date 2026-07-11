import type { AvailableUnit, Watch } from "../db/schema.js";
import { getCfEnv } from "../src/server/cf-env.js";

/**
 * Notification delivery. In-app notifications are always recorded in the
 * `matches` table (the dashboard feed). Email is delivered through Resend when
 * a `RESEND_API_KEY` environment variable is present; otherwise the alert is
 * still recorded and shown in the app, so the feature degrades gracefully with
 * zero required configuration or secrets committed to the repo.
 */

function envGet(key: "RESEND_API_KEY" | "ALERT_FROM_EMAIL"): string | undefined {
  return getCfEnv()[key];
}

function formatDates(dates: string[]): string {
  return dates
    .map((d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-US", {
      timeZone: "UTC",
      weekday: "short",
      month: "short",
      day: "numeric",
    }))
    .join(", ");
}

export type EmailPayload = {
  watch: Watch;
  units: AvailableUnit[];
  bookingUrl: string;
};

/**
 * Attempt to send an email alert. Returns the channel used ("email" or "in-app")
 * so callers can record how the user was notified. Never throws — a failed send
 * must not break the poll loop.
 */
export async function sendAlert({
  watch,
  units,
  bookingUrl,
}: EmailPayload): Promise<"email" | "in-app"> {
  const apiKey = envGet("RESEND_API_KEY");
  const from = envGet("ALERT_FROM_EMAIL") ?? "SurfCampTrackerCali <onboarding@resend.dev>";
  if (!apiKey) return "in-app";

  const rows = units
    .slice(0, 15)
    .map(
      (u) =>
        `<li><strong>${u.unitName}</strong> — ${formatDates(u.dates)}</li>`,
    )
    .join("");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2 style="margin:0 0 4px">🏄 A campsite opened up!</h2>
      <p style="color:#475569;margin:0 0 16px">
        ${watch.facilityName} at ${watch.parkName} has availability for your
        ${watch.startDate} → ${watch.endDate} window.
      </p>
      <ul>${rows}</ul>
      <p style="margin:20px 0">
        <a href="${bookingUrl}"
           style="background:#0d9488;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">
          Book on ReserveCalifornia →
        </a>
      </p>
      <p style="color:#94a3b8;font-size:12px">
        You are receiving this because you created a watch on SurfCampTrackerCali.
      </p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [watch.email],
        subject: `🏄 ${units.length} site(s) open at ${watch.facilityName}`,
        html,
      }),
    });
    return res.ok ? "email" : "in-app";
  } catch {
    return "in-app";
  }
}
