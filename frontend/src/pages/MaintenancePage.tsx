import React, { useEffect, useState } from "react";
import { maintenanceService } from "../services/maintenanceService";
import { vehicleService } from "../services/vehicleService";
import { Maintenance, MaintenanceCreate, MaintenanceStatus } from "../types/maintenance";
import { Vehicle, VehicleStatus } from "../types/vehicle";

const MaintenancePage: React.FC = () => {
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
  const [logs, setLogs] = useState<Maintenance[]>([]);
  const [vehiclesMap, setVehiclesMap] = useState<Record<string, Vehicle>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);

  // Search filter
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [vehicleFilter, setVehicleFilter] = useState<string>("");
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingLog, setEditingLog] = useState<Maintenance | null>(null);
  const [formData, setFormData] = useState<MaintenanceCreate>({
    vehicle_id: "",
    maintenance_type: "",
    description: "",
    cost: 0,
    started_at: new Date().toISOString().slice(0, 16),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Mock Data Generator ────────────────────────────────
  const generateMockVehicles = (): Vehicle[] => {
    return [
      { id: "v1", name: "VAN-05", registration_number: "GJ01AB4521", max_load_capacity: 500, status: VehicleStatus.AVAILABLE, type: "Van", model: "Transit", capacity: "500 kg", domestic: 74000, acquisition_cost: 6200000 },
      { id: "v2", name: "TRUCK-11", registration_number: "GJ01AB9191", max_load_capacity: 5000, status: VehicleStatus.AVAILABLE, type: "Truck", model: "FH", capacity: "5 Ton", domestic: 182000, acquisition_cost: 24500000 },
      { id: "v3", name: "MINI-03", registration_number: "GJ01AB1120", max_load_capacity: 1000, status: VehicleStatus.IN_SHOP, type: "Mini", model: "Ace", capacity: "1 Ton", domestic: 66000, acquisition_cost: 4100000 },
    ];
  };

  const generateMockLogs = (): Maintenance[] => {
    const now = new Date().toISOString();
    return [
      {
        id: "m1",
        vehicle_id: "v1",
        maintenance_type: "Oil Change",
        description: "Regular oil and filter replacement",
        cost: 2500,
        status: MaintenanceStatus.ACTIVE,
        started_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        completed_at: undefined,
        created_by: "user1",
        created_at: now,
        updated_at: now,
      },
      {
        id: "m2",
        vehicle_id: "v2",
        maintenance_type: "Engine Repair",
        description: "Overhaul engine due to overheating",
        cost: 18000,
        status: MaintenanceStatus.COMPLETED,
        started_at: new Date(Date.now() - 86400000 * 10).toISOString(),
        completed_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        created_by: "user1",
        created_at: now,
        updated_at: now,
      },
      {
        id: "m3",
        vehicle_id: "v3",
        maintenance_type: "Tire Replacement",
        description: "Replace all 4 tires",
        cost: 6200,
        status: MaintenanceStatus.ACTIVE,
        started_at: new Date(Date.now() - 86400000).toISOString(),
        completed_at: undefined,
        created_by: "user1",
        created_at: now,
        updated_at: now,
      },
    ];
  };

  // ─── Load Data ──────────────────────────────────────────
  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    setUsingMockData(false);

    try {
      // Try to fetch real data – search term is passed to the backend
      const [logsData, allVehicles] = await Promise.all([
        maintenanceService.getMaintenanceLogs({
          search: searchTerm || undefined,
          status: statusFilter ? (statusFilter as any) : undefined,
          maintenance_type: typeFilter || undefined,
          vehicle_id: vehicleFilter || undefined,
          start_date: startDateFilter || undefined,
          end_date: endDateFilter || undefined,
          limit: 100,
        }),
        vehicleService.getVehicles({ limit: 100 }),
      ]);

      const vMap: Record<string, Vehicle> = {};
      allVehicles.forEach((v) => (vMap[v.id] = v));
      setVehiclesMap(vMap);

      const enriched = logsData.map((log) => ({
        ...log,
        vehicle: vMap[log.vehicle_id],
      }));
      setLogs(enriched);
      setUsingMockData(false);
    } catch (err: any) {
      console.error("Error loading maintenance logs:", err);
      setError(err.response?.data?.detail || "Failed to load maintenance logs from API.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, statusFilter, typeFilter, vehicleFilter, startDateFilter, endDateFilter]);

  // ─── Form Handlers ──────────────────────────────────────
  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "cost" ? Number(value) : value,
    }));
  };

  const openModal = (log?: Maintenance) => {
    if (log) {
      setEditingLog(log);
      setFormData({
        vehicle_id: log.vehicle_id,
        maintenance_type: log.maintenance_type,
        description: log.description || "",
        cost: log.cost,
        started_at: log.started_at.slice(0, 16),
      });
    } else {
      setEditingLog(null);
      setFormData({
        vehicle_id: "",
        maintenance_type: "",
        description: "",
        cost: 0,
        started_at: new Date().toISOString().slice(0, 16),
      });
    }
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingLog) {
        const updateData: any = {};
        if (formData.maintenance_type !== editingLog.maintenance_type) updateData.maintenance_type = formData.maintenance_type;
        if (formData.description !== editingLog.description) updateData.description = formData.description;
        if (formData.cost !== editingLog.cost) updateData.cost = formData.cost;
        if (formData.started_at !== editingLog.started_at.slice(0, 16)) updateData.started_at = formData.started_at;

        if (Object.keys(updateData).length > 0) {
          const updated = await maintenanceService.updateMaintenanceLog(editingLog.id, updateData);
          setLogs((prev) =>
            prev.map((l) => (l.id === updated.id ? { ...updated, vehicle: vehiclesMap[updated.vehicle_id] } : l))
          );
        }
      } else {
        const created = await maintenanceService.createMaintenanceLog(formData);
        setLogs((prev) => [{ ...created, vehicle: vehiclesMap[created.vehicle_id] }, ...prev]);
      }
      closeModal();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Complete / Cancel ──────────────────────────────────
  const handleComplete = async (id: string) => {
    if (!window.confirm("Complete this maintenance log? Vehicle will be set to AVAILABLE.")) return;
    try {
      const updated = await maintenanceService.completeMaintenanceLog(id);
      setLogs((prev) =>
        prev.map((l) => (l.id === updated.id ? { ...updated, vehicle: vehiclesMap[updated.vehicle_id] } : l))
      );
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to complete maintenance");
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm("Cancel this maintenance log? Vehicle will be set to AVAILABLE.")) return;
    try {
      const updated = await maintenanceService.cancelMaintenanceLog(id);
      setLogs((prev) =>
        prev.map((l) => (l.id === updated.id ? { ...updated, vehicle: vehiclesMap[updated.vehicle_id] } : l))
      );
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to cancel maintenance");
    }
  };

  // ─── Helpers ────────────────────────────────────────────
  const getStatusColor = (status: MaintenanceStatus) => {
    switch (status) {
      case MaintenanceStatus.ACTIVE:
        return "#f59e0b"; // orange
      case MaintenanceStatus.COMPLETED:
        return "#10b981"; // green
      case MaintenanceStatus.CANCELLED:
        return "#ef4444"; // red
      default:
        return "#6b7280";
    }
  };

  const getStatusDisplay = (status: MaintenanceStatus) => {
    switch (status) {
      case MaintenanceStatus.ACTIVE:
        return "In Shop";
      default:
        return status;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ─── Themed Colors ──────────────────────────────────────
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
        .maintenance-table tr:hover td { background-color: ${colors.hoverBg} !important; }
        .btn-primary:hover { background-color: #1d4ed8 !important; }
        .btn-secondary:hover { background-color: ${isDark ? "#4b5563" : "#e5e7eb"} !important; }
        .btn-success:hover { background-color: #059669 !important; }
        .btn-danger:hover { background-color: #dc2626 !important; }
        .modal-overlay { animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @media (max-width: 640px) {
          .maintenance-header { flex-direction: column; align-items: stretch; }
          .maintenance-filters { flex-direction: column; }
          .maintenance-table-wrap { overflow-x: auto; }
        }
      `}</style>

      {/* Header */}
      <div className="maintenance-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Maintenance</h1>
        <button className="btn-primary" style={{ padding: "10px 20px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", transition: "background-color 0.2s", boxShadow: "0 2px 6px rgba(37,99,235,0.25)" }} onClick={() => openModal()}>
          + New Maintenance
        </button>
      </div>

      {/* Filters */}
      <div className="maintenance-filters" style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "24px", alignItems: "center" }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: "200px" }}>
          <input
            type="text"
            placeholder="Search description, type, etc..."
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

        {/* Status Dropdown */}
        <div style={{ minWidth: "150px" }}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: `1px solid ${colors.inputBorder}`,
              borderRadius: "8px",
              fontSize: "14px",
              backgroundColor: colors.inputBg,
              color: colors.text,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Vehicle Dropdown */}
        <div style={{ minWidth: "180px" }}>
          <select
            value={vehicleFilter}
            onChange={(e) => setVehicleFilter(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: `1px solid ${colors.inputBorder}`,
              borderRadius: "8px",
              fontSize: "14px",
              backgroundColor: colors.inputBg,
              color: colors.text,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="">All Vehicles</option>
            {Object.values(vehiclesMap).map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.registration_number} - {vehicle.name}
              </option>
            ))}
          </select>
        </div>

        {/* Type Filter */}
        <div style={{ minWidth: "150px" }}>
          <input
            type="text"
            placeholder="Type (e.g. Engine)..."
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 16px",
              border: `1px solid ${colors.inputBorder}`,
              borderRadius: "8px",
              fontSize: "14px",
              backgroundColor: colors.inputBg,
              color: colors.text,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Start Date */}
        <div style={{ minWidth: "160px" }}>
          <input
            type="date"
            placeholder="Start date"
            value={startDateFilter}
            onChange={(e) => setStartDateFilter(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: `1px solid ${colors.inputBorder}`,
              borderRadius: "8px",
              fontSize: "14px",
              backgroundColor: colors.inputBg,
              color: colors.text,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* End Date */}
        <div style={{ minWidth: "160px" }}>
          <input
            type="date"
            placeholder="End date"
            value={endDateFilter}
            onChange={(e) => setEndDateFilter(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: `1px solid ${colors.inputBorder}`,
              borderRadius: "8px",
              fontSize: "14px",
              backgroundColor: colors.inputBg,
              color: colors.text,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <button
          className="btn-secondary"
          style={{
            padding: "10px 20px",
            backgroundColor: isDark ? "#374151" : "#f1f5f9",
            border: `1px solid ${colors.border}`,
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "background-color 0.2s",
            color: colors.text,
          }}
          onClick={() => {
            setSearchTerm("");
            setStatusFilter("");
            setVehicleFilter("");
            setTypeFilter("");
            setStartDateFilter("");
            setEndDateFilter("");
            loadAllData();
          }}
        >
          Clear
        </button>

        <button
          className="btn-secondary"
          style={{
            padding: "10px 20px",
            backgroundColor: isDark ? "#374151" : "#f1f5f9",
            border: `1px solid ${colors.border}`,
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "background-color 0.2s",
            color: colors.text,
          }}
          onClick={loadAllData}
        >
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: "12px 16px", backgroundColor: colors.errorBg, color: colors.errorText, borderRadius: "8px", marginBottom: "20px", fontSize: "14px" }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div className="maintenance-table-wrap" style={{ borderRadius: "12px", border: `1px solid ${colors.border}`, overflow: "hidden", backgroundColor: colors.cardBg, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <table className="maintenance-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", minWidth: "700px" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>Vehicle</th>
              <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>Service Type</th>
              <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>Cost</th>
              <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>Date</th>
              <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>Status</th>
              <th style={{ textAlign: "center", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: colors.textMuted }}>Loading...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: colors.textMuted }}>No maintenance logs found.</td>
              </tr>
            ) : (
              logs.map((log) => {
                const statusColor = getStatusColor(log.status);
                const statusDisplay = getStatusDisplay(log.status);
                const vehicle = vehiclesMap[log.vehicle_id];
                const vehicleDisplay = vehicle
                  ? `${vehicle.name} (${vehicle.registration_number})`
                  : log.vehicle_id.slice(0, 8);

                const isActive = log.status === MaintenanceStatus.ACTIVE;
                const canComplete = isActive;
                const canCancel = isActive;
                const canEdit = isActive;

                return (
                  <tr key={log.id}>
                    <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text, fontWeight: 500 }}>{vehicleDisplay}</td>
                    <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>{log.maintenance_type}</td>
                    <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>
                      {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(log.cost)}
                    </td>
                    <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>{formatDate(log.started_at)}</td>
                    <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>
                      <span
                        style={{
                          padding: "4px 12px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          fontWeight: 500,
                          display: "inline-block",
                          backgroundColor: statusColor + "20",
                          color: statusColor,
                        }}
                      >
                        {statusDisplay}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text, textAlign: "center" }}>
                      {canEdit && (
                        <button
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "4px", borderRadius: "4px", transition: "background-color 0.2s", opacity: 0.7 }}
                          onClick={() => openModal(log)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                      )}
                      {canComplete && (
                        <button
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "4px", borderRadius: "4px", transition: "background-color 0.2s", opacity: 0.7, marginLeft: 6, color: "#10b981" }}
                          onClick={() => handleComplete(log.id)}
                          title="Complete"
                        >
                          ✅
                        </button>
                      )}
                      {canCancel && (
                        <button
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "4px", borderRadius: "4px", transition: "background-color 0.2s", opacity: 0.7, marginLeft: 6, color: "#ef4444" }}
                          onClick={() => handleCancel(log.id)}
                          title="Cancel"
                        >
                          ❌
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

      {/* Note */}
      <div style={{ marginTop: "16px", fontSize: "13px", color: colors.textMuted, padding: "8px 0" }}>
        <strong>Note:</strong> In Shop vehicles are removed from the dispatch pool.
      </div>

      {/* Modal – LOG SERVICE RECORD */}
      {showModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15,23,42,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999, padding: "20px", backdropFilter: "blur(2px)" }}>
          <div style={{ backgroundColor: colors.cardBg, borderRadius: "16px", maxWidth: "500px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", padding: "24px", color: colors.text }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 600, margin: 0 }}>LOG SERVICE RECORD</h2>
              <button style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: colors.textMuted, padding: "0 4px" }} onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {!editingLog && (
                <div>
                  <label style={{ fontSize: "14px", fontWeight: 500 }}>Vehicle *</label>
                  <select
                    name="vehicle_id"
                    value={formData.vehicle_id}
                    onChange={handleFormChange}
                    required
                    style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none" }}
                  >
                    <option value="">Select vehicle</option>
                    {Object.values(vehiclesMap).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.registration_number})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>Service Type *</label>
                <input
                  type="text"
                  name="maintenance_type"
                  value={formData.maintenance_type}
                  onChange={handleFormChange}
                  required
                  style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>Cost (₹)</label>
                <input
                  type="number"
                  name="cost"
                  value={formData.cost}
                  onChange={handleFormChange}
                  min="0"
                  step="0.01"
                  style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>Date</label>
                <input
                  type="datetime-local"
                  name="started_at"
                  value={formData.started_at}
                  onChange={handleFormChange}
                  style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  rows={2}
                  style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none", resize: "vertical" }}
                />
              </div>
              {editingLog && (
                <div>
                  <label style={{ fontSize: "14px", fontWeight: 500 }}>Status</label>
                  <div
                    style={{
                      padding: "10px 12px",
                      border: `1px solid ${colors.inputBorder}`,
                      borderRadius: "8px",
                      backgroundColor: colors.inputBg,
                      color: colors.text,
                      fontSize: "14px",
                      opacity: 0.7,
                    }}
                  >
                    {getStatusDisplay(editingLog.status)}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px", paddingTop: "16px", borderTop: `1px solid ${colors.border}` }}>
                <button type="button" style={{ padding: "10px 20px", border: `1px solid ${colors.border}`, borderRadius: "8px", backgroundColor: "transparent", fontSize: "14px", fontWeight: 500, cursor: "pointer", color: colors.textMuted }} onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: "10px 24px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", boxShadow: "0 2px 6px rgba(37,99,235,0.25)" }} disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintenancePage;