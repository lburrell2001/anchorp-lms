"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Profile = {
  id: string;
  role: string | null;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, send them to the correct place
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
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // get user + profile role
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Login failed. Please try again.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select<Profile>("id, role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error(profileError);
    }

    if (profile?.role === "admin") {
      router.replace("/admin");
    } else {
      router.replace("/dashboard");
    }

    setLoading(false);
  };

  return (
    <div className="auth-background login-page">
      <div className="login-card">
        <h1>Log in</h1>

        {error && (
          <p style={{ color: "#b91c1c", marginBottom: 12, fontSize: 13 }}>
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit}>
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="login-extra">
          Don’t have an account?{" "}
          <a href="/signup">
            Sign up
          </a>
        </div>
      </div>
    </div>
  );
}
