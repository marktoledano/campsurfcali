import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ArrowLeft, ShieldCheck, ShieldOff, Trash2, Waves } from 'lucide-react'
import { api, type AdminUserRow, type AuthUser } from '../lib/api'

export const Route = createFileRoute('/admin')({
  component: AdminConsole,
})

function AdminConsole() {
  const navigate = useNavigate()
  const [me, setMe] = useState<AuthUser | null | undefined>(undefined)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    api.me().then(setMe)
  }, [])

  useEffect(() => {
    if (me === undefined) return
    if (!me || !me.isAdmin) {
      navigate({ to: '/' })
      return
    }
    api
      .adminListUsers()
      .then(setUsers)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [me, navigate])

  async function toggleAdmin(u: AdminUserRow) {
    setBusyId(u.id)
    setError(null)
    try {
      const updated = await api.adminSetAdmin(u.id, !u.isAdmin)
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isAdmin: updated.isAdmin } : x)))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  async function removeUser(u: AdminUserRow) {
    if (!confirm(`Delete account "${u.username}"? This also deletes their ${u.trackerCount} tracker(s).`))
      return
    setBusyId(u.id)
    setError(null)
    try {
      await api.adminDeleteUser(u.id)
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  if (me === undefined || (me?.isAdmin && loading)) return null
  if (!me || !me.isAdmin) return null

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-ocean-deep">
          <Waves className="h-6 w-6" />
          <span className="font-display text-sm font-bold uppercase tracking-[0.28em]">
            SurfCampTrackerCali
          </span>
        </div>
        <Link
          to="/"
          className="flex items-center gap-1.5 rounded-lg border border-pine/12 bg-paper/70 px-3 py-1.5 text-sm font-medium text-pine-soft transition hover:border-pine/25"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> back to dashboard
        </Link>
      </header>

      <div className="mt-8 flex items-center gap-3">
        <ShieldCheck className="h-8 w-8 text-ocean" />
        <h1 className="font-display text-4xl font-black text-pine sm:text-5xl">
          Admin console
        </h1>
      </div>
      <p className="mt-2 text-pine-soft">
        {users.length} account{users.length === 1 ? '' : 's'} — {users.reduce((n, u) => n + u.trackerCount, 0)}{' '}
        tracker{users.reduce((n, u) => n + u.trackerCount, 0) === 1 ? '' : 's'} total
      </p>

      {error && (
        <p className="mt-4 rounded-xl bg-clay/10 px-4 py-3 text-sm font-medium text-clay">{error}</p>
      )}

      <div className="mt-6 overflow-hidden rounded-3xl border border-pine/10 bg-paper/80 shadow-[0_20px_60px_-30px_rgba(29,42,36,0.5)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-pine/10 bg-sand-deep/40 text-xs uppercase tracking-wider text-pine-soft">
              <th className="px-5 py-3 font-semibold">Username</th>
              <th className="px-5 py-3 font-semibold">Email</th>
              <th className="px-5 py-3 font-semibold">Trackers</th>
              <th className="px-5 py-3 font-semibold">Role</th>
              <th className="px-5 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-pine/5 last:border-0">
                <td className="px-5 py-3 font-semibold text-pine">{u.username}</td>
                <td className="px-5 py-3 text-pine-soft">{u.email}</td>
                <td className="px-5 py-3 text-pine-soft">{u.trackerCount}</td>
                <td className="px-5 py-3">
                  {u.isAdmin ? (
                    <span className="rounded-full bg-ocean/10 px-2.5 py-1 text-xs font-bold text-ocean-deep">
                      admin
                    </span>
                  ) : (
                    <span className="rounded-full bg-sand-deep/70 px-2.5 py-1 text-xs font-semibold text-pine-soft">
                      member
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleAdmin(u)}
                      disabled={busyId === u.id || u.id === me.id}
                      title={u.isAdmin ? 'Remove admin access' : 'Make admin'}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-pine-soft transition hover:border hover:border-pine/10 hover:bg-sand-deep/50 disabled:opacity-40"
                    >
                      {u.isAdmin ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => removeUser(u)}
                      disabled={busyId === u.id || u.id === me.id}
                      title="Delete account"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-clay transition hover:bg-clay/10 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
