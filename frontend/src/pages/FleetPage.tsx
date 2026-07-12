import React, { useEffect, useMemo, useState } from "react";
import { vehicleService } from "../services/vehicleService";
import { Vehicle, VehicleCreate, VehicleStatus } from "../types/vehicle";
import { getErrorMessage } from "../utils/errors";
import { useAuth } from "../contexts/AuthContext";

const FleetPage: React.FC = () => {
  const { user } = useAuth();
  const canEdit = !!user && (user.roles.includes("ADMIN") || user.roles.includes("FLEET_MANAGER") || user.is_superuser);

  // ─── Theme ──────────────────────────────────────────────
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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState<VehicleCreate & { odometer: number; region: string; status: VehicleStatus }>({
    registration_number: "",
    name: "",
    model: "",
    vehicle_type: "",
    max_load_capacity: 0,
    odometer: 0,
    acquisition_cost: 0,
    region: "",
    status: VehicleStatus.AVAILABLE,
  });

  // ─── Load Vehicles ──────────────────────────────────────
  const loadVehicles = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      params.skip = 0;
      params.limit = 100;
      const data = await vehicleService.getVehicles(params);
      setVehicles(data);
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || "Failed to load vehicles";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, [statusFilter]);

  // ─── Form Handlers ──────────────────────────────────────
  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "max_load_capacity" || name === "odometer" || name === "acquisition_cost" ? Number(value) : value,
    }));
  };

  const openModal = (vehicle?: Vehicle) => {
    if (vehicle) {
      setEditingVehicle(vehicle);
      setFormData({
        registration_number: vehicle.registration_number,
        name: vehicle.name,
        model: vehicle.model || "",
        vehicle_type: vehicle.vehicle_type,
        max_load_capacity: vehicle.max_load_capacity,
        odometer: vehicle.odometer || 0,
        acquisition_cost: vehicle.acquisition_cost,
        region: vehicle.region || "",
        status: vehicle.status,
      });
    } else {
      setEditingVehicle(null);
      setFormData({
        registration_number: "",
        name: "",
        model: "",
        vehicle_type: "",
        max_load_capacity: 0,
        odometer: 0,
        acquisition_cost: 0,
        region: "",
        status: VehicleStatus.AVAILABLE,
      });
    }
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingVehicle) {
        const updated = await vehicleService.updateVehicle(
          editingVehicle.id,
          formData
        );
        setVehicles((prev) =>
          prev.map((v) => (v.id === updated.id ? updated : v))
        );
      } else {
        const created = await vehicleService.createVehicle(formData);
        setVehicles((prev) => [created, ...prev]);
      }
      closeModal();
    } catch (err: any) {
      alert(getErrorMessage(err));
    }
  };

  const handleRetire = async (id: string) => {
    if (!window.confirm("Are you sure you want to retire this vehicle?")) return;
    try {
      const retired = await vehicleService.retireVehicle(id);
      setVehicles((prev) =>
        prev.map((v) => (v.id === retired.id ? retired : v))
      );
    } catch (err: any) {
      alert(getErrorMessage(err));
    }
  };

  // ─── Helpers ────────────────────────────────────────────
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: VehicleStatus) => {
    switch (status) {
      case VehicleStatus.AVAILABLE:
        return "#10b981";
      case VehicleStatus.ON_TRIP:
        return "#3b82f6";
      case VehicleStatus.IN_SHOP:
        return "#f59e0b";
      case VehicleStatus.RETIRED:
        return "#6b7280";
      default:
        return "#6b7280";
    }
  };

  // ─── Inline Styles (themed) ────────────────────────────
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

  const filteredVehicles = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return vehicles;
    return vehicles.filter((vehicle) => (
      vehicle.registration_number.toLowerCase().includes(term) ||
      vehicle.name.toLowerCase().includes(term) ||
      (vehicle.model || "").toLowerCase().includes(term) ||
      vehicle.vehicle_type.toLowerCase().includes(term) ||
      (vehicle.region || "").toLowerCase().includes(term)
    ));
  }, [searchTerm, vehicles]);

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
        .fleet-table tr:hover td { background-color: ${colors.hoverBg} !important; }
        .btn-primary:hover { background-color: #1d4ed8 !important; }
        .btn-secondary:hover { background-color: ${isDark ? "#4b5563" : "#e5e7eb"} !important; }
        .btn-danger:hover { background-color: #dc2626 !important; }
        .modal-overlay { animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @media (max-width: 640px) {
          .fleet-header { flex-direction: column; align-items: stretch; }
          .fleet-actions { flex-direction: column; }
          .fleet-table-wrap { overflow-x: auto; }
        }
      `}</style>

      {/* Header */}
      <div className="fleet-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Vehicle Registry</h1>
        {canEdit && (
          <button className="btn-primary" style={{ padding: "10px 20px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", transition: "background-color 0.2s", boxShadow: "0 2px 6px rgba(37,99,235,0.25)" }} onClick={() => openModal()}>
            + Add Vehicle
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="fleet-actions" style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "24px", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: "200px" }}>
          <input
            type="text"
            placeholder="Search by registration or name..."
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
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
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
            <option value={VehicleStatus.AVAILABLE}>Available</option>
            <option value={VehicleStatus.ON_TRIP}>On Trip</option>
            <option value={VehicleStatus.IN_SHOP}>In Shop</option>
            <option value={VehicleStatus.RETIRED}>Retired</option>
          </select>
          <button className="btn-secondary" style={{ padding: "10px 20px", backgroundColor: isDark ? "#374151" : "#f1f5f9", border: `1px solid ${colors.border}`, borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", transition: "background-color 0.2s", color: colors.text }} onClick={loadVehicles}>
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "12px 16px", backgroundColor: colors.errorBg, color: colors.errorText, borderRadius: "8px", marginBottom: "20px", fontSize: "14px" }}>
          {error}
          <br />
          <small>Check console for details. Make sure your token is valid and API is reachable.</small>
        </div>
      )}

      {/* Table */}
      <div className="fleet-table-wrap" style={{ borderRadius: "12px", border: `1px solid ${colors.border}`, overflow: "hidden", backgroundColor: colors.cardBg, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <table className="fleet-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", minWidth: "700px" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>REG. NO. (UNIQUE)</th>
              <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>NAME/MODEL</th>
              <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>TYPE</th>
              <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>CAPACITY</th>
              <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>ODOMETER</th>
              <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>REGION</th>
              <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>ACQ. COST</th>
              <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>STATUS</th>
              <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ padding: "32px", textAlign: "center", color: colors.textMuted }}>Loading...</td>
              </tr>
            ) : filteredVehicles.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: "32px", textAlign: "center", color: colors.textMuted }}>No vehicles found.</td>
              </tr>
            ) : (
              filteredVehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>{vehicle.registration_number}</td>
                  <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>
                    {vehicle.name} {vehicle.model ? `(${vehicle.model})` : ""}
                  </td>
                  <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>{vehicle.vehicle_type}</td>
                  <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>{vehicle.max_load_capacity} kg</td>
                  <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>{vehicle.odometer} km</td>
                  <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>{vehicle.region || "-"}</td>
                  <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>{formatCurrency(vehicle.acquisition_cost)}</td>
                  <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>
                    <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 500, display: "inline-block", backgroundColor: getStatusColor(vehicle.status) + "20", color: getStatusColor(vehicle.status) }}>
                      {vehicle.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text, textAlign: "right" }}>
                    {canEdit ? (
                      <>
                        <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "4px", borderRadius: "4px", transition: "background-color 0.2s", opacity: 0.7 }} onClick={() => openModal(vehicle)} title="Edit">✏️</button>
                        {vehicle.status !== VehicleStatus.RETIRED && (
                          <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "4px", borderRadius: "4px", transition: "background-color 0.2s", opacity: 0.7, marginLeft: 8 }} onClick={() => handleRetire(vehicle.id)} title="Retire">🗑️</button>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize: "12px", color: colors.textMuted }}>Read-Only</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Note */}
      <div style={{ marginTop: "16px", fontSize: "13px", color: colors.textMuted, padding: "8px 0" }}>
        <strong>Rule:</strong> Registration No. must be unique.{" "}
        <span>Retired/In Shop vehicles are hidden from Trip Dispatcher.</span>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15,23,42,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999, padding: "20px", backdropFilter: "blur(2px)" }}>
          <div style={{ backgroundColor: colors.cardBg, borderRadius: "16px", maxWidth: "500px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", padding: "24px", color: colors.text }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 600, margin: 0 }}>{editingVehicle ? "Edit Vehicle" : "Add New Vehicle"}</h2>
              <button style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: colors.textMuted, padding: "0 4px" }} onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>Registration Number *</label>
                <input type="text" name="registration_number" value={formData.registration_number} onChange={handleFormChange} required style={{ padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none", transition: "border-color 0.2s" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>Name *</label>
                <input type="text" name="name" value={formData.name} onChange={handleFormChange} required style={{ padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none", transition: "border-color 0.2s" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>Model</label>
                <input type="text" name="model" value={formData.model} onChange={handleFormChange} style={{ padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none", transition: "border-color 0.2s" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>Type *</label>
                <input type="text" name="vehicle_type" value={formData.vehicle_type} onChange={handleFormChange} required style={{ padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none", transition: "border-color 0.2s" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>Capacity (kg) *</label>
                <input type="number" name="max_load_capacity" value={formData.max_load_capacity} onChange={handleFormChange} required style={{ padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none", transition: "border-color 0.2s" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>Odometer (km) *</label>
                <input type="number" name="odometer" value={formData.odometer} onChange={handleFormChange} required style={{ padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none", transition: "border-color 0.2s" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>Region</label>
                <input type="text" name="region" value={formData.region} onChange={handleFormChange} style={{ padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none", transition: "border-color 0.2s" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>Acquisition Cost (INR) *</label>
                <input type="number" name="acquisition_cost" value={formData.acquisition_cost} onChange={handleFormChange} required style={{ padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none", transition: "border-color 0.2s" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>Status</label>
                <select name="status" value={formData.status} onChange={handleFormChange} style={{ padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none" }}>
                  <option value={VehicleStatus.AVAILABLE}>Available</option>
                  <option value={VehicleStatus.ON_TRIP}>On Trip</option>
                  <option value={VehicleStatus.IN_SHOP}>In Shop</option>
                  <option value={VehicleStatus.RETIRED}>Retired</option>
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px", paddingTop: "16px", borderTop: `1px solid ${colors.border}` }}>
                <button type="button" style={{ padding: "10px 20px", border: `1px solid ${colors.border}`, borderRadius: "8px", backgroundColor: "transparent", fontSize: "14px", fontWeight: 500, cursor: "pointer", color: colors.textMuted, transition: "background-color 0.2s" }} onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: "10px 24px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", transition: "background-color 0.2s", boxShadow: "0 2px 6px rgba(37,99,235,0.25)" }}>
                  {editingVehicle ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FleetPage;
