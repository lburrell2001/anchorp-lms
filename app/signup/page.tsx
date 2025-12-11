"use client";

import { FormEvent, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Profile = {
  id: string;
  role: string | null;
};

type UserType = "internal" | "external";

/**
 * Inner signup component that actually uses hooks like useSearchParams.
 * This MUST be wrapped in <Suspense> in the default export.
 */
function SignupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // from invites: /signup?type=internal&role=admin
  const userTypeParam = (searchParams.get("type") as UserType) || "external";
  const roleParam = searchParams.get("role"); // can be "admin" or null

  // If already logged in (via magic-link), route based on profile.role
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select<Profile>("id, role")
        .eq("id", session.user.id)
        .single();

      if (profile?.role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/dashboard");
      }
    };

    checkSession();
  }, [router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    // 1) create auth user with metadata
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName,
          user_type: userTypeParam,
          role: roleParam ?? null,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const sessionUser = data.user;

    // 2) upsert into profiles (in case you don’t already have a trigger)
    if (sessionUser) {
      await supabase.from("profiles").upsert(
        {
          id: sessionUser.id,
          full_name: fullName,
          email: sessionUser.email,
          user_type: userTypeParam,
          role: roleParam ?? null,
        },
        { onConflict: "id" }
      );
    }

    // 3) If there is an active session, redirect now by role
    if (data.session && data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select<Profile>("id, role")
        .eq("id", data.user.id)
        .single();

      if (profile?.role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/dashboard");
      }
    } else {
      // email confirmation / magic-link flow
      setMessage(
        "Check your email for a link to confirm your account and sign in."
      );
    }

    setLoading(false);
  };

  return (
    <div className="auth-background login-page">
      <div className="login-card">
        <h1>Create your account</h1>

        <p style={{ fontSize: 13, marginBottom: 16, color: "#4b5563" }}>
          You’re signing up as{" "}
          <strong>
            {userTypeParam === "internal"
              ? "Internal Employee"
              : "External Customer"}
          </strong>
          {roleParam === "admin" && " (Admin)"}.
        </p>

        {error && (
          <p style={{ color: "#b91c1c", marginBottom: 12, fontSize: 13 }}>
            {error}
          </p>
        )}
        {message && (
          <p style={{ color: "#047857", marginBottom: 12, fontSize: 13 }}>
            {message}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <label htmlFor="full-name">Full name</label>
          <input
            id="full-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />

          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <div className="login-extra">
          Already have an account?{" "}
          <a href="/login">
            Log in
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Default export: wraps inner signup page in Suspense.
 * This fixes the "useSearchParams should be wrapped in a suspense boundary" error.
 */
export default function SignupPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignupPageInner />
    </Suspense>
  );
}
