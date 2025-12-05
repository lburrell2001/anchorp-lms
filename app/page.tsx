'use client'

export default function Home() {
  return (
    <main style={{ padding: 40 }}>
      <h1 style={{ fontSize: 32, marginBottom: 16 }}>AnchorP LMS</h1>
      <p style={{ marginBottom: 24 }}>
        Welcome to the internal & external training portal.
      </p>

      <div style={{ display: 'flex', gap: 12 }}>
        <a href="/login" style={{ padding: 10, border: '3px solid #fff' }}>
          Login
        </a>
        <a href="/signup" style={{ padding: 10, border: '3px solid #fff' }}>
          Sign up
        </a>
      </div>
    </main>
  )
}

