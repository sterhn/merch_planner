import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Heart, Sparkle, Star } from 'lucide-react'
import { Field, inputClass, PrimaryButton } from '../components/FormField'
import BrandMark from '../components/BrandMark'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-page p-6">
      <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-brand/20 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 -right-24 size-72 rounded-full bg-accent/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute right-1/4 top-1/4 size-40 rounded-full bg-sun/30 blur-3xl" aria-hidden />
      {/* Little floating doodles */}
      <Star size={22} className="absolute left-[12%] top-[18%] animate-float fill-current text-sun" aria-hidden />
      <Heart size={18} className="absolute right-[14%] top-[26%] animate-float fill-current text-accent/60" style={{ animationDelay: '1.2s' }} aria-hidden />
      <Sparkle size={20} className="absolute bottom-[20%] left-[18%] animate-twinkle fill-current text-brand/60" aria-hidden />
      <Sparkle size={14} className="absolute bottom-[28%] right-[20%] animate-twinkle fill-current text-sky/70" style={{ animationDelay: '0.9s' }} aria-hidden />
      <form onSubmit={handleSubmit} className="relative w-full max-w-sm animate-pop rounded-sheet bg-surface p-6 shadow-lift">
        <div className="mb-3 flex justify-center">
          <span className="animate-float">
            <BrandMark size={56} />
          </span>
        </div>
        <h1 className="mb-1 text-center font-display text-2xl">Welcome back!</h1>
        <p className="mb-6 text-center text-sm text-ink-muted">Sign in to your little merch shop</p>
        <Field label="Email">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </Field>
        {error && <p className="mb-3 text-sm font-semibold text-bad">{error}</p>}
        <PrimaryButton type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </PrimaryButton>
      </form>
    </div>
  )
}
