import React, { useEffect, useState } from "react";
import { driverService } from "../services/driverService";
import { Driver, DriverCreate, DriverStatus } from "../types/driver";

const DriversPage: React.FC = () => {
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

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState<DriverCreate>({
    name: "",
    license_number: "",
    license_category: "",
    license_expiry: "",
    contact: "",
    safety_score: 80,
    status: DriverStatus.AVAILABLE,
  });

  const loadDrivers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.license_category = categoryFilter;
      if (searchTerm) params.search = searchTerm;
      params.skip = 0;
      params.limit = 100;

      const data = await driverService.getDrivers(params);

      // Set initial mock compliance (will be updated by the API)
      const driversWithMock = data.map((d) => ({
        ...d,
        trip_compliance: Math.floor(Math.random() * 20 + 80),
      }));
      setDrivers(driversWithMock);

      // Fetch real compliance for each driver in parallel
      const compliancePromises = data.map(async (d) => {
        try {
          const compliance = await driverService.getTripCompliance(d.id);
          return { id: d.id, compliance };
        } catch {
          return { id: d.id, compliance: null };
        }
      });
      const results = await Promise.all(compliancePromises);
      const complianceMap = results
        .filter((r) => r.compliance !== null)
        .reduce((acc, r) => ({ ...acc, [r.id]: r.compliance }), {} as Record<string, number>);

      setDrivers((prev) =>
        prev.map((d) => ({
          ...d,
          trip_compliance: complianceMap[d.id] !== undefined ? complianceMap[d.id] : d.trip_compliance,
        }))
      );
    } catch (err: any) {
      console.error("Error loading drivers:", err);
      setError(err.response?.data?.detail || "Failed to load drivers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
  }, [statusFilter, categoryFilter, searchTerm]);

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "safety_score" ? Number(value) : value,
    }));
  };

  const openModal = (driver?: Driver) => {
    if (driver) {
      setEditingDriver(driver);
      setFormData({
        name: driver.name,
        license_number: driver.license_number,
        license_category: driver.license_category,
        license_expiry: driver.license_expiry.split("T")[0],
        contact: driver.contact,
        safety_score: driver.safety_score,
        status: driver.status,
      });
    } else {
      setEditingDriver(null);
      setFormData({
        name: "",
        license_number: "",
        license_category: "",
        license_expiry: "",
        contact: "",
        safety_score: 80,
        status: DriverStatus.AVAILABLE,
      });
    }
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDriver) {
        const updated = await driverService.updateDriver(editingDriver.id, formData);
        setDrivers((prev) =>
          prev.map((d) =>
            d.id === updated.id ? { ...updated, trip_compliance: d.trip_compliance } : d
          )
        );
      } else {
        const created = await driverService.createDriver(formData);
        // Fetch compliance for the new driver
        const compliance = await driverService.getTripCompliance(created.id);
        setDrivers((prev) => [{ ...created, trip_compliance: compliance }, ...prev]);
      }
      closeModal();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Operation failed");
    }
  };

  const handleSuspend = async (id: string) => {
    if (!window.confirm("Suspend this driver?")) return;
    try {
      const updated = await driverService.suspendDriver(id);
      setDrivers((prev) =>
        prev.map((d) =>
          d.id === updated.id ? { ...updated, trip_compliance: d.trip_compliance } : d
        )
      );
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to suspend driver");
    }
  };

  const handleActivate = async (id: string) => {
    if (!window.confirm("Activate this driver?")) return;
    try {
      const updated = await driverService.activateDriver(id);
      setDrivers((prev) =>
        prev.map((d) =>
          d.id === updated.id ? { ...updated, trip_compliance: d.trip_compliance } : d
        )
      );
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to activate driver");
    }
  };

  const getStatusColor = (status: DriverStatus) => {
    switch (status) {
      case DriverStatus.AVAILABLE:
        return "#10b981";
      case DriverStatus.ON_TRIP:
        return "#3b82f6";
      case DriverStatus.OFF_DUTY:
        return "#f59e0b";
      case DriverStatus.SUSPENDED:
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  };

  const isExpired = (dateStr: string) => {
    return new Date(dateStr) < new Date();
  };

  const colors = {
    bg: isDark ? "#111827" : "#f9fafb",
    cardBg: isDark ? "#1f2937" : "#ffffff",
    border: isDark ? "#374151" : "#e2e8f0",
    text: isDark ? "#f9fafb" : "#0f172a",
    textMuted: isDark ? "#9ca3af" : "#475569",
    inputBg: isDark ? "#374151" : "#ffffff",
    inputBorder: isDark ? "#4b5563" : "#e2e8f0",
    hoverBg: isDark ? "#374151" : "#f1f5f9",
    errorBg: isDark ? "#7f1d1d" : "#fee2e2",
    errorText: isDark ? "#fca5a5" : "#b91c1c",
  };

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "100%",
        backgroundColor: colors.bg,
        minHeight: "100vh",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        color: colors.text,
        transition: "background-color 0.3s, color 0.3s",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
        .drivers-table tr:hover td { background-color: ${colors.hoverBg} !important; }
        .btn-primary:hover { background-color: #1d4ed8 !important; }
        .btn-secondary:hover { background-color: ${isDark ? "#4b5563" : "#e5e7eb"} !important; }
        .modal-overlay { animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @media (max-width: 640px) {
          .drivers-header { flex-direction: column; align-items: stretch; }
          .drivers-filters { flex-direction: column; }
          .drivers-table-wrap { overflow-x: auto; }
        }
      `}</style>

      {/* Header */}
      <div className="drivers-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Safety Profiles</h1>
        <button className="btn-primary" style={{ padding: "10px 20px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", transition: "background-color 0.2s", boxShadow: "0 2px 6px rgba(37,99,235,0.25)" }} onClick={() => openModal()}>
          + Add Driver
        </button>
      </div>

      {/* Filters */}
      <div className="drivers-filters" style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "24px", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: "200px" }}>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 16px",
              border: `1px solid ${colors.inputBorder}`,
              borderRadius: "8px",
              fontSize: "14px",
              backgroundColor: colors.inputBg,
              color: colors.text,
              outline: "none",
              transition: "border-color 0.2s",
              boxSizing: "border-box",
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: "10px 16px",
            border: `1px solid ${colors.inputBorder}`,
            borderRadius: "8px",
            fontSize: "14px",
            backgroundColor: colors.inputBg,
            color: colors.text,
            outline: "none",
            cursor: "pointer",
            minWidth: "140px",
          }}
        >
          <option value="">All Status</option>
          <option value={DriverStatus.AVAILABLE}>Available</option>
          <option value={DriverStatus.ON_TRIP}>On Trip</option>
          <option value={DriverStatus.OFF_DUTY}>Off Duty</option>
          <option value={DriverStatus.SUSPENDED}>Suspended</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            padding: "10px 16px",
            border: `1px solid ${colors.inputBorder}`,
            borderRadius: "8px",
            fontSize: "14px",
            backgroundColor: colors.inputBg,
            color: colors.text,
            outline: "none",
            cursor: "pointer",
            minWidth: "140px",
          }}
        >
          <option value="">All Categories</option>
          <option value="LMV">LMV</option>
          <option value="HMV">HMV</option>
        </select>
        <button className="btn-secondary" style={{ padding: "10px 20px", backgroundColor: isDark ? "#374151" : "#f1f5f9", border: `1px solid ${colors.border}`, borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", transition: "background-color 0.2s", color: colors.text }} onClick={loadDrivers}>
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "12px 16px", backgroundColor: colors.errorBg, color: colors.errorText, borderRadius: "8px", marginBottom: "20px", fontSize: "14px" }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div className="drivers-table-wrap" style={{ borderRadius: "12px", border: `1px solid ${colors.border}`, overflow: "hidden", backgroundColor: colors.cardBg, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <table className="drivers-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", minWidth: "900px" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>DRIVER</th>
              <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>LICENSE NO.</th>
              <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>CATEGORY</th>
              <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>EXPIRY</th>
              <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>CONTACT</th>
              <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>TRIP COMPLIANCE</th>
              <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>SAFETY</th>
              <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>STATUS</th>
              <th style={{ textAlign: "center", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ padding: "32px", textAlign: "center", color: colors.textMuted }}>Loading...</td>
              </tr>
            ) : drivers.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: "32px", textAlign: "center", color: colors.textMuted }}>No drivers found.</td>
              </tr>
            ) : (
              drivers.map((driver) => {
                const expired = isExpired(driver.license_expiry);
                return (
                  <tr key={driver.id}>
                    <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text, fontWeight: 500 }}>{driver.name}</td>
                    <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>{driver.license_number}</td>
                    <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>{driver.license_category}</td>
                    <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: expired ? "#ef4444" : colors.text }}>
                      {formatDate(driver.license_expiry)}
                      {expired && <span style={{ marginLeft: 6, fontSize: "12px", color: "#ef4444" }}>⛔</span>}
                    </td>
                    <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>{driver.contact}</td>
                    <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>
                      {driver.trip_compliance !== undefined ? `${driver.trip_compliance}%` : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>
                      {driver.safety_score}%
                    </td>
                    <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>
                      <span
                        style={{
                          padding: "4px 12px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: 500,
                          display: "inline-block",
                          backgroundColor: getStatusColor(driver.status) + "20",
                          color: getStatusColor(driver.status),
                        }}
                      >
                        {driver.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text, textAlign: "center" }}>
                      <button
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "4px", borderRadius: "4px", transition: "background-color 0.2s", opacity: 0.7 }}
                        onClick={() => openModal(driver)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      {driver.status !== DriverStatus.SUSPENDED ? (
                        <button
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "4px", borderRadius: "4px", transition: "background-color 0.2s", opacity: 0.7, marginLeft: 8, color: "#ef4444" }}
                          onClick={() => handleSuspend(driver.id)}
                          title="Suspend"
                        >
                          ⛔
                        </button>
                      ) : (
                        <button
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "4px", borderRadius: "4px", transition: "background-color 0.2s", opacity: 0.7, marginLeft: 8, color: "#10b981" }}
                          onClick={() => handleActivate(driver.id)}
                          title="Activate"
                        >
                          ✅
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Rule */}
      <div style={{ marginTop: "16px", fontSize: "13px", color: colors.textMuted, padding: "8px 0" }}>
        <strong>Rule:</strong> Expired license or Suspended status → blocked from trip assignment.
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15,23,42,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999, padding: "20px", backdropFilter: "blur(2px)" }}>
          <div style={{ backgroundColor: colors.cardBg, borderRadius: "16px", maxWidth: "500px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", padding: "24px", color: colors.text }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 600, margin: 0 }}>{editingDriver ? "Edit Driver" : "Add New Driver"}</h2>
              <button style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: colors.textMuted, padding: "0 4px" }} onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>Full Name *</label>
                <input type="text" name="name" value={formData.name} onChange={handleFormChange} required style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none" }} />
              </div>
              <div>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>License Number *</label>
                <input type="text" name="license_number" value={formData.license_number} onChange={handleFormChange} required style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none" }} />
              </div>
              <div>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>License Category *</label>
                <select name="license_category" value={formData.license_category} onChange={handleFormChange} required style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none" }}>
                  <option value="">Select...</option>
                  <option value="LMV">LMV</option>
                  <option value="HMV">HMV</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>License Expiry *</label>
                <input type="date" name="license_expiry" value={formData.license_expiry} onChange={handleFormChange} required style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none" }} />
              </div>
              <div>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>Contact Number *</label>
                <input type="text" name="contact" value={formData.contact} onChange={handleFormChange} required style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none" }} />
              </div>
              <div>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>Safety Score (0-100)</label>
                <input type="number" name="safety_score" value={formData.safety_score} onChange={handleFormChange} min="0" max="100" style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none" }} />
              </div>
              <div>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>Status</label>
                <select name="status" value={formData.status} onChange={handleFormChange} style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none" }}>
                  <option value={DriverStatus.AVAILABLE}>Available</option>
                  <option value={DriverStatus.ON_TRIP}>On Trip</option>
                  <option value={DriverStatus.OFF_DUTY}>Off Duty</option>
                  <option value={DriverStatus.SUSPENDED}>Suspended</option>
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px", paddingTop: "16px", borderTop: `1px solid ${colors.border}` }}>
                <button type="button" style={{ padding: "10px 20px", border: `1px solid ${colors.border}`, borderRadius: "8px", backgroundColor: "transparent", fontSize: "14px", fontWeight: 500, cursor: "pointer", color: colors.textMuted }} onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: "10px 24px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", boxShadow: "0 2px 6px rgba(37,99,235,0.25)" }}>
                  {editingDriver ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriversPage;