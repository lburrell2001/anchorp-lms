'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setLoading(false)
      setError(error.message)
      return
    }

    const user = data.user
    if (user) {
      // create profile row tied to this auth user
      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id,
        full_name: fullName,
        role: 'employee', // default – we’ll handle internal/external later
      })

      if (profileError) {
        console.error(profileError)
      }
    }

    setLoading(false)
    // you can also route to "check your email" if you enable confirmation
    router.push('/dashboard')
  }

  return (
    <main style={{ padding: 40, maxWidth: 400 }}>
      <h1 style={{ fontSize: 32, marginBottom: 16 }}>Sign Up</h1>
      <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="text"
          placeholder="Full name"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          required
          style={{ padding: 8 }}
        />
        <input
          type="email"
          placeholder="Work email"
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
          {loading ? 'Creating account…' : 'Sign up'}
        </button>

        {error && <p style={{ color: 'tomato' }}>{error}</p>}
      </form>
      <p style={{ marginTop: 16 }}>
        Already have an account? <a href="/login">Login</a>
      </p>
    </main>
  )
}
