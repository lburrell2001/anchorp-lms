"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";


export default function LoginPageClient() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // ensure profile row exists
        if (data.user) {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            full_name: data.user.email ?? "User",
          });
        }

        router.push("/dashboard");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            full_name: data.user.email ?? "User",
          });
        }

        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
        color: "#fff",
      }}
    >
      <div
        style={{
          width: 360,
          padding: 32,
          borderRadius: 16,
          border: "1px solid #333",
          background: "#111",
        }}
      >
        <h1 style={{ marginBottom: 8 }}>AnchorP LMS</h1>
        <p style={{ marginBottom: 20, color: "#aaa" }}>
          {mode === "login" ? "Log in to your account" : "Create a new account"}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={{ fontSize: 14 }}>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                marginTop: 4,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #333",
                background: "#000",
                color: "#fff",
              }}
            />
          </label>

          <label style={{ fontSize: 14 }}>
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                marginTop: 4,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #333",
                background: "#000",
                color: "#fff",
              }}
            />
          </label>

          {error && (
            <p style={{ color: "tomato", fontSize: 14, marginTop: 4 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              padding: "10px 14px",
              borderRadius: 8,
              border: "none",
              background: "#4dff98",
              color: "#000",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {loading
              ? "Working..."
              : mode === "login"
              ? "Log In"
              : "Sign Up"}
          </button>
        </form>

        <button
          type="button"
          onClick={() =>
            setMode((m) => (m === "login" ? "signup" : "login"))
          }
          style={{
            marginTop: 16,
            background: "transparent",
            border: "none",
            color: "#aaa",
            fontSize: 14,
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          {mode === "login"
            ? "Need an account? Sign up"
            : "Already have an account? Log in"}
        </button>
      </div>
    </main>
  );
}
