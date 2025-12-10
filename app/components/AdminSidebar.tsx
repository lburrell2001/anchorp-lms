"use client";

import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type AdminSidebarProps = {
  active: "overview" | "users" | "courses" | "activity";
  fullName: string | null;
  email: string | null;
};

function getInitials(name: string | null | undefined) {
  if (!name) return "AU";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (
    parts[0].charAt(0).toUpperCase() +
    parts[parts.length - 1].charAt(0).toUpperCase()
  );
}

export default function AdminSidebar({
  active,
  fullName,
  email,
}: AdminSidebarProps) {
  const router = useRouter();

  const displayName = fullName || "Admin User";
  const displayEmail = email || "admin@anchorp.com";

  const itemClass = (key: AdminSidebarProps["active"]) =>
    key === active ? "nav-item nav-item-active" : "nav-item";

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error signing out", err);
    } finally {
      router.replace("/login");
    }
  };

  return (
    <aside className="sidebar">
      {/* Admin identity */}
      <div className="sidebar-profile">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="avatar-circle">{getInitials(displayName)}</div>
          <div>
            <div className="profile-name">{displayName}</div>
            <div className="profile-email">{displayEmail}</div>
            <div
              style={{
                fontSize: 11,
                marginTop: 4,
                color: "#9ce2bb",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Admin Console
            </div>
          </div>
        </div>
      </div>

      {/* Admin navigation */}
      <nav className="sidebar-nav">
        <button
          type="button"
          className={itemClass("overview")}
          onClick={() => router.push("/admin")}
        >
          Overview
        </button>

        <button
          type="button"
          className={itemClass("users")}
          onClick={() => router.push("/admin/users")}
        >
          Users &amp; Roles
        </button>

        <button
          type="button"
          className={itemClass("courses")}
          onClick={() => router.push("/admin/courses")}
        >
          Courses &amp; Enrollments
        </button>

        <button
          type="button"
          className={itemClass("activity")}
          onClick={() => router.push("/admin/activity")}
        >
          Activity &amp; Progress
        </button>
      </nav>

      {/* Logout */}
      <div className="sidebar-footer" style={{ marginTop: "auto" }}>
        <div className="sidebar-footer-title">Account</div>
        <button type="button" className="nav-item" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </aside>
  );
}
