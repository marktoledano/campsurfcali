import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, type AvailableUnit, type Watch } from "../db/schema.js";
import { sendEmail } from "./email-transport.js";

/**
 * Notification delivery. In-app notifications are always recorded in the
 * `matches` table (the dashboard feed). Email is sent via Cloudflare Email
 * Sending (see lib/email-transport.ts) only when the watch's owner has the
 * "immediate" notification preference enabled; otherwise the alert is still
 * recorded and shown in the app.
 */

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
 * Attempt to send an immediate email alert for newly-opened sites. Returns
 * the channel used ("email" or "in-app") so callers can record how the user
 * was notified. Never throws — a failed send must not break the poll loop.
 */
export async function sendAlert({
  watch,
  units,
  bookingUrl,
}: EmailPayload): Promise<"email" | "in-app"> {
  const [owner] = await db
    .select({ notifyImmediate: users.notifyImmediate })
    .from(users)
    .where(eq(users.id, watch.userId));
  if (!owner?.notifyImmediate) return "in-app";

  const rows = units
    .slice(0, 15)
    .map(
      (u) =>
        `<li><strong>${u.unitName}</strong> — ${formatDates(u.dates)}</li>`,
    )
    .join("");

  const windows = watch.dateRanges
    .map((r) => `${r.startDate} → ${r.endDate}`)
    .join(", ");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2 style="margin:0 0 4px">🏄 A campsite opened up!</h2>
      <p style="color:#475569;margin:0 0 16px">
        ${watch.facilityName} at ${watch.parkName} has availability for your
        ${windows} window${watch.dateRanges.length > 1 ? "s" : ""}.
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

  const text = `${watch.facilityName} at ${watch.parkName} has availability for your ${windows} window${
    watch.dateRanges.length > 1 ? "s" : ""
  }:\n${units.map((u) => `- ${u.unitName} — ${formatDates(u.dates)}`).join("\n")}\n\nBook: ${bookingUrl}`;

  const ok = await sendEmail({
    to: watch.email,
    subject: `🏄 ${units.length} site(s) open at ${watch.facilityName}`,
    html,
    text,
  });
  return ok ? "email" : "in-app";
}
