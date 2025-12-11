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

export default function AppSidebar({ active, fullName, email }: SidebarProps) {
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

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error signing out:", err);
    } finally {
      router.replace("/login");
    }
  };

  return (
    <aside className="sidebar">
      {/* Profile section */}
      <div className="sidebar-profile">
        <div className="avatar-circle">{initials}</div>
        <div>
          <div className="profile-name">{displayName}</div>
          {displayEmail && <div className="profile-email">{displayEmail}</div>}
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={itemClass(item.key)}
            onClick={() => router.push(item.href)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer" style={{ marginTop: "auto" }}>
        <div className="sidebar-footer-title">Account</div>

        <button
          type="button"
          className="nav-item"
          onClick={handleLogout}
        >
          Log Out
        </button>

        
      </div>
    </aside>
  );
}
