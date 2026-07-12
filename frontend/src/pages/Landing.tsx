import React, { FC, useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface RoleCardProps {
  role: string;
  desc: string;
}

interface FeatureCardProps {
  emoji: string;
  title: string;
  desc: string;
}

export const LandingPage: FC = () => {
  const { isAuthenticated } = useAuth() as { isAuthenticated: boolean };

  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : true;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
      root.style.setProperty("--background-color", "#0b0f19");
      root.style.setProperty("--text-color", "#f8fafc");
      root.style.setProperty("--card-bg", "rgba(255, 255, 255, 0.02)");
      root.style.setProperty("--border-color", "rgba(148, 163, 184, 0.12)");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
      root.style.setProperty("--background-color", "#f8fafc");
      root.style.setProperty("--text-color", "#0f172a");
      root.style.setProperty("--card-bg", "#ffffff");
      root.style.setProperty("--border-color", "rgba(99, 102, 241, 0.15)");
    }
  }, [isDark]);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const styles = {
    wrapper: {
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: "100vh",
      width: "100%",
      margin: "0 auto",
      padding: "0 24px",
      boxSizing: "border-box" as const,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: "var(--background-color, #0b0f19)", 
      color: "var(--text-color, #f8fafc)",
      transition: "background 0.3s ease, color 0.3s ease"
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
      maxWidth: "1150px",
      padding: "24px 0",
      borderBottom: "1px solid var(--border-color, rgba(148, 163, 184, 0.15))",
      boxSizing: "border-box" as const
    },
    brandContainer: {
      display: "flex",
      alignItems: "center",
      gap: "10px"
    },
    brandText: {
      fontSize: "24px",
      fontWeight: 900,
      letterSpacing: "-0.05em",
      background: "linear-gradient(to right, #3b82f6, #6366f1)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent"
    },
    circleToggle: {
      width: "56px",
      height: "56px",
      borderRadius: "50%",
      backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(15, 23, 42, 0.04)",
      border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.08)"}`,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "26px",
      padding: "0",
      boxSizing: "border-box" as const,
      transition: "all 0.2s ease-in-out",
      outline: "none"
    },
    main: {
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      textAlign: "center" as const,
      width: "100%",
      maxWidth: "950px",
      margin: "auto 0",
      padding: "60px 0",
      boxSizing: "border-box" as const
    },
    title: {
      fontSize: "clamp(32px, 5vw, 56px)",
      fontWeight: 800,
      lineHeight: "1.15",
      letterSpacing: "-0.03em",
      margin: "0 0 20px 0"
    },
    gradientText: {
      background: "linear-gradient(135deg, #2563eb, #6366f1, #a855f7)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent"
    },
    subtitle: {
      fontSize: "clamp(15px, 2vw, 18px)",
      color: "#64748b",
      maxWidth: "640px",
      margin: "0 auto 40px auto",
      lineHeight: "1.6"
    },
    btnRow: {
      display: "flex",
      gap: "16px",
      justifyContent: "center",
      flexWrap: "wrap" as const,
      width: "100%",
      marginBottom: "80px"
    },
    primaryBtn: {
      backgroundColor: "#2563eb",
      color: "#ffffff",
      padding: "14px 32px",
      borderRadius: "12px",
      textDecoration: "none",
      fontWeight: 650,
      fontSize: "16px",
      boxShadow: "0 10px 25px -5px rgba(37, 99, 235, 0.4)",
      transition: "transform 0.2s"
    },
    secondaryBtn: {
      backgroundColor: "var(--card-bg, rgba(255, 255, 255, 0.03))",
      color: "var(--text-color, #cbd5e1)",
      padding: "14px 32px",
      borderRadius: "12px",
      textDecoration: "none",
      fontWeight: 600,
      fontSize: "16px",
      border: "1px solid var(--border-color, rgba(148, 163, 184, 0.2))"
    },
    sectionTitle: {
      fontSize: "12px",
      letterSpacing: "0.2em",
      color: "#64748b",
      textTransform: "uppercase" as const,
      fontWeight: 700,
      marginBottom: "32px"
    },
    rolesGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: "16px",
      width: "100%",
      textAlign: "left" as const,
      marginBottom: "80px"
    },
    roleCard: {
      padding: "24px",
      borderRadius: "16px",
      border: "1px solid var(--border-color, rgba(148, 163, 184, 0.12))",
      backgroundColor: "var(--card-bg, rgba(255, 255, 255, 0.02))",
      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)"
    },
    featuresGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      gap: "24px",
      width: "100%",
      textAlign: "left" as const
    },
    featureCard: {
      padding: "28px",
      borderRadius: "20px",
      border: "1px solid var(--border-color, rgba(148, 163, 184, 0.12))",
      backgroundColor: "var(--card-bg, rgba(255, 255, 255, 0.01))",
      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02)"
    },
    footer: {
      width: "100%",
      maxWidth: "1150px",
      borderTop: "1px solid var(--border-color, rgba(148, 163, 184, 0.15))",
      padding: "32px 0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap" as const,
      gap: "16px",
      fontSize: "13px",
      color: "#64748b",
      boxSizing: "border-box" as const
    }
  };

  return (
    <div style={styles.wrapper}>
      
      {/* --- HEADER --- */}
      <header style={styles.header}>
        <div style={styles.brandContainer}>
          <span style={{ fontSize: "26px" }}>🚚</span>
          <span style={styles.brandText}>TransitOps</span>
        </div>
        
        {/* Toggle Switch with Corrected Dark/Light Icons and Tooltips */}
        <button 
          onClick={() => setIsDark(!isDark)} 
          style={styles.circleToggle}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label="Toggle layout theme color"
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.06)";
            if (isDark) {
              e.currentTarget.style.boxShadow = "0 0 16px rgba(255, 255, 255, 0.08)";
            } else {
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(15, 23, 42, 0.05)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          {isDark ? "☀️" : "🌙"}
        </button>
      </header>

      {/* --- HERO CONTENT --- */}
      <main style={styles.main}>
        <h1 style={styles.title}>
          Smart Transport Operations <br />
          <span style={styles.gradientText}>Platform, Simplified.</span>
        </h1>
        
        <p style={styles.subtitle}>
          Ditch chaotic spreadsheets. Centralize your vehicle registry, driver compliance, intelligent dispatch rules, and real-time operational costs in one ecosystem.
        </p>

        <div style={styles.btnRow}>
          <Link to="/login" style={styles.primaryBtn}>
            Get Started Now
          </Link>
          <a href="#features" style={styles.secondaryBtn}>
            Explore Core Features
          </a>
        </div>

        {/* --- TARGET ROLES --- */}
        <section style={{ width: "100%" }}>
          <h2 style={styles.sectionTitle}>Tailored Roles for Full Fleet Visibility</h2>
          <div style={styles.rolesGrid}>
            {[
              { role: "Fleet Manager", desc: "Assets, maintenance & lifecycles" },
              { role: "Dispatcher / Driver", desc: "Trips, routing & status handshakes" },
              { role: "Safety Officer", desc: "License compliance & safety scoring" },
              { role: "Financial Analyst", desc: "Fuel logs, ROI calculations & costs" }
            ].map((user: RoleCardProps, i: number) => (
              <div key={i} style={styles.roleCard}>
                <h3 style={{ color: "#2563eb", margin: "0 0 6px 0", fontSize: "16px", fontWeight: 700 }}>{user.role}</h3>
                <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.4" }}>{user.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* --- FEATURES GRID --- */}
        <section id="features" style={{ width: "100%", borderTop: "1px solid var(--border-color, rgba(148, 163, 184, 0.15))", paddingTop: "60px" }}>
          <div style={{ marginBottom: "48px" }}>
            <h2 style={{ fontSize: "32px", fontWeight: 800, margin: "0 0 10px 0", letterSpacing: "-0.02em" }}>Rigorous Automation Rules</h2>
            <p style={{ fontSize: "15px", margin: 0 }}>
              Built-in guards enforce valid routes, weight thresholds, and legal states automatically.
            </p>
          </div>

          <div style={styles.featuresGrid}>
            {[
              { emoji: "🚛", title: "Fleet Tracking", desc: "Track capacities, odometers, and live states (Available, On Trip, In Shop, Retired)." },
              { emoji: "🪪", title: "Smart Driver Dispatch", desc: "Blocks expired or suspended operators dynamically before assignments." },
              { emoji: "⛓️", title: "Lifecycle Automations", desc: "Dispatches seamlessly toggle vehicle and crew status flags without manual steps." },
              { emoji: "🔧", title: "Maintenance Isolation", desc: "Sending a vehicle for shop repairs instantly pulls it from the active dispatcher pool." },
              { emoji: "⛽", title: "Expense Analytics", desc: "Aggregated operational expenses tracking fuel efficiency and exact asset ROI metrics." },
              { emoji: "📊", title: "Real-time KPIs", desc: "Dynamic dashboards charting usage density, active drivers, and critical maintenance windows." }
            ].map((feat: FeatureCardProps, i: number) => (
              <div key={i} style={styles.featureCard}>
                <span style={{ fontSize: "28px", display: "block", marginBottom: "16px" }}>{feat.emoji}</span>
                <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px 0" }}>{feat.title}</h3>
                <p style={{ fontSize: "14px", margin: 0, lineHeight: "1.5" }}>{feat.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* --- FOOTER --- */}
      <footer style={styles.footer}>
        <p style={{ margin: 0 }}>&copy; {new Date().getFullYear()} TransitOps. All rights reserved.</p>
        <div style={{ display: "flex", gap: "24px" }}>
          <span>Secure Platform</span>
          <span>&bull;</span>
          <span>Real-time Insights</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;