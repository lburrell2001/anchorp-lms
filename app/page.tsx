'use client'

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: "url('/auth-hero.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="login-card" style={{ textAlign: "center" }}>
        <h1 style={{ marginBottom: 8, color: "#111" }}>Welcome to Anchor Academy</h1>

        <p style={{ marginBottom: 20, color: "#222", fontSize: 15 }}>
          Training for rooftop professionals.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <a
            href="/login"
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "#047857",
              color: "#fff",
              fontWeight: 600,
              textAlign: "center",
              textDecoration: "none",
            }}
          >
            Sign in
          </a>

          <a
            href="/signup"
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.85)",
              color: "#047857",
              fontWeight: 600,
              textAlign: "center",
              textDecoration: "none",
              border: "1px solid #047857",
            }}
          >
            Create account
          </a>
        </div>
      </div>
    </main>
  );
}
