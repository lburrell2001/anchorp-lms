"use client";

import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type AdminSidebarProps = {
  active: "overview" | "users" | "courses" | "activity";
  fullName: string | null;
  email: string | null;

  // mobile dropdown support
  isOpen?: boolean;        // ✅ controls slide-down wrapper
  onNavClick?: () => void; // ✅ closes menu (optional)
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
    closeMenu();          // ✅ close first (prevents overlay/tap weirdness)
    router.push(path);
  };

  const handleLogout = async () => {
    // ✅ close menu immediately so overlay can’t block taps
    closeMenu();

    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.error("Error signing out:", error.message);
    } catch (err) {
      console.error("Unexpected error signing out:", err);
    } finally {
      // ✅ more reliable than setting href (esp. on mobile)
      window.location.assign("/login");
    }
  };

  return (
    // ✅ wrapper matches your mobile CSS approach (like .app-sidebar)
    <div className={`admin-sidebar ${isOpen ? "admin-sidebar-open" : ""}`}>
      <aside className="sidebar">
        {/* Close button (mobile only) */}
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
          <button type="button" className="nav-item" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>
    </div>
  );
}
