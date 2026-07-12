import { useEffect, useRef, useState } from 'react'
import { Share2, Copy, Mail, MessageSquare, Check, MoreHorizontal } from 'lucide-react'

type Props = {
  url: string
  title: string
  text: string
  dark?: boolean
}

/** Small share trigger with Email / Text / Copy link / native share-sheet (AirDrop, etc.) options. */
export function ShareButton({ url, title, text, dark }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Clipboard API unavailable/blocked — fall back to a legacy copy.
      const textarea = document.createElement('textarea')
      textarea.value = url
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
      } catch {
        /* nothing more we can do */
      }
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
      setOpen(false)
    }, 1200)
  }

  async function nativeShare() {
    setOpen(false)
    try {
      await navigator.share({ title, text, url })
    } catch {
      /* user cancelled the share sheet; nothing to do */
    }
  }

  const mailtoHref = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`
  const smsHref = `sms:?body=${encodeURIComponent(`${text} ${url}`)}`

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Share"
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
          dark
            ? 'text-sand/60 hover:bg-sand/10 hover:text-sand'
            : 'text-pine-soft hover:bg-sand-deep/60 hover:text-pine'
        }`}
      >
        <Share2 className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-pine/10 bg-white py-1 text-sm shadow-lg">
          <a
            href={mailtoHref}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-pine transition hover:bg-sand/60"
          >
            <Mail className="h-4 w-4 text-ocean" /> Email
          </a>
          <a
            href={smsHref}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-pine transition hover:bg-sand/60"
          >
            <MessageSquare className="h-4 w-4 text-ocean" /> Text message
          </a>
          <button
            onClick={copyLink}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-pine transition hover:bg-sand/60"
          >
            {copied ? <Check className="h-4 w-4 text-ocean" /> : <Copy className="h-4 w-4 text-ocean" />}
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          {canNativeShare && (
            <button
              onClick={nativeShare}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-pine transition hover:bg-sand/60"
            >
              <MoreHorizontal className="h-4 w-4 text-ocean" /> More (AirDrop, apps…)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
