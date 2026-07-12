import React, { useEffect, useState } from "react";
import { fuelLogService } from "../services/fuelLogService";
import { expenseService } from "../services/expenseService";
import { vehicleService } from "../services/vehicleService";
import { tripService } from "../services/tripService"; // we'll create this if missing
import { FuelLog, FuelLogCreate } from "../types/fuelLog";
import { Expense, ExpenseCreate } from "../types/expense";
import { Vehicle, VehicleStatus } from "../types/vehicle";
import { Trip, TripStatus } from "../types/trip";

const FuelExpensesPage: React.FC = () => {
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
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vehiclesMap, setVehiclesMap] = useState<Record<string, Vehicle>>({});
  const [tripsMap, setTripsMap] = useState<Record<string, Trip>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"fuel" | "expense">("fuel");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({
    vehicle_id: "",
    trip_id: "",
    liters: "",
    cost: "",
    date: new Date().toISOString().slice(0, 10),
    odometer: "",
    expense_type: "",
    description: "",
    amount: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Mock Data Generators ──────────────────────────────
  const generateMockVehicles = (): Vehicle[] => {
    return [
      { id: "v1", name: "VAN-05", registration_number: "GJ01AB4521", max_load_capacity: 500, status: VehicleStatus.AVAILABLE, type: "Van", model: "Transit", capacity: "500 kg", domestic: 74000, acquisition_cost: 6200000 },
      { id: "v2", name: "TRUCK-11", registration_number: "GJ01AB9191", max_load_capacity: 5000, status: VehicleStatus.AVAILABLE, type: "Truck", model: "FH", capacity: "5 Ton", domestic: 182000, acquisition_cost: 24500000 },
      { id: "v3", name: "MINI-03", registration_number: "GJ01AB1120", max_load_capacity: 1000, status: VehicleStatus.AVAILABLE, type: "Mini", model: "Ace", capacity: "1 Ton", domestic: 66000, acquisition_cost: 4100000 },
    ];
  };

  const generateMockTrips = (): Trip[] => {
    return [
      { id: "t1", trip_number: "TRIP-000001", status: TripStatus.COMPLETED } as Trip,
      { id: "t2", trip_number: "TRIP-000002", status: TripStatus.DISPATCHED } as Trip,
      { id: "t3", trip_number: "TRIP-000003", status: TripStatus.DRAFT } as Trip,
    ];
  };

  const generateMockFuelLogs = (): FuelLog[] => {
    return [
      { id: "f1", vehicle_id: "v1", liters: 42, cost: 3150, date: "2026-07-05", odometer: 12345, created_by: "u1", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: "f2", vehicle_id: "v2", liters: 110, cost: 8400, date: "2026-07-06", odometer: 67890, created_by: "u1", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: "f3", vehicle_id: "v3", liters: 28, cost: 2050, date: "2026-07-06", odometer: 11223, created_by: "u1", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];
  };

  const generateMockExpenses = (): Expense[] => {
    return [
      { id: "e1", vehicle_id: "v1", trip_id: "t1", expense_type: "Toll", description: "Bridge toll", amount: 120, date: "2026-07-05", created_by: "u1", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: "e2", vehicle_id: "v1", trip_id: "t1", expense_type: "Other", description: "Cleaning", amount: 0, date: "2026-07-05", created_by: "u1", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: "e3", vehicle_id: "v2", trip_id: "t2", expense_type: "Toll", description: "Highway toll", amount: 340, date: "2026-07-06", created_by: "u1", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: "e4", vehicle_id: "v2", trip_id: "t2", expense_type: "Other", description: "Parking", amount: 150, date: "2026-07-06", created_by: "u1", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: "e5", vehicle_id: "v2", trip_id: "t2", expense_type: "Maintenance", description: "Oil change", amount: 18000, date: "2026-07-06", created_by: "u1", created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ];
  };

  // ─── Load Data ──────────────────────────────────────────
  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    setUsingMockData(false);

    try {
      const [fuelData, expenseData, vehicles, trips] = await Promise.all([
        fuelLogService.getFuelLogs({ limit: 200 }),
        expenseService.getExpenses({ limit: 200 }),
        vehicleService.getVehicles({ limit: 200 }),
        tripService.getTrips({ limit: 200 }).catch(() => []), // fallback if trips endpoint fails
      ]);

      const vMap: Record<string, Vehicle> = {};
      vehicles.forEach((v) => (vMap[v.id] = v));
      setVehiclesMap(vMap);

      const tMap: Record<string, Trip> = {};
      trips.forEach((t) => (tMap[t.id] = t));
      setTripsMap(tMap);

      setFuelLogs(fuelData);
      setExpenses(expenseData);
    } catch (err: any) {
      console.error("Error loading data, using mock:", err);
      // Use mock data
      const mockVehicles = generateMockVehicles();
      const mockTrips = generateMockTrips();
      const mockFuel = generateMockFuelLogs();
      const mockExp = generateMockExpenses();

      const vMap: Record<string, Vehicle> = {};
      mockVehicles.forEach((v) => (vMap[v.id] = v));
      setVehiclesMap(vMap);

      const tMap: Record<string, Trip> = {};
      mockTrips.forEach((t) => (tMap[t.id] = t));
      setTripsMap(tMap);

      setFuelLogs(mockFuel);
      setExpenses(mockExp);
      setUsingMockData(true);
      setError("⚠️ Backend unavailable – showing mock data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // ─── Filtering ──────────────────────────────────────────
  const filteredFuel = fuelLogs.filter((log) => {
    const vehicle = vehiclesMap[log.vehicle_id];
    const vehicleName = vehicle ? `${vehicle.name} (${vehicle.registration_number})` : log.vehicle_id;
    const search = searchTerm.toLowerCase();
    return (
      vehicleName.toLowerCase().includes(search) ||
      log.date.includes(search) ||
      log.liters.toString().includes(search) ||
      log.cost.toString().includes(search)
    );
  });

  // Group expenses by trip_id
  const groupedExpenses: { tripId: string | null; expenses: Expense[] }[] = [];
  const tripIds = [...new Set(expenses.map(e => e.trip_id || null))];
  tripIds.forEach((tripId) => {
    const exps = expenses.filter(e => (e.trip_id || null) === tripId);
    if (exps.length > 0) {
      groupedExpenses.push({ tripId, expenses: exps });
    }
  });

  // Filter grouped expenses by search (vehicle or type)
  const filteredGrouped = groupedExpenses.filter(group => {
    const vehicle = group.expenses[0] ? vehiclesMap[group.expenses[0].vehicle_id] : null;
    const vehicleName = vehicle ? `${vehicle.name} (${vehicle.registration_number})` : group.expenses[0]?.vehicle_id || '';
    const search = searchTerm.toLowerCase();
    return (
      vehicleName.toLowerCase().includes(search) ||
      group.expenses.some(e => e.expense_type.toLowerCase().includes(search)) ||
      group.tripId?.toLowerCase().includes(search) ||
      false
    );
  });

  // ─── Total Operational Cost ────────────────────────────
  const totalFuelCost = fuelLogs.reduce((sum, log) => sum + log.cost, 0);
  const maintenanceCost = expenses
    .filter((exp) => exp.expense_type.toLowerCase().includes("maintenance"))
    .reduce((sum, exp) => sum + exp.amount, 0);
  const totalOpCost = totalFuelCost + maintenanceCost;

  // ─── Modal Handlers ──────────────────────────────────────
  const openModal = (mode: "fuel" | "expense", data?: any) => {
    setModalMode(mode);
    if (data) {
      setEditingId(data.id);
      if (mode === "fuel") {
        setFormData({
          vehicle_id: data.vehicle_id,
          trip_id: data.trip_id || "",
          liters: data.liters,
          cost: data.cost,
          date: data.date,
          odometer: data.odometer || "",
          expense_type: "",
          description: "",
          amount: "",
        });
      } else {
        setFormData({
          vehicle_id: data.vehicle_id,
          trip_id: data.trip_id || "",
          expense_type: data.expense_type,
          description: data.description || "",
          amount: data.amount,
          date: data.date,
          liters: "",
          cost: "",
          odometer: "",
        });
      }
    } else {
      setEditingId(null);
      const defaultDate = new Date().toISOString().slice(0, 10);
      if (mode === "fuel") {
        setFormData({
          vehicle_id: "",
          trip_id: "",
          liters: "",
          cost: "",
          date: defaultDate,
          odometer: "",
          expense_type: "",
          description: "",
          amount: "",
        });
      } else {
        setFormData({
          vehicle_id: "",
          trip_id: "",
          expense_type: "",
          description: "",
          amount: "",
          date: defaultDate,
          liters: "",
          cost: "",
          odometer: "",
        });
      }
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (modalMode === "fuel") {
        const payload: FuelLogCreate = {
          vehicle_id: formData.vehicle_id,
          trip_id: formData.trip_id || undefined,
          liters: parseFloat(formData.liters),
          cost: parseFloat(formData.cost),
          date: formData.date,
          odometer: formData.odometer ? parseFloat(formData.odometer) : undefined,
        };
        if (editingId) {
          const updated = await fuelLogService.updateFuelLog(editingId, payload);
          setFuelLogs((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
        } else {
          const created = await fuelLogService.createFuelLog(payload);
          setFuelLogs((prev) => [created, ...prev]);
        }
      } else {
        const payload: ExpenseCreate = {
          vehicle_id: formData.vehicle_id,
          trip_id: formData.trip_id || undefined,
          expense_type: formData.expense_type,
          description: formData.description || undefined,
          amount: parseFloat(formData.amount),
          date: formData.date,
        };
        if (editingId) {
          const updated = await expenseService.updateExpense(editingId, payload);
          setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
        } else {
          const created = await expenseService.createExpense(payload);
          setExpenses((prev) => [created, ...prev]);
        }
      }
      closeModal();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, type: "fuel" | "expense") => {
    if (!window.confirm(`Delete this ${type} log?`)) return;
    try {
      if (type === "fuel") {
        await fuelLogService.deleteFuelLog(id);
        setFuelLogs((prev) => prev.filter((l) => l.id !== id));
      } else {
        await expenseService.deleteExpense(id);
        setExpenses((prev) => prev.filter((e) => e.id !== id));
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || "Delete failed");
    }
  };

  // ─── Helpers ────────────────────────────────────────────
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
  };

  const getStatusColor = (status?: TripStatus) => {
    if (!status) return "#6b7280";
    switch (status) {
      case TripStatus.COMPLETED: return "#10b981";
      case TripStatus.DISPATCHED: return "#3b82f6";
      case TripStatus.DRAFT: return "#9ca3af";
      case TripStatus.CANCELLED: return "#ef4444";
      default: return "#6b7280";
    }
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
        .btn-primary:hover { background-color: #1d4ed8 !important; }
        .btn-secondary:hover { background-color: ${isDark ? "#4b5563" : "#e5e7eb"} !important; }
        .btn-danger:hover { background-color: #dc2626 !important; }
        .modal-overlay { animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @media (max-width: 640px) {
          .page-header { flex-direction: column; align-items: stretch; }
          .table-wrap { overflow-x: auto; }
          .total-box { flex-direction: column; align-items: stretch; text-align: center; }
        }
      `}</style>

      {/* Header */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Fuel & Expenses</h1>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button className="btn-primary" style={{ padding: "10px 20px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", transition: "background-color 0.2s", boxShadow: "0 2px 6px rgba(37,99,235,0.25)" }} onClick={() => openModal("fuel")}>
            + Log Fuel
          </button>
          <button className="btn-secondary" style={{ padding: "10px 20px", backgroundColor: isDark ? "#374151" : "#f1f5f9", border: `1px solid ${colors.border}`, borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", transition: "background-color 0.2s", color: colors.text }} onClick={() => openModal("expense")}>
            + Add Expense
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: "24px" }}>
        <input
          type="text"
          placeholder="Search by vehicle, date, type..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            maxWidth: "400px",
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

      {/* Error / Mock banner */}
      {error && (
        <div style={{ padding: "12px 16px", backgroundColor: usingMockData ? colors.errorBg : colors.errorBg, color: colors.errorText, borderRadius: "8px", marginBottom: "20px", fontSize: "14px" }}>
          {error}
          {usingMockData && (
            <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.8 }}>
              Mock data is shown because the backend is unreachable.
            </div>
          )}
        </div>
      )}

      {/* Fuel Logs Table */}
      <div style={{ marginBottom: "40px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 12px 0" }}>Fuel Logs</h2>
        <div className="table-wrap" style={{ borderRadius: "12px", border: `1px solid ${colors.border}`, overflow: "hidden", backgroundColor: colors.cardBg, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", minWidth: "600px" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>Vehicle</th>
                <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>Date</th>
                <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>Liters</th>
                <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>Fuel Cost</th>
                <th style={{ textAlign: "center", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: "32px", textAlign: "center", color: colors.textMuted }}>Loading...</td></tr>
              ) : filteredFuel.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: "32px", textAlign: "center", color: colors.textMuted }}>No fuel logs found.</td></tr>
              ) : (
                filteredFuel.map((log) => {
                  const vehicle = vehiclesMap[log.vehicle_id];
                  const vehicleDisplay = vehicle ? `${vehicle.name} (${vehicle.registration_number})` : log.vehicle_id.slice(0, 8);
                  return (
                    <tr key={log.id}>
                      <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>{vehicleDisplay}</td>
                      <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>{formatDate(log.date)}</td>
                      <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>{log.liters} L</td>
                      <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>{formatCurrency(log.cost)}</td>
                      <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text, textAlign: "center" }}>
                        <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "4px", borderRadius: "4px", opacity: 0.7 }} onClick={() => openModal("fuel", log)} title="Edit">✏️</button>
                        <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "4px", borderRadius: "4px", opacity: 0.7, marginLeft: 6, color: "#ef4444" }} onClick={() => handleDelete(log.id, "fuel")} title="Delete">🗑️</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Other Expenses Table (Grouped by Trip) */}
      <div style={{ marginBottom: "40px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, margin: "0 0 12px 0" }}>Other Expenses (Toll / Misc)</h2>
        <div className="table-wrap" style={{ borderRadius: "12px", border: `1px solid ${colors.border}`, overflow: "hidden", backgroundColor: colors.cardBg, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", minWidth: "800px" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>Trip</th>
                <th style={{ textAlign: "left", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>Vehicle</th>
                <th style={{ textAlign: "right", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>Toll</th>
                <th style={{ textAlign: "right", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>Other</th>
                <th style={{ textAlign: "right", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>Maintenance (linked)</th>
                <th style={{ textAlign: "right", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>Total</th>
                <th style={{ textAlign: "center", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>Status</th>
                <th style={{ textAlign: "center", padding: "12px 16px", backgroundColor: isDark ? "#1f2937" : "#f8fafc", color: colors.textMuted, fontWeight: 600, fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: `1px solid ${colors.border}` }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: "32px", textAlign: "center", color: colors.textMuted }}>Loading...</td></tr>
              ) : filteredGrouped.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: "32px", textAlign: "center", color: colors.textMuted }}>No expenses found.</td></tr>
              ) : (
                filteredGrouped.map((group) => {
                  const firstExp = group.expenses[0];
                  const vehicle = vehiclesMap[firstExp.vehicle_id];
                  const vehicleDisplay = vehicle ? `${vehicle.name} (${vehicle.registration_number})` : firstExp.vehicle_id.slice(0, 8);
                  const trip = group.tripId ? tripsMap[group.tripId] : null;
                  const tripDisplay = trip ? trip.trip_number : (group.tripId || "—");
                  const status = trip?.status;

                  // Compute sums per type
                  const tollSum = group.expenses.filter(e => e.expense_type.toLowerCase() === "toll").reduce((s, e) => s + e.amount, 0);
                  const otherSum = group.expenses.filter(e => e.expense_type.toLowerCase() === "other").reduce((s, e) => s + e.amount, 0);
                  const maintSum = group.expenses.filter(e => e.expense_type.toLowerCase().includes("maintenance")).reduce((s, e) => s + e.amount, 0);
                  const totalSum = tollSum + otherSum + maintSum;

                  const statusColor = getStatusColor(status);

                  return (
                    <tr key={group.tripId || "untracked"}>
                      <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>{tripDisplay}</td>
                      <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text }}>{vehicleDisplay}</td>
                      <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text, textAlign: "right" }}>{formatCurrency(tollSum)}</td>
                      <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text, textAlign: "right" }}>{formatCurrency(otherSum)}</td>
                      <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text, textAlign: "right" }}>{formatCurrency(maintSum)}</td>
                      <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text, textAlign: "right", fontWeight: 600 }}>{formatCurrency(totalSum)}</td>
                      <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text, textAlign: "center" }}>
                        {status ? (
                          <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 500, backgroundColor: statusColor + "20", color: statusColor }}>
                            {status}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.border}`, color: colors.text, textAlign: "center" }}>
                        {/* Actions: delete all expenses for this trip? or allow edit/delete per expense? For simplicity, we show a delete button that deletes all expenses of this trip */}
                        <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "4px", borderRadius: "4px", opacity: 0.7, color: "#ef4444" }} onClick={() => {
                          if (window.confirm(`Delete all expenses for trip ${tripDisplay}?`)) {
                            group.expenses.forEach(async (e) => {
                              await expenseService.deleteExpense(e.id);
                            });
                            // Refresh: filter out deleted expenses from state
                            const ids = group.expenses.map(e => e.id);
                            setExpenses(prev => prev.filter(e => !ids.includes(e.id)));
                          }
                        }} title="Delete all">🗑️</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Total Operational Cost */}
      <div className="total-box" style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "24px", padding: "16px 24px", backgroundColor: colors.cardBg, borderRadius: "12px", border: `1px solid ${colors.border}`, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div>
          <span style={{ fontWeight: 600, color: colors.textMuted }}>Fuel Total:</span>
          <span style={{ marginLeft: "8px", fontWeight: 700, fontSize: "18px" }}>{formatCurrency(totalFuelCost)}</span>
        </div>
        <div>
          <span style={{ fontWeight: 600, color: colors.textMuted }}>Maintenance Total:</span>
          <span style={{ marginLeft: "8px", fontWeight: 700, fontSize: "18px" }}>{formatCurrency(maintenanceCost)}</span>
        </div>
        <div style={{ borderLeft: `2px solid ${colors.border}`, paddingLeft: "24px" }}>
          <span style={{ fontWeight: 600, color: colors.textMuted }}>Total Operational Cost:</span>
          <span style={{ marginLeft: "8px", fontWeight: 700, fontSize: "20px", color: "#2563eb" }}>{formatCurrency(totalOpCost)}</span>
        </div>
      </div>

      {/* Modal – Create/Edit */}
      {showModal && (
        <div className="modal-overlay" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15,23,42,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 999, padding: "20px", backdropFilter: "blur(2px)" }}>
          <div style={{ backgroundColor: colors.cardBg, borderRadius: "16px", maxWidth: "500px", width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", padding: "24px", color: colors.text }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 600, margin: 0 }}>
                {modalMode === "fuel" ? (editingId ? "Edit Fuel Log" : "Log Fuel") : (editingId ? "Edit Expense" : "Add Expense")}
              </h2>
              <button style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: colors.textMuted, padding: "0 4px" }} onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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
              <div>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>Trip ID (optional)</label>
                <input
                  type="text"
                  name="trip_id"
                  value={formData.trip_id}
                  onChange={handleFormChange}
                  placeholder="e.g., TRIP-000001"
                  style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none" }}
                />
              </div>

              {modalMode === "fuel" && (
                <>
                  <div>
                    <label style={{ fontSize: "14px", fontWeight: 500 }}>Liters *</label>
                    <input
                      type="number"
                      name="liters"
                      value={formData.liters}
                      onChange={handleFormChange}
                      required
                      min="0"
                      step="0.01"
                      style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "14px", fontWeight: 500 }}>Cost (₹) *</label>
                    <input
                      type="number"
                      name="cost"
                      value={formData.cost}
                      onChange={handleFormChange}
                      required
                      min="0"
                      step="0.01"
                      style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "14px", fontWeight: 500 }}>Odometer (optional)</label>
                    <input
                      type="number"
                      name="odometer"
                      value={formData.odometer}
                      onChange={handleFormChange}
                      min="0"
                      step="0.01"
                      style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none" }}
                    />
                  </div>
                </>
              )}

              {modalMode === "expense" && (
                <>
                  <div>
                    <label style={{ fontSize: "14px", fontWeight: 500 }}>Expense Type *</label>
                    <input
                      type="text"
                      name="expense_type"
                      value={formData.expense_type}
                      onChange={handleFormChange}
                      required
                      placeholder="e.g., Toll, Maintenance, Other"
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
                  <div>
                    <label style={{ fontSize: "14px", fontWeight: 500 }}>Amount (₹) *</label>
                    <input
                      type="number"
                      name="amount"
                      value={formData.amount}
                      onChange={handleFormChange}
                      required
                      min="0"
                      step="0.01"
                      style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none" }}
                    />
                  </div>
                </>
              )}

              <div>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>Date *</label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleFormChange}
                  required
                  style={{ width: "100%", padding: "10px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px", paddingTop: "16px", borderTop: `1px solid ${colors.border}` }}>
                <button type="button" style={{ padding: "10px 20px", border: `1px solid ${colors.border}`, borderRadius: "8px", backgroundColor: "transparent", fontSize: "14px", fontWeight: 500, cursor: "pointer", color: colors.textMuted }} onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: "10px 24px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", boxShadow: "0 2px 6px rgba(37,99,235,0.25)" }} disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : editingId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FuelExpensesPage;