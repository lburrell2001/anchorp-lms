"use client";

import { useRouter } from "next/navigation";

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
    { key: "settings", label: "Settings", href: "/settings" },
  ];

  const itemClass = (key: SidebarKey) =>
    key === active ? "nav-item nav-item-active" : "nav-item";

  const handleNavClick = (href: string) => {
    router.push(href);
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
            onClick={() => handleNavClick(item.href)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer / small label */}
      <div className="sidebar-footer">
        <div className="sidebar-footer-title">AnchorP LMS</div>
      </div>
    </aside>
  );
}
