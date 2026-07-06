import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Field, inputClass, PrimaryButton } from '../components/FormField'

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
      <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-brand/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 -right-24 size-72 rounded-full bg-accent/10 blur-3xl" aria-hidden />
      <form onSubmit={handleSubmit} className="relative w-full max-w-sm animate-pop rounded-sheet bg-surface p-6 shadow-card">
        <h1 className="mb-1 text-center font-display text-xl text-brand">
          Merch Planner
        </h1>
        <p className="mb-6 text-center text-sm text-ink-muted">Sign in to your tracker</p>
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
