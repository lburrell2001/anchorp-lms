// app/components/AppSidebar.tsx
"use client";

import { useRouter } from "next/navigation";

type SidebarProps = {
  active:
    | "dashboard"
    | "my-courses"
    | "all-courses"
    | "certificates"
    | "reports"
    | "settings"
    | "learning-paths"; // ⬅️ added
  fullName: string | null;
  email: string | null;
};


function getInitials(name: string | null | undefined) {
  if (!name) return "U";
  const parts = name.trim().split(" ");
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
}: SidebarProps) {
  const router = useRouter();

  const displayName = fullName || "Learner";
  const displayEmail = email || "";

  const itemClass = (key: SidebarProps["active"]) =>
    key === active ? "nav-item nav-item-active" : "nav-item";

  return (
    <aside className="sidebar">
      {/* profile header */}
      <div className="sidebar-profile">
        <div className="avatar-circle">{getInitials(displayName)}</div>
        <div>
          <div className="profile-name">{displayName}</div>
          <div className="profile-email">{displayEmail}</div>
        </div>
      </div>

      {/* main nav */}
      <nav className="sidebar-nav">
        <button
          className={itemClass("dashboard")}
          onClick={() => router.push("/dashboard")}
        >
          Dashboard
        </button>
        <button
          className={itemClass("my-courses")}
          onClick={() => router.push("/my-courses")}
        >
          My Courses
        </button>
        <button
          className={itemClass("all-courses")}
          onClick={() => router.push("/courses")}
        >
          All Courses
        </button>
        <button
          className={itemClass("certificates")}
          onClick={() => router.push("/certificates")}
        >
          Certificates
        </button>
        <button
          className={itemClass("reports")}
          onClick={() => router.push("/reports")}
        >
          Reports
        </button>
        <button
          className={itemClass("settings")}
          onClick={() => router.push("/settings")}
        >
          Settings
        </button>
      </nav>
    </aside>
  );
}
