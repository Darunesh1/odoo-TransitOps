import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import ThemeToggle from "../ThemeToggle";

const Navbar = () => {
  const { accessToken, logout } = useAuth();
  const navigate = useNavigate();
  const isDark = localStorage.getItem("theme") === "dark";

  const handleLogout = () => {
    logout();
    navigate("/logout");
  };

  return (
    <nav
      style={{
        backgroundColor: isDark ? "#111827" : "#ffffff",
        padding: "0.75rem 2rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: isDark
          ? "0 1px 3px rgba(0,0,0,0.3)"
          : "0 1px 3px rgba(0,0,0,0.06)",
        borderBottom: isDark ? "1px solid #374151" : "1px solid #e5e7eb",
        position: "sticky",
        top: 0,
        zIndex: 100,
        transition: "all 0.3s ease",
      }}
    >
      <Link
        to="/dashboard"
        style={{
          fontSize: "1.25rem",
          fontWeight: "bold",
          color: isDark ? "#f9fafb" : "#111827",
          textDecoration: "none",
          transition: "color 0.3s ease",
        }}
      >
        Hackathon
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <ThemeToggle />
        {accessToken && (
          <button
            onClick={handleLogout}
            style={{
              padding: "0 16px",
              height: "48px",
              borderRadius: "8px",
              border: "1px solid " + (isDark ? "#374151" : "#e5e7eb"),
              backgroundColor: "transparent",
              color: isDark ? "#e5e7eb" : "#374151",
              fontSize: "0.9rem",
              fontWeight: "500",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDark ? "#1f2937" : "#f9fafb";
              e.currentTarget.style.borderColor = "#ef4444";
              e.currentTarget.style.color = "#ef4444";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.borderColor = isDark ? "#374151" : "#e5e7eb";
              e.currentTarget.style.color = isDark ? "#e5e7eb" : "#374151";
            }}
          >
            <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>⏻</span>
            <span>Logout</span>
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;