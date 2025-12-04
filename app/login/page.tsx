'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    // later we’ll check role and route accordingly
    if (data.session) {
      router.push('/dashboard')
    }
  }

  return (
    <main style={{ padding: 40, maxWidth: 400 }}>
      <h1 style={{ fontSize: 32, marginBottom: 16 }}>Login</h1>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={{ padding: 8 }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={{ padding: 8 }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{ padding: 10, marginTop: 8 }}
        >
          {loading ? 'Logging in…' : 'Login'}
        </button>

        {error && <p style={{ color: 'tomato' }}>{error}</p>}
      </form>
      <p style={{ marginTop: 16 }}>
        Don&apos;t have an account? <a href="/signup">Sign up</a>
      </p>
    </main>
  )
}


