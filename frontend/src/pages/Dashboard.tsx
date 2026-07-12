import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

const Dashboard = () => {
  const { user } = useAuth();
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "light";
  });

  // Listen for theme changes from other components
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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100%", // fill the main area
        padding: "2rem",
        backgroundColor: isDark ? "#111827" : "#f3f4f6",
        transition: "background-color 0.3s ease",
      }}
    >
      <div
        style={{
          backgroundColor: isDark ? "#1f2937" : "#ffffff",
          padding: "3rem 4rem",
          borderRadius: "12px",
          boxShadow: isDark
            ? "0 4px 20px rgba(0,0,0,0.3)"
            : "0 4px 20px rgba(0,0,0,0.08)",
          textAlign: "center",
          maxWidth: "600px",
          width: "100%",
          transition: "all 0.3s ease",
        }}
      >
        <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🚀</div>
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: "bold",
            color: isDark ? "#f9fafb" : "#111827",
            marginBottom: "0.75rem",
            transition: "color 0.3s ease",
          }}
        >
          Welcome, {user?.full_name || "User"}!
        </h1>
        <p
          style={{
            color: isDark ? "#9ca3af" : "#6b7280",
            fontSize: "1rem",
            lineHeight: "1.6",
            marginBottom: "1.5rem",
            transition: "color 0.3s ease",
          }}
        >
          You're all set. You will solve the problem statement here, once it is announced.
          <br />
          Stay tuned and keep coding! 💻
        </p>
        <div
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              backgroundColor: isDark ? "#374151" : "#e5e7eb",
              padding: "0.4rem 1rem",
              borderRadius: "20px",
              fontSize: "0.85rem",
              color: isDark ? "#e5e7eb" : "#374151",
              transition: "all 0.3s ease",
            }}
          >
            {new Date().toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <span
            style={{
              backgroundColor: isDark ? "#1e3a5f" : "#dbeafe",
              padding: "0.4rem 1rem",
              borderRadius: "20px",
              fontSize: "0.85rem",
              color: isDark ? "#93c5fd" : "#1d4ed8",
              transition: "all 0.3s ease",
            }}
          >
            Ready to Code 💪
          </span>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;