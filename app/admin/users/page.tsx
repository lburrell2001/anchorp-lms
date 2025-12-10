"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AdminSidebar from "../../components/AdminSidebar";

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  user_type: "internal" | "external" | null;
  role: string | null;
  created_at?: string;
};

// role is now “whatever is in profiles.role”, but we still keep some known options
type RoleOption = "" | "admin" | "employee" | "potential_customer";

type InviteMode = null | "internal" | "external" | "admin";

export default function AdminUsersPage() {
  const router = useRouter();

  const [adminProfile, setAdminProfile] = useState<Profile | null>(null);
  const [loadingAdmin, setLoadingAdmin] = useState(true);

  const [users, setUsers] = useState<Profile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "internal" | "external">(
    "all"
  );

  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  // invite state
  const [inviteMode, setInviteMode] = useState<InviteMode>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  // ---------- LOAD ADMIN ----------
  useEffect(() => {
    const loadAdmin = async () => {
      setLoadingAdmin(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, user_type, role")
        .eq("id", session.user.id)
        .single();

      if (error || !data || data.role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      setAdminProfile(data as Profile);
      setLoadingAdmin(false);
    };

    loadAdmin();
  }, [router]);

  // ---------- LOAD USERS (NON-ADMINS) ----------
  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, user_type, role, created_at")
        .neq("role", "admin")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading users", error);
        setUsers([]);
      } else {
        setUsers((data || []) as Profile[]);
      }
      setLoadingUsers(false);
    };

    if (!loadingAdmin && adminProfile?.role === "admin") {
      loadUsers();
    }
  }, [adminProfile, loadingAdmin]);

  // ---------- ROLE UPDATE (writes directly to profiles.role) ----------
  const handleRoleChange = async (userId: string, newRole: RoleOption) => {
    setUpdatingUserId(userId);
    setUpdateMessage(null);

    const roleToSave = newRole === "" ? null : newRole;

    const { error } = await supabase
      .from("profiles")
      .update({ role: roleToSave })
      .eq("id", userId);

    if (error) {
      console.error("Error updating role", error);
      setUpdateMessage("Error updating role. Please try again.");
    } else {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                role: roleToSave,
              }
            : u
        )
      );
      setUpdateMessage("Role updated.");
      setTimeout(() => setUpdateMessage(null), 2500);
    }

    setUpdatingUserId(null);
  };

  // ---------- FILTERED USERS ----------
  const filteredUsers = users.filter((u) => {
    if (typeFilter !== "all" && u.user_type !== typeFilter) return false;

    const term = search.toLowerCase().trim();
    if (!term) return true;

    const name = (u.full_name || "").toLowerCase();
    const email = (u.email || "").toLowerCase();

    return name.includes(term) || email.includes(term);
  });

  // ---------- QUICK ACTION INVITES ----------
  const startInvite = (mode: InviteMode) => {
    setInviteMode(mode);
    setInviteEmail("");
    setInviteMessage(null);
  };

  const cancelInvite = () => {
    setInviteMode(null);
    setInviteEmail("");
    setInviteMessage(null);
  };

  const handleSendInvite = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inviteMode) return;

    if (!inviteEmail.trim()) {
      setInviteMessage("Please enter an email address.");
      return;
    }

    setSendingInvite(true);
    setInviteMessage(null);

    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";

      // user_type + role to attach to metadata
      const userType: "internal" | "external" =
        inviteMode === "external" ? "external" : "internal"; // admins are internal
      const role = inviteMode === "admin" ? "admin" : null;

      const redirectParams = new URLSearchParams({
        type: userType,
      });
      if (role) redirectParams.set("role", role);

      const redirectTo = `${origin}/signup?${redirectParams.toString()}`;

      const { error } = await supabase.auth.signInWithOtp({
        email: inviteEmail.trim(),
        options: {
          emailRedirectTo: redirectTo,
          data: {
            user_type: userType,
            role,
            invited_by: adminProfile?.id ?? null,
          },
        },
      });

      if (error) {
        console.error("Error sending invite", error);
        setInviteMessage(`Error sending invite: ${error.message}`);
      } else {
        const label =
          inviteMode === "internal"
            ? "internal"
            : inviteMode === "external"
            ? "external"
            : "admin";
        setInviteMessage(
          `Invite sent to ${inviteEmail.trim()} (${label} user).`
        );
        setInviteEmail("");
        setInviteMode(null);
      }
    } catch (err) {
      console.error("Error sending invite", err);
      setInviteMessage("Unexpected error sending invite.");
    } finally {
      setSendingInvite(false);
    }
  };

  // ---------- RENDER ----------

  if (loadingAdmin || !adminProfile) {
    return <div style={{ padding: 24 }}>Loading…</div>;
  }

  return (
    <div className="dashboard-root">
      <AdminSidebar
        active="users"
        fullName={adminProfile.full_name}
        email={adminProfile.email}
      />

      <div className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">Users &amp; Roles</div>
            <div className="topbar-subtitle">
              Manage internal and external learners, roles, and permissions.
            </div>
          </div>
        </div>

        <div className="content-grid">
          {/* LEFT: ALL USERS TABLE */}
          <div className="column-main">
            <div className="block">
              <div className="block-header">
                <div className="block-title">All Users (non-admin)</div>
              </div>

              {/* Search + filter row */}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginBottom: 12,
                  flexWrap: "wrap",
                }}
              >
                <input
                  type="text"
                  placeholder="Search name or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: 200,
                    padding: "8px 10px",
                    borderRadius: 999,
                    border: "1px solid #d1d5db",
                    fontSize: 13,
                  }}
                />

                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={
                      typeFilter === "all"
                        ? {}
                        : { background: "#e5e7eb", color: "#374151" }
                    }
                    onClick={() => setTypeFilter("all")}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={
                      typeFilter === "internal"
                        ? {}
                        : { background: "#e5e7eb", color: "#374151" }
                    }
                    onClick={() => setTypeFilter("internal")}
                  >
                    Internal
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={
                      typeFilter === "external"
                        ? {}
                        : { background: "#e5e7eb", color: "#374151" }
                    }
                    onClick={() => setTypeFilter("external")}
                  >
                    External
                  </button>
                </div>
              </div>

              {loadingUsers ? (
                <p className="small-block-text">Loading users…</p>
              ) : filteredUsers.length === 0 ? (
                <p className="small-block-text">
                  No users match the current filters.
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "8px 10px",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          Name
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "8px 10px",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          Email
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "8px 10px",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          Type
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "8px 10px",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          Role
                        </th>
                        <th
                          style={{
                            textAlign: "left",
                            padding: "8px 10px",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          Created
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u.id}>
                          <td
                            style={{
                              padding: "8px 10px",
                              borderBottom: "1px solid #e5e7eb",
                            }}
                          >
                            {u.full_name || "Unnamed user"}
                          </td>
                          <td
                            style={{
                              padding: "8px 10px",
                              borderBottom: "1px solid #e5e7eb",
                            }}
                          >
                            {u.email}
                          </td>
                          <td
                            style={{
                              padding: "8px 10px",
                              borderBottom: "1px solid #e5e7eb",
                              textTransform: "capitalize",
                            }}
                          >
                            {u.user_type || "—"}
                          </td>
                          <td
                            style={{
                              padding: "8px 10px",
                              borderBottom: "1px solid #e5e7eb",
                            }}
                          >
                            <select
                              value={(u.role as RoleOption) || ""}
                              onChange={(e) =>
                                handleRoleChange(
                                  u.id,
                                  e.target.value as RoleOption
                                )
                              }
                              disabled={updatingUserId === u.id}
                              style={{
                                fontSize: 12,
                                padding: "4px 6px",
                                borderRadius: 999,
                                border: "1px solid #d1d5db",
                                background: "#f9fafb",
                              }}
                            >
                              <option value="">No role</option>
                              <option value="employee">Employee</option>
                              <option value="potential_customer">
                                Potential customer
                              </option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td
                            style={{
                              padding: "8px 10px",
                              borderBottom: "1px solid #e5e7eb",
                              fontSize: 11,
                              color: "#6b7280",
                            }}
                          >
                            {u.created_at
                              ? new Date(u.created_at).toLocaleDateString()
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {updateMessage && (
                <p
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: updateMessage.includes("Error")
                      ? "#b91c1c"
                      : "#047857",
                  }}
                >
                  {updateMessage}
                </p>
              )}
            </div>
          </div>

          {/* RIGHT: QUICK ACTIONS + INVITE FORM */}
          <div className="column-side">
            <div className="block">
              <div className="block-header">
                <div className="block-title">Quick Actions</div>
              </div>
              <p className="small-block-text">
                Invite new learners or admins to Anchor Academy. They&apos;ll
                receive an email with a link to a pre-configured signup page.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => startInvite("internal")}
                >
                  Invite Internal Employee
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => startInvite("external")}
                >
                  Invite External Customer
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => startInvite("admin")}
                >
                  Invite Admin
                </button>
              </div>

              {inviteMode && (
                <form
                  onSubmit={handleSendInvite}
                  style={{
                    marginTop: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {inviteMode === "internal" && "Invite Internal Employee"}
                    {inviteMode === "external" && "Invite External Customer"}
                    {inviteMode === "admin" && "Invite Admin (internal)"}
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 999,
                      border: "1px solid #d1d5db",
                      fontSize: 13,
                    }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={sendingInvite}
                    >
                      {sendingInvite ? "Sending…" : "Send Invite"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={cancelInvite}
                      disabled={sendingInvite}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {inviteMessage && (
                <p
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    color: inviteMessage.startsWith("Error")
                      ? "#b91c1c"
                      : "#047857",
                  }}
                >
                  {inviteMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
