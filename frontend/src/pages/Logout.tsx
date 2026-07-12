import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";

const Logout = () => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "light";
  });

  useEffect(() => {
    const handleThemeChange = () => {
      const newTheme = localStorage.getItem("theme") || "light";
      setTheme(newTheme);
    };

    window.addEventListener("themeChanged", handleThemeChange);
    window.addEventListener("storage", handleThemeChange);

    return () => {
      window.removeEventListener("themeChanged", handleThemeChange);
      window.removeEventListener("storage", handleThemeChange);
    };
  }, []);

  const isDark = theme === "dark";

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: isDark ? "#111827" : "#f3f4f6",
        fontFamily: "system-ui, -apple-system, sans-serif",
        transition: "background-color 0.3s ease",
        position: "relative",
      }}
    >
      {/* Theme Toggle - Fixed top-right like login/register */}
      <div
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          zIndex: 999,
        }}
      >
        <ThemeToggle />
      </div>

      <div
        style={{
          backgroundColor: isDark ? "#1f2937" : "#ffffff",
          padding: "3rem",
          borderRadius: "12px",
          boxShadow: isDark
            ? "0 25px 50px -12px rgba(0,0,0,0.5)"
            : "0 25px 50px -12px rgba(0,0,0,0.25)",
          width: "100%",
          maxWidth: "480px",
          margin: "0 1rem",
          textAlign: "center",
          transition: "all 0.3s ease",
        }}
      >
        <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>👋</div>
        <h2
          style={{
            fontSize: "1.75rem",
            fontWeight: "bold",
            color: isDark ? "#f9fafb" : "#111827",
            marginBottom: "1rem",
            transition: "color 0.3s ease",
          }}
        >
          Logout Successful
        </h2>
        <p
          style={{
            color: isDark ? "#9ca3af" : "#6b7280",
            fontSize: "1rem",
            lineHeight: "1.6",
            marginBottom: "2rem",
            transition: "color 0.3s ease",
          }}
        >
          You have been successfully logged out. Thank you for visiting!
          <br />
          We hope to see you again soon.
        </p>
        <Link
          to="/login"
          style={{
            display: "inline-block",
            padding: "12px 32px",
            backgroundColor: "#2563eb",
            color: "white",
            textDecoration: "none",
            borderRadius: "8px",
            fontWeight: "600",
            fontSize: "1rem",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1d4ed8")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
        >
          Log In Again
        </Link>
        <p
          style={{
            marginTop: "2rem",
            fontSize: "0.8rem",
            color: isDark ? "#6b7280" : "#9ca3af",
            transition: "color 0.3s ease",
          }}
        >
          presented by
          <br />
          <span style={{ fontWeight: "500", color: isDark ? "#9ca3af" : "#6b7280" }}>
            A great team of developers
          </span>
        </p>
      </div>
    </div>
  );
};

export default Logout;