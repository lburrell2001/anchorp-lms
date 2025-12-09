"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient"; // ⬅️ adjust if needed

export default function SignupPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const fullName = `${firstName} ${lastName}`.trim();

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            full_name: fullName,
          },
        },
      });

      if (error) {
        throw error;
      }

      // You can show a "verify email" message here if you have email confirmations on.
      // For now, just push them to dashboard.
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Sign-up error:", err);
      setErrorMsg(err.message ?? "Failed to sign up. Please try again.");
    } finally {
      setLoading(false);
    }
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

        {errorMsg && (
          <p
            style={{
              marginBottom: 12,
              fontSize: 13,
              color: "#b91c1c",
            }}
          >
            {errorMsg}
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "1fr 1fr",
            }}
          >
            <label style={{ fontSize: 14 }}>
              First name
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Lauren"
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
              Last name
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Burrell"
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
          </div>

          <label style={{ fontSize: 14 }}>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            disabled={loading}
            style={{
              marginTop: 8,
              padding: "10px 14px",
              borderRadius: 8,
              border: "none",
              background: "#047857",
              color: "#fff",
              fontWeight: 600,
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.8 : 1,
            }}
          >
            {loading ? "Creating account..." : "Sign up"}
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
