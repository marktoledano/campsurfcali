import { useState, type FormEvent } from 'react'
import { Waves, Compass, CalendarClock, BellRing, ArrowRight, Loader2 } from 'lucide-react'
import { api, type AuthUser } from '../lib/api'

type Props = {
  onAuthenticated: (user: AuthUser) => void
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/

export function AuthGate({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')

  return (
    <main className="mx-auto max-w-5xl px-5 py-16 sm:py-24">
      <div className="flex items-center gap-2 text-ocean-deep">
        <Waves className="h-6 w-6" />
        <span className="font-display text-sm font-bold uppercase tracking-[0.3em]">
          SurfCampTrackerCali
        </span>
      </div>

      <h1 className="mt-10 max-w-3xl font-display text-5xl font-black leading-[0.98] text-pine sm:text-7xl">
        The California coast is{' '}
        <span className="text-ocean">booked solid.</span> We watch for the{' '}
        <span className="text-sunset">cancellation.</span>
      </h1>

      <p className="mt-6 max-w-xl text-lg leading-relaxed text-pine-soft">
        Point us at any ReserveCalifornia campground and your dates. We poll the
        official availability grid on your schedule and ping you the instant a
        site frees up — with a one-tap link straight to checkout.
      </p>

      <div className="mt-10 max-w-md">
        {mode === 'login' ? (
          <LoginForm
            onAuthenticated={onAuthenticated}
            onSwitch={() => setMode('register')}
          />
        ) : (
          <RegisterForm
            onAuthenticated={onAuthenticated}
            onSwitch={() => setMode('login')}
          />
        )}
      </div>

      <div className="mt-20 grid gap-6 sm:grid-cols-3">
        <Feature
          icon={<Compass className="h-5 w-5" />}
          title="Every state park"
          body="Search all ReserveCalifornia parks and campgrounds — from Big Sur to the Sierra."
        />
        <Feature
          icon={<CalendarClock className="h-5 w-5" />}
          title="Checked on your schedule"
          body="Set how often each tracker (or all of them) gets rechecked — minutes, hours, or days."
        />
        <Feature
          icon={<BellRing className="h-5 w-5" />}
          title="Alert + quick-book"
          body="Get an in-app alert (and email) with a direct link to grab the open site."
        />
      </div>
    </main>
  )
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="rounded-2xl border border-pine/10 bg-paper/70 p-6 backdrop-blur">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ocean/10 text-ocean">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-lg font-bold text-pine">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-pine-soft">{body}</p>
    </div>
  )
}

function LoginForm({
  onAuthenticated,
  onSwitch,
}: {
  onAuthenticated: (user: AuthUser) => void
  onSwitch: () => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      onAuthenticated(await api.login({ username: username.trim(), password }))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-3xl border border-pine/10 bg-paper/80 p-6 shadow-[0_20px_60px_-30px_rgba(29,42,36,0.5)] backdrop-blur">
      <h2 className="font-display text-xl font-bold text-pine">Log in</h2>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
        autoComplete="username"
        className="w-full rounded-xl border border-pine/15 bg-sand/60 px-4 py-3 text-pine outline-none transition focus:border-ocean focus:bg-white focus:ring-4 focus:ring-ocean/10"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        autoComplete="current-password"
        className="w-full rounded-xl border border-pine/15 bg-sand/60 px-4 py-3 text-pine outline-none transition focus:border-ocean focus:bg-white focus:ring-4 focus:ring-ocean/10"
      />
      {error && <p className="text-sm font-medium text-clay">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="group flex w-full items-center justify-center gap-2 rounded-xl bg-pine px-6 py-3.5 font-display font-bold text-sand transition hover:bg-ocean-deep disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />}
        Log in
      </button>
      <button
        type="button"
        onClick={onSwitch}
        className="w-full text-center text-sm font-semibold text-ocean-deep hover:underline"
      >
        Need an account? Create one
      </button>
    </form>
  )
}

function RegisterForm({
  onAuthenticated,
  onSwitch,
}: {
  onAuthenticated: (user: AuthUser) => void
  onSwitch: () => void
}) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!USERNAME_RE.test(username.trim())) {
      setError('Username must be 3-32 characters (letters, numbers, _ . - only).')
      return
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email so we know where to send alerts.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      onAuthenticated(
        await api.register({
          username: username.trim(),
          email: email.trim(),
          password,
          confirmPassword,
        }),
      )
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-3xl border border-pine/10 bg-paper/80 p-6 shadow-[0_20px_60px_-30px_rgba(29,42,36,0.5)] backdrop-blur">
      <h2 className="font-display text-xl font-bold text-pine">Create an account</h2>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
        autoComplete="username"
        className="w-full rounded-xl border border-pine/15 bg-sand/60 px-4 py-3 text-pine outline-none transition focus:border-ocean focus:bg-white focus:ring-4 focus:ring-ocean/10"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
        className="w-full rounded-xl border border-pine/15 bg-sand/60 px-4 py-3 text-pine outline-none transition focus:border-ocean focus:bg-white focus:ring-4 focus:ring-ocean/10"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password (min. 8 characters)"
        autoComplete="new-password"
        className="w-full rounded-xl border border-pine/15 bg-sand/60 px-4 py-3 text-pine outline-none transition focus:border-ocean focus:bg-white focus:ring-4 focus:ring-ocean/10"
      />
      <input
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Confirm password"
        autoComplete="new-password"
        className="w-full rounded-xl border border-pine/15 bg-sand/60 px-4 py-3 text-pine outline-none transition focus:border-ocean focus:bg-white focus:ring-4 focus:ring-ocean/10"
      />
      {error && <p className="text-sm font-medium text-clay">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="group flex w-full items-center justify-center gap-2 rounded-xl bg-sunset px-6 py-3.5 font-display font-bold text-paper shadow-lg transition hover:bg-clay disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />}
        Create account
      </button>
      <button
        type="button"
        onClick={onSwitch}
        className="w-full text-center text-sm font-semibold text-ocean-deep hover:underline"
      >
        Already have an account? Log in
      </button>
    </form>
  )
}
