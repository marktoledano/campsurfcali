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
- **Polls automatically every 5 minutes** via a scheduled function, and on demand
  with a "check now" button.
- **Alerts you** in an in-app feed and (optionally) by email, each alert carrying a
  direct deep link to the campground's checkout page on reservecalifornia.com.
- **Quick-book flag** highlights time-sensitive watches so you can grab a
  cancellation before it's gone.

Watches are keyed to an email address — no account or password required.

## Tech stack

- **[TanStack Start](https://tanstack.com/start)** (React 19) — app + server API routes
- **Tailwind CSS v4** — styling
- **Netlify Functions** — scheduled poller (`netlify/functions/poll.mts`)
- **Netlify Database (Postgres)** with **Drizzle ORM** — persistence
- **ReserveCalifornia RDR API** — public availability data source
- **[Resend](https://resend.com)** — optional email delivery

## Running locally

```bash
npm install
netlify dev --port 8889
```

Then open the printed local URL. On first database connection Netlify provisions a
managed Postgres branch automatically and applies the migrations in
`netlify/database/migrations/`.

> Scheduled functions only run on published Netlify deploys. Locally, use each
> watch's **check now** button (or `netlify functions:invoke poll`) to trigger a poll.

## Optional configuration

Email alerts are delivered through Resend when these environment variables are set
(in the Netlify UI or your local `.env`). Without them, alerts still appear in the
in-app feed:

- `RESEND_API_KEY` — your Resend API key
- `ALERT_FROM_EMAIL` — verified sender, e.g. `Alerts <alerts@yourdomain.com>`

## A note on booking

SurfCampTrackerCali never asks for or stores your ReserveCalifornia login. The
"quick-book" feature surfaces a direct link to the official checkout page for an
open site; you complete the reservation and payment on reservecalifornia.com. This
tool is independent and not affiliated with California State Parks.
