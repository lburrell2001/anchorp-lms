"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import AppSidebar from "../components/AppSidebar"; // ⬅️ shared sidebar

type UserSettings = {
  user_id: string;
  timezone: string | null;
  email_notifications: boolean;
  marketing_emails: boolean;
  theme: "light" | "dark" | "system" | string;
  locale: "en" | "es" | string;
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
  // LOAD SETTINGS (+ PROFILE FOR SIDEBAR)
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

      // ---- PROFILE FOR SIDEBAR ----
      const { data: existingProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, user_type")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      let profileRow = existingProfile as Profile | null;

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

      // ---- USER SETTINGS (unchanged) ----
      const { data, error: settingsError } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (settingsError) throw settingsError;

      if (data) {
        setSettings(data as UserSettings);
      } else {
        // defaults if no settings yet
        setSettings({
          user_id: user.id,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
          email_notifications: true,
          marketing_emails: false,
          theme: "system",
          locale: "en",
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
  // SAVE
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
      {/* SHARED SIDEBAR WITH REAL USER */}
      <AppSidebar active="settings" fullName={fullName} email={email} />

      {/* MAIN */}
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">Settings</div>
            <div className="topbar-subtitle">
              Control notifications, theme, language, and account preferences.
            </div>
          </div>
        </div>

        <section className="block">
          {loading && <p>Loading settings...</p>}

          {error && (
            <p
              style={{ marginBottom: 12, fontSize: "0.8rem", color: "#b91c1c" }}
            >
              {error}
            </p>
          )}

          {success && (
            <p
              style={{ marginBottom: 12, fontSize: "0.8rem", color: "#047857" }}
            >
              {success}
            </p>
          )}

          {!loading && settings && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Theme */}
              <div>
                <div
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    marginBottom: 4,
                    color: "#111827",
                  }}
                >
                  Theme
                </div>
                <p className="small-block-text" style={{ marginBottom: 8 }}>
                  Choose how the app looks on your device.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["system", "light", "dark"].map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      onClick={() =>
                        updateField("theme", theme as UserSettings["theme"])
                      }
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        border:
                          settings.theme === theme
                            ? "2px solid #047857"
                            : "1px solid #d1d5db",
                        backgroundColor:
                          settings.theme === theme ? "#ecfdf3" : "#fff",
                        fontSize: "0.8rem",
                        fontWeight: 500,
                        cursor: "pointer",
                        textTransform: "capitalize",
                      }}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language / locale */}
              <div>
                <div
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    marginBottom: 4,
                    color: "#111827",
                  }}
                >
                  Language
                </div>
                <p className="small-block-text" style={{ marginBottom: 8 }}>
                  Choose your preferred language for the LMS.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { code: "en", label: "English" },
                    { code: "es", label: "Español" },
                  ].map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() =>
                        updateField("locale", option.code as UserSettings["locale"])
                      }
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        border:
                          settings.locale === option.code
                            ? "2px solid #047857"
                            : "1px solid #d1d5db",
                        backgroundColor:
                          settings.locale === option.code ? "#ecfdf3" : "#fff",
                        fontSize: "0.8rem",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timezone */}
              <div>
                <div
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    marginBottom: 4,
                    color: "#111827",
                  }}
                >
                  Timezone
                </div>
                <p className="small-block-text" style={{ marginBottom: 8 }}>
                  Used for due dates, report ranges, and timestamps.
                </p>
                <input
                  type="text"
                  value={settings.timezone ?? ""}
                  onChange={(e) => updateField("timezone", e.target.value)}
                  placeholder="e.g. America/Chicago"
                  style={{
                    width: "100%",
                    maxWidth: 320,
                    padding: "6px 10px",
                    fontSize: "0.8rem",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                  }}
                />
              </div>

              {/* Email notifications */}
              <div>
                <div
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    marginBottom: 4,
                    color: "#111827",
                  }}
                >
                  Email notifications
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
                  Send me updates about course enrollments, completions, and
                  reminders.
                </label>
              </div>

              {/* Marketing / product updates */}
              <div>
                <div
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    marginBottom: 4,
                    color: "#111827",
                  }}
                >
                  Product updates &amp; tips
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
                  Send me learning tips, new course highlights, and product
                  updates.
                </label>
              </div>

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
