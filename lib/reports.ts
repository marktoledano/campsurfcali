import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { matches, users, watches, type AvailableUnit, type User } from "../db/schema.js";
import { bookingUrl } from "./reserve-california.js";
import { sendEmail } from "./email-transport.js";

/** Fixed send time (UTC) for the daily digest — 8am US Pacific Standard Time. Not user-configurable. */
const DAILY_DIGEST_TIME_UTC = "16:00";

function todayUTC(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function fmtNight(d: string): string {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

function isDigestDue(user: User, now: Date): boolean {
  if (!user.notifyDailyDigest) return false;
  const today = todayUTC(now);
  if (user.lastDigestSentDate === today) return false;
  return now.getTime() >= new Date(`${today}T${DAILY_DIGEST_TIME_UTC}:00Z`).getTime();
}

function isSitesReportDue(user: User, now: Date): boolean {
  if (!user.notifyDailySites) return false;
  const today = todayUTC(now);
  if (user.lastDailySitesSentDate === today) return false;
  return now.getTime() >= new Date(`${today}T${user.dailySitesTime}:00Z`).getTime();
}

type SiteReportEntry = {
  facilityName: string;
  parkName: string;
  units: AvailableUnit[];
  url: string;
};

/** Every currently-open unit across a user's active trackers, right now. */
async function getOpenSitesReport(userId: number): Promise<SiteReportEntry[]> {
  const rows = await db
    .select()
    .from(watches)
    .where(and(eq(watches.userId, userId), eq(watches.active, true)));
  return rows
    .filter((w) => w.availableCount > 0)
    .map((w) => ({
      facilityName: w.facilityName,
      parkName: w.parkName,
      units: w.currentAvailability,
      url: bookingUrl(w.placeId, w.facilityId),
    }));
}

function renderEntries(entries: SiteReportEntry[]): { html: string; text: string } {
  const html = entries
    .map(
      (e) => `
        <div style="margin:0 0 20px">
          <h3 style="margin:0 0 6px">${e.facilityName} — ${e.parkName}</h3>
          <ul style="margin:0 0 8px">
            ${e.units
              .slice(0, 10)
              .map(
                (u) =>
                  `<li><strong>${u.unitName}</strong> — ${u.dates.slice(0, 6).map(fmtNight).join(", ")}${u.dates.length > 6 ? "…" : ""}</li>`,
              )
              .join("")}
          </ul>
          <a href="${e.url}" style="color:#0d9488;font-weight:600">Book on ReserveCalifornia →</a>
        </div>`,
    )
    .join("");
  const text = entries
    .map(
      (e) =>
        `${e.facilityName} (${e.parkName}): ${e.units.map((u) => u.unitName).join(", ")} — ${e.url}`,
    )
    .join("\n");
  return { html, text };
}

function buildSitesReportEmail(entries: SiteReportEntry[]): { subject: string; html: string; text: string } {
  if (entries.length === 0) {
    return {
      subject: "SurfCampTrackerCali — no sites open right now",
      html: `<p style="font-family:system-ui,sans-serif">None of your active trackers have an open site right now.</p>`,
      text: "None of your active trackers have an open site right now.",
    };
  }
  const totalSites = entries.reduce((n, e) => n + e.units.length, 0);
  const { html, text } = renderEntries(entries);
  return {
    subject: `🏄 ${totalSites} site(s) open across your trackers`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2 style="margin:0 0 16px">Your current availability report</h2>
      ${html}
    </div>`,
    text,
  };
}

/** Sends the current-availability report immediately — used by both the daily
 * schedule and the on-demand "send availability now" button. */
export async function sendSitesReportNow(user: User): Promise<boolean> {
  const entries = await getOpenSitesReport(user.id);
  const { subject, html, text } = buildSitesReportEmail(entries);
  return sendEmail({ to: user.email, subject, html, text });
}

type DigestRow = {
  unitName: string;
  dates: string[];
  bookingUrl: string;
  facilityName: string;
  parkName: string;
};

/** Everything newly matched (opened) for this user in roughly the last 24h. */
async function getTodaysDigest(userId: number): Promise<DigestRow[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const userWatches = await db.select({ id: watches.id }).from(watches).where(eq(watches.userId, userId));
  const watchIds = userWatches.map((w) => w.id);
  if (watchIds.length === 0) return [];

  return db
    .select({
      unitName: matches.unitName,
      dates: matches.dates,
      bookingUrl: matches.bookingUrl,
      facilityName: watches.facilityName,
      parkName: watches.parkName,
    })
    .from(matches)
    .innerJoin(watches, eq(matches.watchId, watches.id))
    .where(and(inArray(matches.watchId, watchIds), gte(matches.createdAt, since)));
}

function buildDigestEmail(rows: DigestRow[]): { subject: string; html: string; text: string } {
  if (rows.length === 0) {
    return {
      subject: "SurfCampTrackerCali — daily digest",
      html: `<p style="font-family:system-ui,sans-serif">No new sites opened for your trackers today.</p>`,
      text: "No new sites opened for your trackers today.",
    };
  }
  const rowsHtml = rows
    .map(
      (r) => `
        <li style="margin:0 0 8px">
          <strong>${r.unitName}</strong> at ${r.facilityName}, ${r.parkName} —
          ${r.dates.slice(0, 6).map(fmtNight).join(", ")}${r.dates.length > 6 ? "…" : ""}
          &nbsp;<a href="${r.bookingUrl}" style="color:#0d9488;font-weight:600">Book →</a>
        </li>`,
    )
    .join("");
  const text = rows
    .map((r) => `${r.unitName} at ${r.facilityName}, ${r.parkName} — ${r.bookingUrl}`)
    .join("\n");
  return {
    subject: `🏄 Daily digest — ${rows.length} new site(s) opened today`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2 style="margin:0 0 16px">Today's newly-opened sites</h2>
      <ul style="padding-left:18px">${rowsHtml}</ul>
    </div>`,
    text,
  };
}

async function sendDigestNow(user: User): Promise<boolean> {
  const rows = await getTodaysDigest(user.id);
  const { subject, html, text } = buildDigestEmail(rows);
  return sendEmail({ to: user.email, subject, html, text });
}

/**
 * Called once per cron tick (after polling) to send any digests/reports that
 * are due. Marks the send date even on failure so a transient email error
 * doesn't cause retries every 5 minutes for the rest of the day.
 */
export async function sendDueDailyEmails(): Promise<void> {
  const allUsers = await db.select().from(users);
  const now = new Date();
  const today = todayUTC(now);

  for (const user of allUsers) {
    if (isDigestDue(user, now)) {
      await sendDigestNow(user).catch((err) => console.error(`Digest failed for user ${user.id}:`, err));
      await db.update(users).set({ lastDigestSentDate: today }).where(eq(users.id, user.id));
    }
    if (isSitesReportDue(user, now)) {
      await sendSitesReportNow(user).catch((err) =>
        console.error(`Sites report failed for user ${user.id}:`, err),
      );
      await db.update(users).set({ lastDailySitesSentDate: today }).where(eq(users.id, user.id));
    }
  }
}
