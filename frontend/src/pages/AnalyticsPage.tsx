import React, { useEffect, useState, useRef } from "react";
import { analyticsService } from "../services/analyticsService";
import { vehicleService } from "../services/vehicleService";
import { AnalyticsSummary } from "../types/analytics";
import { Vehicle } from "../types/vehicle";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  PieChart, Pie, Cell, ResponsiveContainer 
} from "recharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const AnalyticsPage: React.FC = () => {
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
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  // Filters
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ─── Mock Data ──────────────────────────────────────────
  const generateMockSummary = (): AnalyticsSummary => ({
    total_fuel_cost: 28500,
    total_maintenance_cost: 18000,
    total_operational_cost: 46500,
    total_other_expenses: 4200,
    total_revenue: 85000,
    total_distance: 18340,
    total_fuel_consumed: 2180,
    fuel_efficiency: 8.4,
    fleet_utilization: 81,
    vehicle_roi: 14.2,
  });

  const generateMonthlyRevenue = () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months.map((m, i) => ({
      month: m,
      revenue: Math.floor(Math.random() * 8000 + 2000),
    }));
  };

  const topVehicles = [
    { name: "TRUCK-11", cost: 28500 },
    { name: "MINI-03", cost: 12400 },
    { name: "VAN-05", cost: 9800 },
  ];

  // ─── Load Data ──────────────────────────────────────────
  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (selectedVehicle) params.vehicle_id = selectedVehicle;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const data = await analyticsService.getSummary(params);
      setSummary(data);
    } catch (err: any) {
      console.error("Analytics API error:", err);
      setError(err.response?.data?.detail || "Failed to load analytics data from API.");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const loadVehicles = async () => {
    try {
      const data = await vehicleService.getVehicles({ limit: 200 });
      setVehicles(data);
    } catch (err) {
      console.error("Could not load vehicles", err);
    }
  };

  useEffect(() => {
    loadVehicles();
    loadAnalytics();
  }, [selectedVehicle, dateFrom, dateTo]);

  // ─── Export CSV ─────────────────────────────────────────
  const handleExportCsv = async () => {
    try {
      const params: any = {};
      if (selectedVehicle) params.vehicle_id = selectedVehicle;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const blob = await analyticsService.exportCsv(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "transitops_analytics.csv";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to export CSV");
    }
  };

  // ─── Export PDF ─────────────────────────────────────────
  const pdfRef = useRef<HTMLDivElement>(null);
  const timestampRef = useRef<HTMLSpanElement>(null);

  const handleExportPdf = async () => {
    if (!pdfRef.current) return;

    // Update timestamp to current date/time
    if (timestampRef.current) {
      const now = new Date();
      const formatted = now.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      timestampRef.current.textContent = formatted;
    }

    const pdfElement = pdfRef.current;
    
    // Store original styles for restoration
    const originalStyles = {
      backgroundColor: pdfElement.style.backgroundColor,
      color: pdfElement.style.color,
      borderColor: pdfElement.style.borderColor,
      boxShadow: pdfElement.style.boxShadow,
      padding: pdfElement.style.padding,
    };

    // Force clean white background for PDF - this overrides the theme only for export
    pdfElement.style.backgroundColor = '#ffffff';
    pdfElement.style.color = '#0f172a';
    pdfElement.style.borderColor = '#e2e8f0';
    pdfElement.style.boxShadow = 'none';
    pdfElement.style.padding = '32px';

    // Apply PDF-friendly styles to all child elements
    const cards = pdfElement.querySelectorAll('.kpi-card, .chart-card, .vehicle-card');
    cards.forEach((card: any) => {
      card.style.backgroundColor = '#f8fafc';
      card.style.borderColor = '#e2e8f0';
      card.style.color = '#0f172a';
      card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
    });

    // Fix the header for PDF
    const header = pdfElement.querySelector('[style*="borderBottom"]');
    if (header) {
      (header as HTMLElement).style.borderBottomColor = '#2563eb';
    }

    try {
      const canvas = await html2canvas(pdfElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        allowTaint: true,
        useCORS: true
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Add the image to PDF
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      pdf.save("transitops_analytics_report.pdf");
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("PDF export failed");
    } finally {
      // Restore original themed styles
      pdfElement.style.backgroundColor = originalStyles.backgroundColor || '';
      pdfElement.style.color = originalStyles.color || '';
      pdfElement.style.borderColor = originalStyles.borderColor || '';
      pdfElement.style.boxShadow = originalStyles.boxShadow || '';
      pdfElement.style.padding = originalStyles.padding || '32px';

      cards.forEach((card: any) => {
        card.style.backgroundColor = '';
        card.style.borderColor = '';
        card.style.color = '';
        card.style.boxShadow = '';
      });

      // Restore header
      if (header) {
        (header as HTMLElement).style.borderBottomColor = '';
      }
    }
  };

  // ─── Helpers ────────────────────────────────────────────
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
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

  const chartColors = ["#2563eb", "#10b981", "#f59e0b", "#ef4444"];

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
        .kpi-card { transition: transform 0.2s; }
        .kpi-card:hover { transform: translateY(-4px); }
        @media (max-width: 640px) {
          .kpi-grid { grid-template-columns: 1fr !important; }
          .chart-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Analytics Dashboard</h1>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button className="btn-secondary" style={{ padding: "10px 20px", backgroundColor: isDark ? "#374151" : "#f1f5f9", border: `1px solid ${colors.border}`, borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", color: colors.text }} onClick={handleExportCsv}>Export CSV</button>
          <button className="btn-primary" style={{ padding: "10px 20px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer", boxShadow: "0 2px 6px rgba(37,99,235,0.25)" }} onClick={handleExportPdf}>Export PDF</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "24px", alignItems: "center", padding: "16px", backgroundColor: colors.cardBg, borderRadius: "12px", border: `1px solid ${colors.border}` }}>
        <div style={{ flex: 1, minWidth: "150px" }}>
          <label style={{ fontSize: "14px", fontWeight: 500 }}>Vehicle</label>
          <select
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none", marginTop: "4px" }}
          >
            <option value="">All Vehicles</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.registration_number})
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: "150px" }}>
          <label style={{ fontSize: "14px", fontWeight: 500 }}>Date From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none", marginTop: "4px" }}
          />
        </div>
        <div style={{ flex: 1, minWidth: "150px" }}>
          <label style={{ fontSize: "14px", fontWeight: 500 }}>Date To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", border: `1px solid ${colors.inputBorder}`, borderRadius: "8px", fontSize: "14px", backgroundColor: colors.inputBg, color: colors.text, outline: "none", marginTop: "4px" }}
          />
        </div>
        <div style={{ alignSelf: "flex-end" }}>
          <button className="btn-primary" style={{ padding: "8px 20px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 500, cursor: "pointer" }} onClick={loadAnalytics}>
            Apply
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: "12px 16px", backgroundColor: colors.errorBg, color: colors.errorText, borderRadius: "8px", marginBottom: "20px", fontSize: "14px" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: colors.textMuted }}>Loading analytics...</div>
      ) : summary ? (
        // ─── PDF Content Wrapper ─────────────────────────────
        // This div uses themed colours for the web view.
        // During PDF export, we temporarily override them to white.
        <div
          ref={pdfRef}
          style={{
            backgroundColor: colors.cardBg,
            color: colors.text,
            border: `1px solid ${colors.border}`,
            borderRadius: "12px",
            padding: "32px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            transition: "background-color 0.3s, color 0.3s, border-color 0.3s",
          }}
        >
          {/* Report Header */}
          <div style={{
            borderBottom: `2px solid ${isDark ? '#3b82f6' : '#2563eb'}`,
            paddingBottom: "16px",
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px"
          }}>
            <h1 style={{
              fontSize: "24px",
              fontWeight: 700,
              margin: 0,
              color: '#000000',
              letterSpacing: "-0.02em"
            }}>
              TransitOps Analytics Report
            </h1>
            <div style={{ fontSize: "14px", color: colors.textMuted }}>
              Generated: <span ref={timestampRef}>{new Date().toLocaleString()}</span>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
            {[
              { label: "Fuel Efficiency", value: `${summary.fuel_efficiency} km/l`, icon: "⛽", color: "#2563eb" },
              { label: "Fleet Utilization", value: `${summary.fleet_utilization}%`, icon: "🚚", color: "#10b981" },
              { label: "Operational Cost", value: formatCurrency(summary.total_operational_cost), icon: "💰", color: "#f59e0b" },
              { label: "Vehicle ROI", value: `${summary.vehicle_roi}%`, icon: "📈", color: "#ef4444" },
            ].map((kpi) => (
              <div key={kpi.label} className="kpi-card" style={{
                backgroundColor: isDark ? "#374151" : "#f8fafc",
                border: `1px solid ${colors.border}`,
                borderRadius: "12px",
                padding: "16px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                color: colors.text,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "24px" }}>{kpi.icon}</span>
                  <span style={{ fontSize: "14px", color: colors.textMuted }}>{kpi.label}</span>
                </div>
                <div style={{ fontSize: "28px", fontWeight: 700, marginTop: "8px", color: kpi.color }}>
                  {kpi.value}
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="chart-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
            {/* Monthly Revenue */}
            <div className="chart-card" style={{
              backgroundColor: isDark ? "#374151" : "#f8fafc",
              border: `1px solid ${colors.border}`,
              borderRadius: "12px",
              padding: "16px"
            }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 12px 0", color: colors.text }}>Monthly Revenue</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={generateMonthlyRevenue()} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                  <XAxis dataKey="month" stroke={colors.textMuted} />
                  <YAxis stroke={colors.textMuted} tickFormatter={(v) => `₹${v/1000}k`} />
                  <Tooltip formatter={(v) => typeof v === 'number' ? `₹${v}` : v} contentStyle={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.border}` }} />
                  <Bar dataKey="revenue" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Cost Breakdown */}
            <div className="chart-card" style={{
              backgroundColor: isDark ? "#374151" : "#f8fafc",
              border: `1px solid ${colors.border}`,
              borderRadius: "12px",
              padding: "16px"
            }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 12px 0", color: colors.text }}>Cost Breakdown</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Fuel", value: summary.total_fuel_cost },
                      { name: "Maintenance", value: summary.total_maintenance_cost },
                      { name: "Other Expenses", value: summary.total_other_expenses },
                    ]}
                    cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {[0, 1, 2].map((i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => (typeof v === 'number' ? `₹${v}` : v)} contentStyle={{ backgroundColor: colors.cardBg, border: `1px solid ${colors.border}` }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Costliest Vehicles */}
          <div className="vehicle-card" style={{
            backgroundColor: isDark ? "#374151" : "#f8fafc",
            border: `1px solid ${colors.border}`,
            borderRadius: "12px",
            padding: "16px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
          }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 12px 0", color: colors.text }}>Top Costliest Vehicles</h3>
            <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: "16px" }}>
              {topVehicles.map((v) => (
                <div key={v.name} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "20px", fontWeight: 600, color: '#000000' }}>{v.name}</div>
                  <div style={{ fontSize: "16px", color: colors.textMuted }}>{formatCurrency(v.cost)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            marginTop: "24px",
            borderTop: `1px solid ${colors.border}`,
            paddingTop: "16px",
            textAlign: "center",
            fontSize: "12px",
            color: colors.textMuted
          }}>
            Source: TransitOps Analytics
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AnalyticsPage;