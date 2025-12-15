"use client";

import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type SidebarKey =
  | "dashboard"
  | "my-courses"
  | "all-courses"
  | "certificates"
  | "reports"
  | "settings"
  | "lessons";

type SidebarProps = {
  active: SidebarKey;
  fullName: string | null;
  email: string | null;
  locale?: "en" | "es";

  // ✅ mobile dropdown support
  isOpen?: boolean;
  onNavClick?: () => void; // should setSidebarOpen(false)
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
  isOpen = false,
  onNavClick,
}: SidebarProps) {
  const router = useRouter();

  const displayName = fullName || "Learner";
  const displayEmail = email || "";
  const initials = getInitials(fullName);

  const navItems: { key: SidebarKey; label: string; href: string }[] = [
    { key: "dashboard", label: "Dashboard", href: "/dashboard" },
    { key: "my-courses", label: "My Courses", href: "/my-courses" },
    { key: "all-courses", label: "All Courses", href: "/courses" },
    { key: "certificates", label: "Certificates", href: "/certificates" },
    { key: "reports", label: "Reports", href: "/reports" },
  ];

  const itemClass = (key: SidebarKey) =>
    key === active ? "nav-item nav-item-active" : "nav-item";

  const closeMenu = () => onNavClick?.();

  const go = (href: string) => {
    closeMenu();            // ✅ close first
    router.push(href);
  };

  const handleLogout = async () => {
    closeMenu();            // ✅ close first so overlay never blocks taps
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.assign("/login");
    }
  };

  return (
    // ✅ wrapper that your CSS animates
    <div className={`app-sidebar ${isOpen ? "app-sidebar-open" : ""}`}>
      <aside className="sidebar">
        {/* ✅ X close button */}
        <button
          type="button"
          className="sidebar-close-button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            closeMenu();
          }}
          aria-label="Close menu"
        >
          ✕
        </button>

        <div className="sidebar-profile">
          <div className="avatar-circle">{initials}</div>
          <div>
            <div className="profile-name">{displayName}</div>
            {displayEmail && <div className="profile-email">{displayEmail}</div>}
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={itemClass(item.key)}
              onClick={() => go(item.href)}
            >
              {item.label}
            </button>
          ))}
        </nav>

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
