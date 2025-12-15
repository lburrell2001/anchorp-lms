"use client";

import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type SidebarKey =
  | "dashboard"
  | "my-courses"
  | "all-courses"
  | "certificates"
  | "reports"
  | "settings";

type SidebarProps = {
  active: SidebarKey;
  fullName: string | null;
  email: string | null;
  locale?: "en" | "es";
  onNavClick?: () => void; // 🔹 NEW: called whenever a nav item is clicked
};

function getInitials(name: string | null | undefined) {
  if (!name) return "U";
  const parts = (name || "").trim().split(" ");
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (
    parts[0].charAt(0).toUpperCase() +
    parts[parts.length - 1].charAt(0).toUpperCase()
  );
}

export default function AppSidebar({
  active,
  fullName,
  email,
  onNavClick,
}: SidebarProps) {
  const router = useRouter();

  const displayName = fullName || "Learner";
  const displayEmail = email || "";
  const initials = getInitials(fullName);

  const navItems = [
    { key: "dashboard", label: "Dashboard", href: "/dashboard" },
    { key: "my-courses", label: "My Courses", href: "/my-courses" },
    { key: "all-courses", label: "All Courses", href: "/courses" },
    { key: "certificates", label: "Certificates", href: "/certificates" },
    { key: "reports", label: "Reports", href: "/reports" },
  ];

  const itemClass = (key: SidebarKey) =>
    key === active ? "nav-item nav-item-active" : "nav-item";

  const handleNavClick = (href: string) => {
    router.push(href);
    onNavClick?.();
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.assign("/login");
    }
  };

  return (
    <div className="app-sidebar app-sidebar-open">
      <aside className="sidebar">
        {/* ✕ Close button */}
        <button
          type="button"
          className="sidebar-close-button"
          onClick={() => onNavClick?.()}
          aria-label="Close menu"
        >
          ✕
        </button>

        {/* Profile */}
        <div className="sidebar-profile">
          <div className="avatar-circle">{initials}</div>
          <div>
            <div className="profile-name">{displayName}</div>
            {displayEmail && <div className="profile-email">{displayEmail}</div>}
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={itemClass(item.key)}
              onClick={() => handleNavClick(item.href)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer" style={{ marginTop: "auto" }}>
          <div className="sidebar-footer-title">Account</div>
          <button type="button" className="nav-item" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </aside>
    </div>
  );
}
