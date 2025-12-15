"use client";

import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type AdminSidebarProps = {
  active: "overview" | "users" | "courses" | "activity";
  fullName: string | null;
  email: string | null;

  // mobile dropdown support
  isOpen?: boolean;
  onNavClick?: () => void;
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
  isOpen = false,
  onNavClick,
}: AdminSidebarProps) {
  const router = useRouter();

  const displayName = fullName || "Admin User";
  const displayEmail = email || "admin@anchorp.com";

  const itemClass = (key: AdminSidebarProps["active"]) =>
    key === active ? "nav-item nav-item-active" : "nav-item";

  const closeMenu = () => onNavClick?.();

  const go = (path: string) => {
    closeMenu();
    router.push(path);
  };

  const hardLogout = async () => {
    // ✅ close menu immediately so overlay can’t block taps
    closeMenu();

    // 1) Try normal sign out (global clears other devices too)
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (e) {
      console.error("signOut error:", e);
    }

    // 2) Remove persisted auth tokens (helps on mobile)
    try {
      if (typeof window !== "undefined") {
        const ls = window.localStorage;
        const ss = window.sessionStorage;

        for (let i = ls.length - 1; i >= 0; i--) {
          const k = ls.key(i);
          if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) ls.removeItem(k);
        }
        for (let i = ss.length - 1; i >= 0; i--) {
          const k = ss.key(i);
          if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) ss.removeItem(k);
        }
      }
    } catch (e) {
      console.error("storage clear error:", e);
    }

    // 3) Hard redirect (cache bust prevents “flash back in”)
    window.location.replace(`/login?logout=1&t=${Date.now()}`);
  };

  return (
    <div className={`admin-sidebar ${isOpen ? "admin-sidebar-open" : ""}`}>
      <aside className="sidebar">
        {/* ✕ Close button (mobile only) */}
        <button
          type="button"
          className="sidebar-close-button"
          onClick={closeMenu}
          aria-label="Close menu"
        >
          ✕
        </button>

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
          <button type="button" className={itemClass("overview")} onClick={() => go("/admin")}>
            Overview
          </button>

          <button type="button" className={itemClass("users")} onClick={() => go("/admin/users")}>
            Users &amp; Roles
          </button>

          <button type="button" className={itemClass("courses")} onClick={() => go("/admin/courses")}>
            Courses &amp; Enrollments
          </button>

          <button type="button" className={itemClass("activity")} onClick={() => go("/admin/activity")}>
            Activity &amp; Progress
          </button>
        </nav>

        {/* Logout */}
        <div className="sidebar-footer" style={{ marginTop: "auto" }}>
          <div className="sidebar-footer-title">Account</div>
          <button type="button" className="nav-item" onClick={hardLogout}>
            Log out
          </button>
        </div>
      </aside>
    </div>
  );
}
