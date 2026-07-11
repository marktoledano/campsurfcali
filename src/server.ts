import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'

import { cfEnvStorage, type CloudflareEnv } from './server/cf-env.js'
import { pollAllWatches } from '../lib/poll.js'

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
        const summaries = await pollAllWatches()
        const opened = summaries.reduce((n, s) => n + s.newlyOpen, 0)
        console.log(`Polled ${summaries.length} watches; ${opened} newly-open site group(s).`)
      }),
    )
  },
}
