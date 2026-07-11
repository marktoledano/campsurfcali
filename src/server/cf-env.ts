import { AsyncLocalStorage } from 'node:async_hooks'

export interface CloudflareEnv {
  DATABASE_URL: string
  RESEND_API_KEY?: string
  ALERT_FROM_EMAIL?: string
}

export const cfEnvStorage = new AsyncLocalStorage<CloudflareEnv>()

export function getCfEnv(): CloudflareEnv {
  const env = cfEnvStorage.getStore()
  if (!env) throw new Error('Cloudflare env not available outside a request context')
  return env
}
