# SurfCampTrackerCali

Track campsite availability on [ReserveCalifornia](https://www.reservecalifornia.com/)
and get alerted the moment a site opens up for your dates — with a one-tap link
straight to the official booking page.

California's coastal and state-park campgrounds book out months in advance, but
sites free up constantly as reservations are cancelled. SurfCampTrackerCali watches
the campgrounds and dates you care about and notifies you when something opens.

## What it does

- **Search any park & campground** across the ReserveCalifornia system.
- **Create "watches"** for a campground, one or more separate date windows,
  minimum consecutive nights, an optional site-name filter, and ADA-only if
  needed.
- **Polls automatically every 5 minutes** via a Cloudflare Worker cron trigger,
  and on demand with a "check now" button.
- **Alerts you** in an in-app feed and by email — choose immediate alerts, a
  daily digest, a daily "everything that's open" report at a time you set, or
  any combination — each alert carrying a direct deep link to the campground's
  checkout page on reservecalifornia.com.
- **Quick-book flag** highlights time-sensitive watches so you can grab a
  cancellation before it's gone.

Trackers belong to a user account (username + password). An admin console lets
admins view every account and its tracker count.

## Tech stack

- **[TanStack Start](https://tanstack.com/start)** (React 19) — app + server API routes
- **Tailwind CSS v4** — styling
- **Cloudflare Workers** — hosting, SSR, and a cron-triggered scheduled poller (`src/server.ts`)
- **Neon Postgres** with **Drizzle ORM** — persistence
- **ReserveCalifornia RDR API** — public availability data source
- **Cloudflare Email Sending** — email delivery, sent from `campsurfcali.com`

## Running locally

```bash
npm install
cp .dev.vars.example .dev.vars  # fill in DATABASE_URL
npm run dev
```

Then open the printed local URL. Apply the migrations in
`netlify/database/migrations/` to your Neon database with `npx drizzle-kit migrate`
before first run.

> The cron-triggered poller only runs on a deployed Worker. Locally, use each
> watch's **check now** button to trigger a poll. Local email sends are
> logged by Miniflare rather than actually delivered — test real delivery
> against a deployed Worker.

## Optional configuration

- `ALERT_FROM_EMAIL` — override the default `alerts@campsurfcali.com` sender
  (in `.dev.vars` locally, or as a Worker secret via `wrangler secret put` in
  production).

Email sending requires `campsurfcali.com` to be onboarded to Cloudflare Email
Sending (**Compute & AI → Email Service → Email Sending** in the dashboard, or
`wrangler email sending enable campsurfcali.com`) so its SPF/DKIM records exist.

## A note on booking

SurfCampTrackerCali never asks for or stores your ReserveCalifornia login. The
"quick-book" feature surfaces a direct link to the official checkout page for an
open site; you complete the reservation and payment on reservecalifornia.com. This
tool is independent and not affiliated with California State Parks.
