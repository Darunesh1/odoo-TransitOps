import React, { useState, useEffect } from "react";
import { userService } from "../services/userService";
import { UserRead, UserRole, UserFilters } from "../types/user";
import { useAuth } from "../contexts/AuthContext";
import { getErrorMessage } from "../utils/errors";
import {
  User as UserIcon,
  Shield,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
  UserCheck,
  UserX,
  AlertCircle,
  Lock,
} from "lucide-react";

const getRoleLabel = (role: string) => {
  switch (role) {
    case "ADMIN":
      return "Admin";
    case "FLEET_MANAGER":
      return "Fleet Manager";
    case "DISPATCHER":
      return "Dispatcher";
    case "SAFETY_OFFICER":
      return "Safety Officer";
    case "FINANCIAL_ANALYST":
      return "Financial Analyst";
    default:
      return role;
  }
};

const ALL_ROLES: UserRole[] = [
  "ADMIN",
  "FLEET_MANAGER",
  "DISPATCHER",
  "SAFETY_OFFICER",
  "FINANCIAL_ANALYST",
];

const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  useEffect(() => {
    const handleThemeChange = () => {
      setTheme(localStorage.getItem("theme") || "light");
    };
    window.addEventListener("themeChanged", handleThemeChange);
    window.addEventListener("storage", handleThemeChange);
    return () => {
      window.removeEventListener("themeChanged", handleThemeChange);
      window.removeEventListener("storage", handleThemeChange);
    };
  }, []);

  const isDark = theme === "dark";

  // ─── State ──────────────────────────────────────────────
  const [users, setUsers] = useState<UserRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [filters, setFilters] = useState<UserFilters>({
    search: "",
    role: "",
    is_active: "",
  });

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRolesModal, setShowRolesModal] = useState(false);
  
  const [selectedUser, setSelectedUser] = useState<UserRead | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form States
  const [addForm, setAddForm] = useState({
    email: "",
    password: "",
    full_name: "",
    roles: [] as UserRole[],
  });

  const [editForm, setEditForm] = useState({
    email: "",
    full_name: "",
  });

  const [rolesForm, setRolesForm] = useState<UserRole[]>([]);

  // ─── API Actions ────────────────────────────────────────
  const loadUsers = async (currentFilters = filters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await userService.getUsers({
        search: currentFilters.search || undefined,
        role: currentFilters.role || undefined,
        is_active: currentFilters.is_active === "" ? undefined : currentFilters.is_active === true,
      });
      setUsers(data);
    } catch (err: any) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.role, filters.is_active]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsers();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addForm.roles.length === 0) {
      alert("At least one role must be selected.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await userService.createUser(addForm);
      setShowAddModal(false);
      setAddForm({ email: "", password: "", full_name: "", roles: [] });
      await loadUsers();
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);
    setError(null);
    try {
      await userService.updateUser(selectedUser.id, editForm);
      setShowEditModal(false);
      setSelectedUser(null);
      await loadUsers();
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: UserRead) => {
    if (user.id === currentUser?.id) {
      alert("You cannot deactivate your own account.");
      return;
    }
    const confirmMsg = user.is_active
      ? `Deactivate ${user.full_name}'s account? The user will not be able to log in.`
      : `Reactivate ${user.full_name}'s account?`;
    if (!window.confirm(confirmMsg)) return;

    setError(null);
    try {
      if (user.is_active) {
        await userService.deactivateUser(user.id);
      } else {
        await userService.activateUser(user.id);
      }
      await loadUsers();
    } catch (err: any) {
      setError(getErrorMessage(err));
    }
  };

  const handleUpdateRoles = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (rolesForm.length === 0) {
      alert("A user must have at least one role.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const originalRoles = selectedUser.roles;
      
      // Find roles to add
      const rolesToAdd = rolesForm.filter((r) => !originalRoles.includes(r));
      // Find roles to remove
      const rolesToRemove = originalRoles.filter((r) => !rolesForm.includes(r));

      // Execute role additions
      if (rolesToAdd.length > 0) {
        await userService.addUserRoles(selectedUser.id, rolesToAdd);
      }
      // Execute role removals
      for (const role of rolesToRemove) {
        await userService.removeUserRole(selectedUser.id, role);
      }

      setShowRolesModal(false);
      setSelectedUser(null);
      await loadUsers();
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Theme Colors ───────────────────────────────────────
  const colors = {
    bg: isDark ? "#111827" : "#f9fafb",
    cardBg: isDark ? "#1f2937" : "#ffffff",
    border: isDark ? "#374151" : "#e2e8f0",
    text: isDark ? "#f9fafb" : "#0f172a",
    textMuted: isDark ? "#9ca3af" : "#475569",
    inputBg: isDark ? "#374151" : "#ffffff",
    inputBorder: isDark ? "#4b5563" : "#e2e8f0",
    tableHeaderBg: isDark ? "#1f2937" : "#f8fafc",
    modalOverlay: "rgba(0, 0, 0, 0.5)",
  };

  return (
    <div
      style={{
        padding: "24px",
        backgroundColor: colors.bg,
        minHeight: "100vh",
        color: colors.text,
        transition: "background-color 0.3s, color 0.3s",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <style>{`
        .user-table th {
          padding: 12px 16px;
          font-weight: 600;
          font-size: 13px;
          color: ${colors.textMuted};
          text-align: left;
          border-bottom: 1px solid ${colors.border};
          background-color: ${colors.tableHeaderBg};
        }
        .user-table td {
          padding: 16px;
          font-size: 14px;
          border-bottom: 1px solid ${colors.border};
        }
        .btn-action {
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid ${colors.border};
          font-size: 13px;
          font-weight: 500;
          background: transparent;
          color: ${colors.text};
          cursor: pointer;
          transition: background-color 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .btn-action:hover {
          background-color: ${isDark ? "#374151" : "#f1f5f9"};
        }
        .btn-primary {
          padding: 10px 16px;
          background-color: #2563eb;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .btn-primary:hover {
          background-color: #1d4ed8;
        }
        .role-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          margin-right: 4px;
          margin-bottom: 4px;
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: 0 }}>User Management</h1>
          <p style={{ margin: "4px 0 0 0", color: colors.textMuted, fontSize: "14px" }}>
            Add, update, deactivate, and manage roles for fleet operations accounts.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={18} /> Add User
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{ padding: 16, backgroundColor: isDark ? "#7f1d1d" : "#fee2e2", color: isDark ? "#fca5a5" : "#b91c1c", borderRadius: 8, marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div style={{ display: "flex", gap: 12, padding: 16, backgroundColor: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        <form onSubmit={handleSearchSubmit} style={{ flex: 1, minWidth: "260px", display: "flex", gap: 8 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={18} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: colors.textMuted }} />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={filters.search}
              onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
              style={{
                width: "100%",
                padding: "10px 12px 10px 38px",
                border: `1px solid ${colors.inputBorder}`,
                borderRadius: 8,
                fontSize: "14px",
                backgroundColor: colors.inputBg,
                color: colors.text,
                outline: "none",
              }}
            />
          </div>
          <button type="submit" className="btn-action" style={{ padding: "10px 16px" }}>Search</button>
        </form>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {/* Role Filter */}
          <select
            value={filters.role}
            onChange={(e) => setFilters((p) => ({ ...p, role: e.target.value as any }))}
            style={{
              padding: "10px 12px",
              border: `1px solid ${colors.inputBorder}`,
              borderRadius: 8,
              fontSize: "14px",
              backgroundColor: colors.inputBg,
              color: colors.text,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="">All Roles</option>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>{getRoleLabel(r)}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filters.is_active === "" ? "" : filters.is_active ? "active" : "inactive"}
            onChange={(e) => {
              const val = e.target.value;
              setFilters((p) => ({
                ...p,
                is_active: val === "" ? "" : val === "active",
              }));
            }}
            style={{
              padding: "10px 12px",
              border: `1px solid ${colors.inputBorder}`,
              borderRadius: 8,
              fontSize: "14px",
              backgroundColor: colors.inputBg,
              color: colors.text,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button
            className="btn-action"
            style={{ padding: "10px 16px" }}
            onClick={() => {
              setFilters({ search: "", role: "", is_active: "" });
              loadUsers({ search: "", role: "", is_active: "" });
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "64px" }}>
          <RefreshCw size={24} className="animate-spin" style={{ color: colors.textMuted }} />
          <span style={{ marginLeft: 8, color: colors.textMuted }}>Loading users...</span>
        </div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px", backgroundColor: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12 }}>
          <UserIcon size={48} style={{ color: colors.textMuted, margin: "0 auto 16px" }} />
          <h3 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>No users found</h3>
          <p style={{ color: colors.textMuted, fontSize: "14px", marginTop: 4 }}>
            Try adjusting your search criteria or register a new user.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto", backgroundColor: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12 }}>
          <table className="user-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.full_name}</div>
                    {u.is_superuser && (
                      <span style={{ fontSize: "11px", backgroundColor: "#3b82f615", color: "#3b82f6", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>
                        Superuser
                      </span>
                    )}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    {u.roles.map((role) => (
                      <span
                        key={role}
                        className="role-badge"
                        style={{
                          backgroundColor:
                            role === "ADMIN"
                              ? "#ef444415"
                              : role === "FLEET_MANAGER"
                              ? "#3b82f615"
                              : role === "DISPATCHER"
                              ? "#10b98115"
                              : "#a855f715",
                          color:
                            role === "ADMIN"
                              ? "#ef4444"
                              : role === "FLEET_MANAGER"
                              ? "#3b82f6"
                              : role === "DISPATCHER"
                              ? "#10b981"
                              : "#a855f7",
                        }}
                      >
                        {getRoleLabel(role)}
                      </span>
                    ))}
                  </td>
                  <td>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontWeight: 600,
                        fontSize: "13px",
                        color: u.is_active ? "#10b981" : "#ef4444",
                      }}
                    >
                      {u.is_active ? <CheckCircle size={16} /> : <XCircle size={16} />}
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        className="btn-action"
                        onClick={() => {
                          setSelectedUser(u);
                          setEditForm({ email: u.email, full_name: u.full_name });
                          setShowEditModal(true);
                        }}
                      >
                        <Edit2 size={14} /> Edit
                      </button>

                      <button
                        className="btn-action"
                        onClick={() => {
                          setSelectedUser(u);
                          setRolesForm([...u.roles]);
                          setShowRolesModal(true);
                        }}
                      >
                        <Shield size={14} /> Roles
                      </button>

                      <button
                        className="btn-action"
                        style={{
                          borderColor: u.is_active ? "#ef444430" : "#10b98130",
                          color: u.is_active ? "#ef4444" : "#10b981",
                        }}
                        disabled={u.id === currentUser?.id}
                        onClick={() => handleToggleStatus(u)}
                      >
                        {u.is_active ? (
                          <>
                            <UserX size={14} /> Deactivate
                          </>
                        ) : (
                          <>
                            <UserCheck size={14} /> Activate
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── ADD USER MODAL ────────────────────────────────── */}
      {showAddModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.modalOverlay, display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24, width: "100%", maxWidth: "500px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 16px 0" }}>Register New Operational Account</h2>
            
            <form onSubmit={handleCreateUser} style={{ display: "grid", gap: 16 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: "13px", fontWeight: 600 }}>Full Name</span>
                <input
                  type="text"
                  required
                  value={addForm.full_name}
                  onChange={(e) => setAddForm((p) => ({ ...p, full_name: e.target.value }))}
                  placeholder="e.g. John Doe"
                  style={{ padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: 6, backgroundColor: colors.inputBg, color: colors.text, outline: "none" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: "13px", fontWeight: 600 }}>Email Address</span>
                <input
                  type="email"
                  required
                  value={addForm.email}
                  onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="e.g. johndoe@company.com"
                  style={{ padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: 6, backgroundColor: colors.inputBg, color: colors.text, outline: "none" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: "13px", fontWeight: 600 }}>Password</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={addForm.password}
                  onChange={(e) => setAddForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="At least 8 characters..."
                  style={{ padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: 6, backgroundColor: colors.inputBg, color: colors.text, outline: "none" }}
                />
              </label>

              <div>
                <span style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: 8 }}>Operational Roles</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {ALL_ROLES.map((role) => {
                    const isChecked = addForm.roles.includes(role);
                    return (
                      <label key={role} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "13px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setAddForm((p) => ({
                              ...p,
                              roles: isChecked
                                ? p.roles.filter((r) => r !== role)
                                : [...p.roles, role],
                            }));
                          }}
                        />
                        {getRoleLabel(role)}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={submitting}>
                  {submitting ? "Creating User..." : "Register User"}
                </button>
                <button
                  type="button"
                  className="btn-action"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT USER MODAL ────────────────────────────────── */}
      {showEditModal && selectedUser && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.modalOverlay, display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24, width: "100%", maxWidth: "450px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 16px 0" }}>Update Account Profile</h2>
            
            <form onSubmit={handleUpdateUser} style={{ display: "grid", gap: 16 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: "13px", fontWeight: 600 }}>Full Name</span>
                <input
                  type="text"
                  required
                  value={editForm.full_name}
                  onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))}
                  style={{ padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: 6, backgroundColor: colors.inputBg, color: colors.text, outline: "none" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: "13px", fontWeight: 600 }}>Email Address</span>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                  style={{ padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: 6, backgroundColor: colors.inputBg, color: colors.text, outline: "none" }}
                />
              </label>

              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={submitting}>
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  className="btn-action"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedUser(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── ROLES MANAGEMENT MODAL ─────────────────────────── */}
      {showRolesModal && selectedUser && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.modalOverlay, display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24, width: "100%", maxWidth: "450px", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 4px 0" }}>Manage Operational Roles</h2>
            <p style={{ margin: "0 0 16px 0", color: colors.textMuted, fontSize: "13px" }}>
              Configure system roles for <strong>{selectedUser.full_name}</strong>.
            </p>

            <form onSubmit={handleUpdateRoles} style={{ display: "grid", gap: 16 }}>
              <div style={{ display: "grid", gap: 12 }}>
                {ALL_ROLES.map((role) => {
                  const isChecked = rolesForm.includes(role);
                  return (
                    <label
                      key={role}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: 12,
                        borderRadius: 8,
                        border: `1px solid ${colors.border}`,
                        backgroundColor: isChecked ? (isDark ? "#2563eb15" : "#2563eb08") : "transparent",
                        cursor: "pointer",
                        fontWeight: isChecked ? 600 : 500,
                        fontSize: "14px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setRolesForm((p) =>
                            isChecked ? p.filter((r) => r !== role) : [...p, role]
                          );
                        }}
                      />
                      {getRoleLabel(role)}
                    </label>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={submitting}>
                  {submitting ? "Updating Roles..." : "Save Roles"}
                </button>
                <button
                  type="button"
                  className="btn-action"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => {
                    setShowRolesModal(false);
                    setSelectedUser(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
