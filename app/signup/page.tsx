"use client";

import Link from "next/link";
import { FormEvent } from "react";

export default function SignupPage() {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // TODO: hook this up to Supabase sign-up
  };

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
      <div className="login-card">
        <h1 style={{ marginBottom: 8 }}>Sign up</h1>
        <p style={{ marginBottom: 20, color: "#111" }}>
          Create your Anchor Academy account.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: "grid", gap: 12 }}
        >
          <label style={{ fontSize: 14 }}>
            Full name
            <input
              type="text"
              required
              placeholder="Bob Anchorman"
              style={{
                width: "100%",
                marginTop: 4,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "rgba(255,255,255,0.9)",
                color: "#111",
              }}
            />
          </label>

          <label style={{ fontSize: 14 }}>
            Email
            <input
              type="email"
              required
              placeholder="you@example.com"
              style={{
                width: "100%",
                marginTop: 4,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "rgba(255,255,255,0.9)",
                color: "#111",
              }}
            />
          </label>

          <label style={{ fontSize: 14 }}>
            Password
            <input
              type="password"
              required
              placeholder="Create a password"
              style={{
                width: "100%",
                marginTop: 4,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "rgba(255,255,255,0.9)",
                color: "#111",
              }}
            />
          </label>

          <button
            type="submit"
            style={{
              marginTop: 8,
              padding: "10px 14px",
              borderRadius: 8,
              border: "none",
              background: "#047857",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Sign up
          </button>
        </form>

        <p
          style={{
            marginTop: 16,
            fontSize: 14,
            color: "#111",
          }}
        >
          Already have an account?{" "}
          <Link
            href="/login"
            style={{
              color: "#047857",
              textDecoration: "underline",
              fontWeight: 500,
            }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
