'use client';

import Link from 'next/link';
import { FormEvent } from 'react';

export default function SignupPage() {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // TODO: hook this up to Supabase sign-up
  };

  return (
    <main className="auth-page">
      <section className="auth-card-wrapper">
        <div className="auth-card">
          <div className="auth-brand">AnchorP Academy</div>

          <h1 className="auth-title">Create account</h1>

          <button
            type="button"
            className="auth-social-button"
          >
            <span className="auth-social-icon">G</span>
            <span>Sign up with Google</span>
          </button>

          <div className="auth-divider">
            <span />
            <p>or sign up with email</p>
            <span />
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-label">
              Full name
              <input
                type="text"
                className="auth-input"
                placeholder="Omar Beyond"
                required
              />
            </label>

            <label className="auth-label">
              Email address
              <input
                type="email"
                className="auth-input"
                placeholder="omar@beyond.com"
                required
              />
            </label>

            <label className="auth-label">
              Password
              <input
                type="password"
                className="auth-input"
                placeholder="Create a password"
                required
              />
            </label>

            <button type="submit" className="auth-primary-button">
              Sign up
            </button>
          </form>

          <p className="auth-footer-text">
            Already have an account?{' '}
            <Link href="/login" className="auth-footer-link">
              Sign in
            </Link>
          </p>
        </div>
      </section>

      <section className="auth-hero" aria-hidden="true" />
    </main>
  );
}
