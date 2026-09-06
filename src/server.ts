import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'

import { cfEnvStorage, type CloudflareEnv } from './server/cf-env.js'
import { pollAllWatches } from '../lib/poll.js'
import { sendDueDailyEmails } from '../lib/reports.js'
import { acquireSweepLease, releaseSweepLease } from '../lib/sweep-lease.js'

const handler = createStartHandler(defaultStreamHandler)

export default {
  async fetch(request: Request, env: CloudflareEnv, _ctx: ExecutionContext): Promise<Response> {
    return cfEnvStorage.run(env, () => handler(request))
  },

  // Replaces the Netlify scheduled function (netlify/functions/poll.mts);
  // cron cadence lives in wrangler.toml's [triggers].
  async scheduled(_event: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      cfEnvStorage.run(env, async () => {
        // Guard against two ticks overlapping if a sweep ever runs long —
        // see lib/sweep-lease.ts.
        if (await acquireSweepLease()) {
          try {
            const summaries = await pollAllWatches()
            const opened = summaries.reduce((n, s) => n + s.newlyOpen, 0)
            console.log(`Polled ${summaries.length} watches; ${opened} newly-open site group(s).`)
          } catch (err) {
            console.error('pollAllWatches failed:', err)
          } finally {
            await releaseSweepLease()
          }
        } else {
          console.log('Skipping sweep — previous sweep still holds the lease.')
        }
        await sendDueDailyEmails()
      }),
    )
  },
}
