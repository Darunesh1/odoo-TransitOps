import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { dashboardService } from "../services/dashboardService";
import { DashboardKPIs, DashboardFilters } from "../types/dashboard";
import {
  Truck,
  User,
  MapPin,
  Wrench,
  Clock,
  BarChart3,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

const Dashboard = () => {
  const { user } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  // Listen for theme changes
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
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters state
  const [filters, setFilters] = useState<DashboardFilters>({
    vehicle_type: "",
    vehicle_status: "",
    region: "",
  });

  // ─── Fetch KPIs ─────────────────────────────────────────
  const fetchKPIs = async (currentFilters = filters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getDashboardKPIs(currentFilters);
      setKpis(data);
    } catch (err: any) {
      console.error("Error loading dashboard KPIs:", err);
      setError(
        err.response?.data?.detail || 
        err.message || 
        "Failed to load dashboard metrics. Verify connection to the backend."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKPIs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.vehicle_type, filters.vehicle_status, filters.region]);

  // ─── Event Handlers ─────────────────────────────────────
  const handleFilterChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      vehicle_type: "",
      vehicle_status: "",
      region: "",
    });
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
    errorBg: isDark ? "#7f1d1d" : "#fee2e2",
    errorText: isDark ? "#fca5a5" : "#b91c1c",
    hoverBg: isDark ? "#374151" : "#f1f5f9",
  };

  return (
    <div
      style={{
        padding: "24px",
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
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }
        .dashboard-card {
          background-color: ${colors.cardBg};
          border: 1px solid ${colors.border};
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .dashboard-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .shortcut-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
        }
        .shortcut-card {
          background-color: ${colors.cardBg};
          border: 1px solid ${colors.border};
          border-radius: 12px;
          padding: 24px;
          text-decoration: none;
          color: inherit;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .shortcut-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        @media (max-width: 768px) {
          .filters-panel {
            flex-direction: column;
            align-items: stretch !important;
          }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
            Operational Dashboard
          </h1>
          <p style={{ margin: "4px 0 0 0", color: colors.textMuted, fontSize: "14px" }}>
            Real-time operations, logistics KPIs, and fleet health metrics.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            style={{
              padding: "10px 16px",
              backgroundColor: isDark ? "#374151" : "#f1f5f9",
              border: `1px solid ${colors.border}`,
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: colors.text,
            }}
            onClick={() => fetchKPIs()}
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      <div
        className="filters-panel"
        style={{
          display: "flex",
          gap: "12px",
          padding: "16px",
          backgroundColor: colors.cardBg,
          border: `1px solid ${colors.border}`,
          borderRadius: "12px",
          marginBottom: "24px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: "150px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: colors.textMuted }}>
            Region
          </label>
          <input
            type="text"
            name="region"
            placeholder="Filter by region (e.g. West, North)..."
            value={filters.region}
            onChange={handleFilterChange}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: `1px solid ${colors.inputBorder}`,
              borderRadius: "6px",
              fontSize: "13px",
              backgroundColor: colors.inputBg,
              color: colors.text,
              outline: "none",
            }}
          />
        </div>

        <div style={{ flex: 1, minWidth: "150px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: colors.textMuted }}>
            Vehicle Type
          </label>
          <input
            type="text"
            name="vehicle_type"
            placeholder="Filter by type (e.g. Van, Truck)..."
            value={filters.vehicle_type}
            onChange={handleFilterChange}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: `1px solid ${colors.inputBorder}`,
              borderRadius: "6px",
              fontSize: "13px",
              backgroundColor: colors.inputBg,
              color: colors.text,
              outline: "none",
            }}
          />
        </div>

        <div style={{ minWidth: "150px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: colors.textMuted }}>
            Vehicle Status
          </label>
          <select
            name="vehicle_status"
            value={filters.vehicle_status}
            onChange={handleFilterChange}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: `1px solid ${colors.inputBorder}`,
              borderRadius: "6px",
              fontSize: "13px",
              backgroundColor: colors.inputBg,
              color: colors.text,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="ON_TRIP">On Trip</option>
            <option value="IN_SHOP">In Shop</option>
            <option value="RETIRED">Retired</option>
          </select>
        </div>

        <button
          style={{
            padding: "10px 16px",
            backgroundColor: "transparent",
            border: "none",
            color: "#2563eb",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            marginTop: "16px",
            alignSelf: "flex-end",
          }}
          onClick={clearFilters}
        >
          Clear Filters
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: "16px",
            backgroundColor: colors.errorBg,
            color: colors.errorText,
            borderRadius: "8px",
            marginBottom: "24px",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="dashboard-grid">
        {/* Card 1: Active Vehicles */}
        <div className="dashboard-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "14px", color: colors.textMuted, fontWeight: 500 }}>Active Fleet</div>
              <div style={{ fontSize: "28px", fontWeight: 700, marginTop: "8px" }}>
                {loading ? "..." : kpis?.active_vehicles ?? 0}
              </div>
            </div>
            <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#3b82f620", color: "#3b82f6" }}>
              <Truck size={24} />
            </div>
          </div>
          <div style={{ fontSize: "12px", color: colors.textMuted, marginTop: "12px" }}>
            Total vehicles in service (excluding retired)
          </div>
        </div>

        {/* Card 2: Available Vehicles */}
        <div className="dashboard-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "14px", color: colors.textMuted, fontWeight: 500 }}>Available Vehicles</div>
              <div style={{ fontSize: "28px", fontWeight: 700, marginTop: "8px" }}>
                {loading ? "..." : kpis?.available_vehicles ?? 0}
              </div>
            </div>
            <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#10b98120", color: "#10b981" }}>
              <CheckCircle size={24} />
            </div>
          </div>
          <div style={{ fontSize: "12px", color: colors.textMuted, marginTop: "12px" }}>
            Ready to be dispatched on trips
          </div>
        </div>

        {/* Card 3: Vehicles in Shop */}
        <div className="dashboard-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "14px", color: colors.textMuted, fontWeight: 500 }}>Vehicles In Shop</div>
              <div style={{ fontSize: "28px", fontWeight: 700, marginTop: "8px" }}>
                {loading ? "..." : kpis?.vehicles_in_maintenance ?? 0}
              </div>
            </div>
            <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#f59e0b20", color: "#f59e0b" }}>
              <Wrench size={24} />
            </div>
          </div>
          <div style={{ fontSize: "12px", color: colors.textMuted, marginTop: "12px" }}>
            Currently undergoing active maintenance
          </div>
        </div>

        {/* Card 4: Drivers On Duty */}
        <div className="dashboard-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "14px", color: colors.textMuted, fontWeight: 500 }}>Drivers On Duty</div>
              <div style={{ fontSize: "28px", fontWeight: 700, marginTop: "8px" }}>
                {loading ? "..." : kpis?.drivers_on_duty ?? 0}
              </div>
            </div>
            <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#a855f720", color: "#a855f7" }}>
              <User size={24} />
            </div>
          </div>
          <div style={{ fontSize: "12px", color: colors.textMuted, marginTop: "12px" }}>
            Drivers currently assigned to active trips
          </div>
        </div>

        {/* Card 5: Active Trips */}
        <div className="dashboard-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "14px", color: colors.textMuted, fontWeight: 500 }}>Dispatched Trips</div>
              <div style={{ fontSize: "28px", fontWeight: 700, marginTop: "8px" }}>
                {loading ? "..." : kpis?.active_trips ?? 0}
              </div>
            </div>
            <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#6366f120", color: "#6366f1" }}>
              <MapPin size={24} />
            </div>
          </div>
          <div style={{ fontSize: "12px", color: colors.textMuted, marginTop: "12px" }}>
            Shipments currently in transit
          </div>
        </div>

        {/* Card 6: Pending Trips */}
        <div className="dashboard-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "14px", color: colors.textMuted, fontWeight: 500 }}>Pending Trips</div>
              <div style={{ fontSize: "28px", fontWeight: 700, marginTop: "8px" }}>
                {loading ? "..." : kpis?.pending_trips ?? 0}
              </div>
            </div>
            <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#ec489920", color: "#ec4899" }}>
              <Clock size={24} />
            </div>
          </div>
          <div style={{ fontSize: "12px", color: colors.textMuted, marginTop: "12px" }}>
            Trips in Draft status awaiting dispatch
          </div>
        </div>
      </div>

      {/* Fleet Utilization Progress Panel */}
      <div
        style={{
          backgroundColor: colors.cardBg,
          border: `1px solid ${colors.border}`,
          borderRadius: "12px",
          padding: "24px",
          marginBottom: "32px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <BarChart3 style={{ color: "#06b6d4" }} />
            <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>Fleet Utilization Rate</h2>
          </div>
          <span style={{ fontSize: "20px", fontWeight: 700, color: "#06b6d4" }}>
            {loading ? "..." : `${kpis?.fleet_utilization ?? 0}%`}
          </span>
        </div>

        <div style={{ height: "10px", width: "100%", backgroundColor: isDark ? "#374151" : "#e2e8f0", borderRadius: "5px", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${kpis?.fleet_utilization ?? 0}%`,
              backgroundColor: "#06b6d4",
              borderRadius: "5px",
              transition: "width 0.6s ease-in-out",
            }}
          />
        </div>
        <p style={{ margin: "12px 0 0 0", fontSize: "12px", color: colors.textMuted }}>
          Calculated as: <strong>(Vehicles On Trip / Active Vehicles) × 100</strong>. High utilization indicates optimal logistics deployment.
        </p>
      </div>

      {/* Operational Shortcuts */}
      <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "16px", letterSpacing: "-0.01em" }}>
        Quick Management Panels
      </h2>
      <div className="shortcut-grid">
        <Link to="/fleet" className="shortcut-card">
          <div style={{ padding: "12px", borderRadius: "10px", backgroundColor: "#3b82f615", color: "#3b82f6" }}>
            <Truck size={24} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "16px" }}>Manage Fleet Registry</div>
            <div style={{ fontSize: "12px", color: colors.textMuted, marginTop: "4px" }}>
              Add new vehicles, edit load capacity, and view vehicle statuses.
            </div>
          </div>
        </Link>

        <Link to="/drivers" className="shortcut-card">
          <div style={{ padding: "12px", borderRadius: "10px", backgroundColor: "#a855f715", color: "#a855f7" }}>
            <User size={24} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "16px" }}>Manage Driver Profiles</div>
            <div style={{ fontSize: "12px", color: colors.textMuted, marginTop: "4px" }}>
              Check safety scores, license expirations, and status.
            </div>
          </div>
        </Link>

        <Link to="/trips" className="shortcut-card">
          <div style={{ padding: "12px", borderRadius: "10px", backgroundColor: "#6366f115", color: "#6366f1" }}>
            <MapPin size={24} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "16px" }}>Dispatch & Trip Board</div>
            <div style={{ fontSize: "12px", color: colors.textMuted, marginTop: "4px" }}>
              Dispatch shipments, complete routes, and monitor load constraints.
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;