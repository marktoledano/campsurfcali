# SurfCampTrackerCali

Track campsite availability on [ReserveCalifornia](https://www.reservecalifornia.com/)
and get alerted the moment a site opens up for your dates — with a one-tap link
straight to the official booking page.

California's coastal and state-park campgrounds book out months in advance, but
sites free up constantly as reservations are cancelled. SurfCampTrackerCali watches
the campgrounds and dates you care about and notifies you when something opens.

## What it does

- **Search any park & campground** across the ReserveCalifornia system.
- **Create "watches"** for a campground, a date window, minimum consecutive
  nights, an optional site-name filter, and ADA-only if needed.
- **Polls automatically every 5 minutes** via a Cloudflare Worker cron trigger,
  and on demand with a "check now" button.
- **Alerts you** in an in-app feed and (optionally) by email, each alert carrying a
  direct deep link to the campground's checkout page on reservecalifornia.com.
- **Quick-book flag** highlights time-sensitive watches so you can grab a
  cancellation before it's gone.

Watches are keyed to an email address — no account or password required.

## Tech stack

- **[TanStack Start](https://tanstack.com/start)** (React 19) — app + server API routes
- **Tailwind CSS v4** — styling
- **Cloudflare Workers** — hosting, SSR, and a cron-triggered scheduled poller (`src/server.ts`)
- **Neon Postgres** with **Drizzle ORM** — persistence
- **ReserveCalifornia RDR API** — public availability data source
- **[Resend](https://resend.com)** — optional email delivery

## Running locally

```bash
npm install
cp .dev.vars.example .dev.vars  # fill in DATABASE_URL (and Resend vars if using email)
npm run dev
```

Then open the printed local URL. Apply the migrations in
`netlify/database/migrations/` to your Neon database with `npx drizzle-kit migrate`
before first run.

> The cron-triggered poller only runs on a deployed Worker. Locally, use each
> watch's **check now** button to trigger a poll.

## Optional configuration

Email alerts are delivered through Resend when these variables are set (in
`.dev.vars` locally, or as Worker secrets via `wrangler secret put` in
production). Without them, alerts still appear in the in-app feed:

- `RESEND_API_KEY` — your Resend API key
- `ALERT_FROM_EMAIL` — verified sender, e.g. `Alerts <alerts@yourdomain.com>`

## A note on booking

SurfCampTrackerCali never asks for or stores your ReserveCalifornia login. The
"quick-book" feature surfaces a direct link to the official checkout page for an
open site; you complete the reservation and payment on reservecalifornia.com. This
tool is independent and not affiliated with California State Parks.
