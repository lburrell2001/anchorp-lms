"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      // ✅ successful login – send them to dashboard (or wherever)
      router.push("/dashboard");
    } catch (err: any) {
      setErrorMsg(err.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-background">
      <div className="login-page">
        <div className="login-card">
          <h1>Log in</h1>

          {errorMsg && (
            <p
              style={{
                marginBottom: 16,
                color: "#b00020",
                fontSize: 14,
              }}
            >
              {errorMsg}
            </p>
          )}

          <form onSubmit={handleLogin}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p
            style={{
              marginTop: 16,
              fontSize: 14,
            }}
          >
            Don’t have an account?{" "}
            <a href="/signup" className="login-link">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
