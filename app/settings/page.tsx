"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import AppSidebar from "../components/AppSidebar"; // shared sidebar

type UserSettings = {
  user_id: string;
  timezone: string | null;
  email_notifications: boolean;
  marketing_emails: boolean;
  theme?: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  user_type: "internal" | "external" | "both" | null;
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // --------------------------------------------------
  // LOAD SETTINGS + PROFILE
  // --------------------------------------------------
  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("You must be signed in to view settings.");

      // ---- PROFILE (for sidebar header) ----
      const { data: existingProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, user_type")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      let profileRow = existingProfile as Profile | null;

      // Create profile if missing
      if (!profileRow) {
        const email = user.email ?? "";
        const fullName =
          (user.user_metadata as any)?.full_name ||
          email.split("@")[0] ||
          "Learner";

        const defaultType: "internal" | "external" =
          email.toLowerCase().endsWith("@anchorp.com")
            ? "internal"
            : "external";

        const { data: inserted, error: insertError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            email,
            full_name: fullName,
            user_type: defaultType,
          })
          .select("id, full_name, email, user_type")
          .single();

        if (insertError) throw insertError;

        profileRow = inserted as Profile;
      }

      setProfile(profileRow);

      // ---- USER SETTINGS ----
      const { data, error: settingsError } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settingsError) throw settingsError;

      if (data) {
        setSettings({
          user_id: data.user_id,
          timezone: data.timezone ?? null,
          email_notifications: !!data.email_notifications,
          marketing_emails: !!data.marketing_emails,
        });
      } else {
        // Create default settings
        setSettings({
          user_id: user.id,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
          email_notifications: true,
          marketing_emails: false,
        });
      }
    } catch (e: any) {
      console.error("Error loading settings:", e);
      setError(e.message ?? "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // --------------------------------------------------
  // SAVE SETTINGS
  // --------------------------------------------------
  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: upsertError } = await supabase
        .from("user_settings")
        .upsert(settings, { onConflict: "user_id" });

      if (upsertError) throw upsertError;

      setSuccess("Settings saved.");
    } catch (e: any) {
      console.error("Error saving settings:", e);
      setError(e.message ?? "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const fullName = profile?.full_name ?? null;
  const email = profile?.email ?? null;

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------
  return (
    <div className="dashboard-root">
      <AppSidebar active="settings" fullName={fullName} email={email} />

      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">Settings</div>
            <div className="topbar-subtitle">
              Control notifications & account preferences.
            </div>
          </div>
        </div>

        <section className="block">
          {loading && <p>Loading settings...</p>}

          {error && (
            <p style={{ marginBottom: 12, fontSize: "0.8rem", color: "#b91c1c" }}>
              {error}
            </p>
          )}

          {success && (
            <p style={{ marginBottom: 12, fontSize: "0.8rem", color: "#047857" }}>
              {success}
            </p>
          )}

          {!loading && settings && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              

              {/* EMAIL NOTIFICATIONS */}
              <div>
                <div
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    marginBottom: 4,
                    color: "#111827",
                  }}
                >
                  Email Notifications
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: "0.8rem",
                    color: "#4b5563",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={settings.email_notifications}
                    onChange={(e) =>
                      updateField("email_notifications", e.target.checked)
                    }
                  />
                  Send me updates about enrollments, completions, and reminders.
                </label>
              </div>

              {/* MARKETING EMAILS */}
              <div>
                <div
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    marginBottom: 4,
                    color: "#111827",
                  }}
                >
                  Product Updates & Tips
                </div>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: "0.8rem",
                    color: "#4b5563",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={settings.marketing_emails}
                    onChange={(e) =>
                      updateField("marketing_emails", e.target.checked)
                    }
                  />
                  Send me learning tips, highlights, and product updates.
                </label>
              </div>

              {/* SAVE BUTTON */}
              <div style={{ marginTop: 12 }}>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 999,
                    border: "none",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    backgroundColor: "#047857",
                    color: "#fff",
                    cursor: saving ? "default" : "pointer",
                    opacity: saving ? 0.75 : 1,
                  }}
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
