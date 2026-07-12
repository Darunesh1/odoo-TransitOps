import React, { useEffect, useMemo, useState } from "react";
import api from "../api/axiosInstance";
import { maintenanceService } from "../services/maintenanceService";
import {
  MaintenanceCreateInput,
  MaintenanceFilters,
  MaintenanceRecord,
  MaintenanceStatus,
} from "../types/maintenance";

type VehicleLookup = {
  id: string;
  registration_number: string;
  name: string;
  vehicle_type: string;
  region?: string | null;
  status: string;
};

const getTheme = () => localStorage.getItem("theme") || "light";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toLocalDateTimeInput = (date = new Date()) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

const normalizeStatus = (value: string) => String(value).toUpperCase();

const getStatusColor = (status: MaintenanceStatus) => {
  switch (status) {
    case MaintenanceStatus.ACTIVE:
      return { bg: "#fef3c7", fg: "#92400e", border: "#fbbf24" };
    case MaintenanceStatus.COMPLETED:
      return { bg: "#dcfce7", fg: "#166534", border: "#22c55e" };
    case MaintenanceStatus.CANCELLED:
      return { bg: "#e5e7eb", fg: "#374151", border: "#9ca3af" };
    default:
      return { bg: "#e5e7eb", fg: "#374151", border: "#9ca3af" };
  }
};

const MaintenancePage: React.FC = () => {
  const [theme, setTheme] = useState(getTheme);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [vehicles, setVehicles] = useState<VehicleLookup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<MaintenanceFilters>({
    search: "",
    status: "",
    maintenance_type: "",
    vehicle_id: "",
    start_date: "",
    end_date: "",
  });
  const [formData, setFormData] = useState<MaintenanceCreateInput>({
    vehicle_id: "",
    maintenance_type: "",
    description: "",
    cost: 0,
    started_at: toLocalDateTimeInput(),
  });

  useEffect(() => {
    const handleThemeChange = () => {
      setTheme(getTheme());
    };

    window.addEventListener("themeChanged", handleThemeChange);
    window.addEventListener("storage", handleThemeChange);

    return () => {
      window.removeEventListener("themeChanged", handleThemeChange);
      window.removeEventListener("storage", handleThemeChange);
    };
  }, []);

  const isDark = theme === "dark";

  const colors = {
    bg: isDark ? "#111827" : "#f8fafc",
    surface: isDark ? "#1f2937" : "#ffffff",
    border: isDark ? "#374151" : "#e2e8f0",
    text: isDark ? "#f9fafb" : "#0f172a",
    muted: isDark ? "#9ca3af" : "#64748b",
    inputBg: isDark ? "#111827" : "#ffffff",
    inputBorder: isDark ? "#4b5563" : "#cbd5e1",
    hoverBg: isDark ? "#374151" : "#f8fafc",
    dangerBg: isDark ? "#7f1d1d" : "#fee2e2",
    dangerText: isDark ? "#fca5a5" : "#b91c1c",
  };

  const vehicleMap = useMemo(() => {
    return vehicles.reduce((acc, vehicle) => {
      acc[vehicle.id] = vehicle;
      return acc;
    }, {} as Record<string, VehicleLookup>);
  }, [vehicles]);

  const availableVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => normalizeStatus(vehicle.status) === "AVAILABLE");
  }, [vehicles]);

  const summary = useMemo(() => {
    const active = records.filter((record) => record.status === MaintenanceStatus.ACTIVE);
    return {
      total: records.length,
      active: active.length,
      completed: records.filter((record) => record.status === MaintenanceStatus.COMPLETED).length,
      cancelled: records.filter((record) => record.status === MaintenanceStatus.CANCELLED).length,
      activeCost: active.reduce((sum, record) => sum + Number(record.cost || 0), 0),
    };
  }, [records]);

  const loadVehicles = async () => {
    setLoadingVehicles(true);
    setVehicleError(null);
    try {
      const response = await api.get<VehicleLookup[]>("/vehicles/", {
        params: { skip: 0, limit: 500 },
      });
      setVehicles(response.data);
    } catch (err: any) {
      setVehicleError(err?.response?.data?.detail || "Failed to load vehicles");
    } finally {
      setLoadingVehicles(false);
    }
  };

  const loadMaintenance = async (currentFilters: MaintenanceFilters = filters) => {
    setLoading(true);
    setError(null);
    try {
      const response = await maintenanceService.getMaintenanceLogs({
        ...currentFilters,
        skip: 0,
        limit: 100,
      });
      setRecords(response);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to load maintenance records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadVehicles();
  }, []);

  useEffect(() => {
    void loadMaintenance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const refreshAll = async () => {
    await Promise.all([loadVehicles(), loadMaintenance()]);
  };

  const handleFilterChange = (field: keyof MaintenanceFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFormChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "cost" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        maintenance_type: formData.maintenance_type.trim(),
        description: formData.description?.trim() || undefined,
        cost: formData.cost,
        started_at: new Date(formData.started_at || new Date().toISOString()).toISOString(),
      };

      if (editingRecordId) {
        await maintenanceService.updateMaintenanceLog(editingRecordId, payload);
        handleCancelEdit();
      } else {
        await maintenanceService.createMaintenanceLog({
          ...payload,
          vehicle_id: formData.vehicle_id,
        });
        setFormData({
          vehicle_id: "",
          maintenance_type: "",
          description: "",
          cost: 0,
          started_at: toLocalDateTimeInput(),
        });
      }
      await refreshAll();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ||
          (editingRecordId
            ? "Failed to update maintenance record"
            : "Failed to create maintenance record")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseMaintenance = async (record: MaintenanceRecord) => {
    if (!window.confirm("Close this maintenance record and return the vehicle to service?")) {
      return;
    }

    setClosingId(record.id);
    setError(null);
    try {
      await maintenanceService.completeMaintenanceLog(record.id);
      await refreshAll();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to close maintenance record");
    } finally {
      setClosingId(null);
    }
  };

  const handleCancelMaintenance = async (record: MaintenanceRecord) => {
    if (!window.confirm("Cancel this maintenance record and return the vehicle to service?")) {
      return;
    }

    setCancellingId(record.id);
    setError(null);
    try {
      await maintenanceService.cancelMaintenanceLog(record.id);
      await refreshAll();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to cancel maintenance record");
    } finally {
      setCancellingId(null);
    }
  };

  const handleEditClick = (record: MaintenanceRecord) => {
    setEditingRecordId(record.id);
    let formattedStart = "";
    if (record.started_at) {
      try {
        const d = new Date(record.started_at);
        formattedStart = toLocalDateTimeInput(d);
      } catch (err) {
        console.error("Failed to format started_at date", err);
      }
    }
    setFormData({
      vehicle_id: record.vehicle_id,
      maintenance_type: record.maintenance_type,
      description: record.description || "",
      cost: record.cost,
      started_at: formattedStart || toLocalDateTimeInput(),
    });
  };

  const handleCancelEdit = () => {
    setEditingRecordId(null);
    setFormData({
      vehicle_id: "",
      maintenance_type: "",
      description: "",
      cost: 0,
      started_at: toLocalDateTimeInput(),
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "24px",
        background: colors.bg,
        color: colors.text,
        transition: "background-color 0.2s ease, color 0.2s ease",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { font-family: 'Inter', system-ui, sans-serif; box-sizing: border-box; }
        .maintenance-grid { display: grid; gap: 16px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .maintenance-layout { display: grid; gap: 20px; grid-template-columns: 1.25fr 0.95fr; align-items: start; }
        .maintenance-table tr:hover td { background-color: ${colors.hoverBg}; }
        .maintenance-card { border: 1px solid ${colors.border}; border-radius: 18px; background: ${colors.surface}; box-shadow: 0 8px 30px rgba(15, 23, 42, 0.06); }
        .maintenance-input, .maintenance-select, .maintenance-textarea {
          width: 100%;
          border: 1px solid ${colors.inputBorder};
          background: ${colors.inputBg};
          color: ${colors.text};
          border-radius: 12px;
          padding: 11px 12px;
          font-size: 14px;
          outline: none;
        }
        .maintenance-input:focus, .maintenance-select:focus, .maintenance-textarea:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
        }
        .maintenance-button {
          border: 0;
          border-radius: 12px;
          padding: 11px 14px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.15s ease, opacity 0.15s ease, background-color 0.15s ease;
        }
        .maintenance-button:hover { transform: translateY(-1px); }
        .maintenance-button:disabled { cursor: not-allowed; opacity: 0.65; transform: none; }
        @media (max-width: 1100px) {
          .maintenance-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .maintenance-layout { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .maintenance-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em" }}>
            Maintenance
          </h1>
          <p style={{ margin: "8px 0 0", color: colors.muted }}>
            Create maintenance records, monitor active work, and close jobs when vehicles return to service.
          </p>
        </div>
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 16,
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            minWidth: 220,
          }}
        >
          <div style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>Refresh status</div>
          <div style={{ fontWeight: 700 }}>{loading || loadingVehicles ? "Syncing data..." : "Ready"}</div>
        </div>
      </div>

      <div className="maintenance-grid" style={{ marginBottom: 24 }}>
        {[
          { label: "Total records", value: summary.total },
          { label: "Active jobs", value: summary.active },
          { label: "Completed", value: summary.completed },
          { label: "Active spend", value: formatMoney(summary.activeCost) },
        ].map((item) => (
          <div key={item.label} className="maintenance-card" style={{ padding: 18 }}>
            <div style={{ fontSize: 13, color: colors.muted, marginBottom: 8 }}>{item.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em" }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="maintenance-layout">
        <section className="maintenance-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Records</h2>
              <p style={{ margin: "6px 0 0", color: colors.muted }}>
                Backend-owned vehicle transitions keep dispatch availability in sync.
              </p>
            </div>
            <button
              type="button"
              className="maintenance-button"
              onClick={() => void refreshAll()}
              style={{ background: "#2563eb", color: "#fff" }}
            >
              Refresh
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <input
              className="maintenance-input"
              placeholder="Search maintenance type or description"
              value={filters.search ?? ""}
              onChange={(e) => handleFilterChange("search", e.target.value)}
            />
            <select
              className="maintenance-select"
              value={filters.status ?? ""}
              onChange={(e) => handleFilterChange("status", e.target.value)}
            >
              <option value="">All statuses</option>
              <option value={MaintenanceStatus.ACTIVE}>Active</option>
              <option value={MaintenanceStatus.COMPLETED}>Completed</option>
              <option value={MaintenanceStatus.CANCELLED}>Cancelled</option>
            </select>
            <input
              className="maintenance-input"
              placeholder="Maintenance type"
              value={filters.maintenance_type ?? ""}
              onChange={(e) => handleFilterChange("maintenance_type", e.target.value)}
            />
            <select
              className="maintenance-select"
              value={filters.vehicle_id ?? ""}
              onChange={(e) => handleFilterChange("vehicle_id", e.target.value)}
            >
              <option value="">All vehicles</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.registration_number} - {vehicle.name}
                </option>
              ))}
            </select>
            <input
              className="maintenance-input"
              type="date"
              value={filters.start_date ?? ""}
              onChange={(e) => handleFilterChange("start_date", e.target.value)}
            />
            <input
              className="maintenance-input"
              type="date"
              value={filters.end_date ?? ""}
              onChange={(e) => handleFilterChange("end_date", e.target.value)}
            />
          </div>

          {vehicleError && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                borderRadius: 12,
                background: colors.dangerBg,
                color: colors.dangerText,
              }}
            >
              {vehicleError}
            </div>
          )}

          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                borderRadius: 12,
                background: colors.dangerBg,
                color: colors.dangerText,
              }}
            >
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ padding: "24px 0", color: colors.muted }}>Loading maintenance records...</div>
          ) : records.length === 0 ? (
            <div
              style={{
                padding: "28px 20px",
                textAlign: "center",
                border: `1px dashed ${colors.border}`,
                borderRadius: 16,
                color: colors.muted,
              }}
            >
              No maintenance records match the current filters.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="maintenance-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: colors.muted, fontSize: 13 }}>
                    <th style={{ padding: "12px 10px" }}>Vehicle</th>
                    <th style={{ padding: "12px 10px" }}>Type</th>
                    <th style={{ padding: "12px 10px" }}>Cost</th>
                    <th style={{ padding: "12px 10px" }}>Started</th>
                    <th style={{ padding: "12px 10px" }}>Status</th>
                    <th style={{ padding: "12px 10px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => {
                    const vehicle = vehicleMap[record.vehicle_id];
                    const statusStyle = getStatusColor(record.status);
                    return (
                      <tr key={record.id} style={{ borderTop: `1px solid ${colors.border}` }}>
                        <td style={{ padding: "14px 10px", verticalAlign: "top" }}>
                          <div style={{ fontWeight: 700 }}>
                            {vehicle ? `${vehicle.registration_number} - ${vehicle.name}` : record.vehicle_id}
                          </div>
                          <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
                            {vehicle?.vehicle_type || "Vehicle"}
                            {vehicle?.region ? ` · ${vehicle.region}` : ""}
                          </div>
                        </td>
                        <td style={{ padding: "14px 10px", verticalAlign: "top" }}>
                          <div style={{ fontWeight: 600 }}>{record.maintenance_type}</div>
                          <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
                            {record.description || "No description provided"}
                          </div>
                        </td>
                        <td style={{ padding: "14px 10px", verticalAlign: "top", fontWeight: 600 }}>
                          {formatMoney(Number(record.cost || 0))}
                        </td>
                        <td style={{ padding: "14px 10px", verticalAlign: "top" }}>
                          <div style={{ fontWeight: 600 }}>{formatDateTime(record.started_at)}</div>
                          <div style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
                            Completed: {formatDateTime(record.completed_at)}
                          </div>
                        </td>
                        <td style={{ padding: "14px 10px", verticalAlign: "top" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "6px 10px",
                              borderRadius: 999,
                              background: statusStyle.bg,
                              color: statusStyle.fg,
                              border: `1px solid ${statusStyle.border}`,
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            {record.status}
                          </span>
                        </td>
                        <td style={{ padding: "14px 10px", verticalAlign: "top" }}>
                          {record.status === MaintenanceStatus.ACTIVE ? (
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                              <button
                                type="button"
                                className="maintenance-button"
                                onClick={() => handleEditClick(record)}
                                disabled={submitting || closingId === record.id || cancellingId === record.id}
                                style={{
                                  background: "#3b82f6",
                                  color: "#fff",
                                  padding: "6px 12px",
                                  borderRadius: "8px",
                                  fontSize: "13px",
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="maintenance-button"
                                onClick={() => void handleCloseMaintenance(record)}
                                disabled={submitting || closingId === record.id || cancellingId === record.id}
                                style={{
                                  background: "#16a34a",
                                  color: "#fff",
                                  padding: "6px 12px",
                                  borderRadius: "8px",
                                  fontSize: "13px",
                                }}
                              >
                                {closingId === record.id ? "Closing..." : "Complete"}
                              </button>
                              <button
                                type="button"
                                className="maintenance-button"
                                onClick={() => void handleCancelMaintenance(record)}
                                disabled={submitting || closingId === record.id || cancellingId === record.id}
                                style={{
                                  background: "#ef4444",
                                  color: "#fff",
                                  padding: "6px 12px",
                                  borderRadius: "8px",
                                  fontSize: "13px",
                                }}
                              >
                                {cancellingId === record.id ? "Cancelling..." : "Cancel"}
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: colors.muted, fontSize: 13 }}>No actions</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="maintenance-card" style={{ padding: 20 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
            {editingRecordId ? "Edit Maintenance" : "Create maintenance"}
          </h2>
          <p style={{ margin: "6px 0 20px", color: colors.muted }}>
            {editingRecordId
              ? "Updating details of an active maintenance job."
              : "Pick an available vehicle. The backend moves it to IN_SHOP when the record is created."}
          </p>

          {!editingRecordId && !loadingVehicles && availableVehicles.length === 0 && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                borderRadius: 12,
                background: "#fff7ed",
                color: "#9a3412",
              }}
            >
              No available vehicles found. Refresh after a vehicle returns from maintenance.
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "grid", gap: 14 }}>
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Vehicle</span>
              <select
                className="maintenance-select"
                name="vehicle_id"
                value={formData.vehicle_id}
                onChange={handleFormChange}
                required
                disabled={submitting || loadingVehicles || !!editingRecordId}
              >
                <option value="">Select vehicle</option>
                {editingRecordId ? (
                  (() => {
                    const vehicle = vehicleMap[formData.vehicle_id];
                    return vehicle ? (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.registration_number} - {vehicle.name}
                      </option>
                    ) : null;
                  })()
                ) : (
                  availableVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.registration_number} - {vehicle.name}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Maintenance type</span>
              <input
                className="maintenance-input"
                name="maintenance_type"
                value={formData.maintenance_type}
                onChange={handleFormChange}
                placeholder="Engine inspection, tire replacement, ..."
                required
                disabled={submitting}
              />
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Description</span>
              <textarea
                className="maintenance-textarea"
                name="description"
                value={formData.description || ""}
                onChange={handleFormChange}
                placeholder="Optional notes about the work performed"
                rows={4}
                disabled={submitting}
              />
            </label>

            <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Cost</span>
                <input
                  className="maintenance-input"
                  name="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.cost ?? 0}
                  onChange={handleFormChange}
                  disabled={submitting}
                />
              </label>

              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Started at</span>
                <input
                  className="maintenance-input"
                  name="started_at"
                  type="datetime-local"
                  value={formData.started_at}
                  onChange={handleFormChange}
                  required
                  disabled={submitting}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: 4 }}>
              <button
                type="submit"
                className="maintenance-button"
                disabled={
                  submitting ||
                  loadingVehicles ||
                  (!editingRecordId && availableVehicles.length === 0)
                }
                style={{
                  flex: 1,
                  background: "#2563eb",
                  color: "#fff",
                }}
              >
                {submitting
                  ? editingRecordId
                    ? "Saving..."
                    : "Creating..."
                  : editingRecordId
                  ? "Save Changes"
                  : "Create Maintenance"}
              </button>
              {editingRecordId && (
                <button
                  type="button"
                  className="maintenance-button"
                  onClick={handleCancelEdit}
                  disabled={submitting}
                  style={{
                    background: isDark ? "#374151" : "#e5e7eb",
                    color: colors.text,
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
};

export default MaintenancePage;
