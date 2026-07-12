import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axiosInstance";
import ThemeToggle from "../components/ThemeToggle";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "light";
  });

  useEffect(() => {
    const handler = () => setTheme(localStorage.getItem("theme") || "light");
    window.addEventListener("themeChanged", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("themeChanged", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token found. Please check your email link.");
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await api.get(`/auth/verify-email?token=${token}`);
        setStatus("success");
        setMessage(response.data || "Email verified successfully!");
      } catch (error: any) {
        setStatus("error");
        const detail = error?.response?.data?.detail;
        if (typeof detail === "string") {
          setMessage(detail);
        } else if (Array.isArray(detail)) {
          setMessage(detail.map((d: any) => d.msg).join(", "));
        } else {
          setMessage("Email verification failed. The link may be expired or invalid.");
        }
      }
    };

    verifyEmail();
  }, [token]);

  const isDark = theme === "dark";

  // Shared styles for the card
  const cardStyle = {
    backgroundColor: isDark ? "#1f2937" : "#ffffff",
    padding: "2.5rem 2rem",
    borderRadius: "16px",
    boxShadow: isDark
      ? "0 25px 50px -12px rgba(0,0,0,0.5)"
      : "0 20px 40px -12px rgba(0,0,0,0.15)",
    width: "100%",
    maxWidth: "420px",
    margin: "0 1rem",
    textAlign: "center" as const,
    transition: "all 0.3s ease",
  };

  const headingStyle = {
    fontSize: "1.75rem",
    fontWeight: "bold",
    color: isDark ? "#f9fafb" : "#111827",
    marginBottom: "0.75rem",
  };

  const textStyle = {
    color: isDark ? "#9ca3af" : "#6b7280",
    fontSize: "1rem",
    lineHeight: "1.6",
    marginBottom: "1.5rem",
  };

  const buttonStyle = {
    display: "inline-block",
    padding: "12px 36px",
    backgroundColor: "#2563eb",
    color: "white",
    textDecoration: "none",
    borderRadius: "8px",
    fontWeight: "600",
    fontSize: "1rem",
    transition: "all 0.2s",
    cursor: "pointer",
    border: "none",
  };

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
        padding: "1rem",
      }}
    >
      {/* Theme Toggle */}
      <div style={{ position: "fixed", top: "20px", right: "20px", zIndex: 999 }}>
        <ThemeToggle />
      </div>

      {/* Card */}
      <div style={cardStyle}>
        {status === "loading" && (
          <>
            <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>⏳</div>
            <h2 style={headingStyle}>Verifying Your Email</h2>
            <p style={textStyle}>
              Please wait while we verify your email address...
            </p>
            <div
              style={{
                width: "40px",
                height: "40px",
                margin: "1.5rem auto 0",
                border: "4px solid " + (isDark ? "#374151" : "#e5e7eb"),
                borderTop: "4px solid #2563eb",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
          </>
        )}

        {status === "success" && (
          <>
            <div
              style={{
                fontSize: "4rem",
                marginBottom: "1rem",
                display: "flex",
                justifyContent: "center",
              }}
            >
              ✅
            </div>
            <h2 style={headingStyle}>Email Verified!</h2>
            <p style={textStyle}>
              {message}
              <br />
              <span style={{ fontSize: "0.9rem", opacity: 0.8 }}>
                You can now sign in to your account.
              </span>
            </p>
            <Link
              to="/login"
              style={buttonStyle}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1d4ed8")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
            >
              Sign In Now →
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>❌</div>
            <h2 style={{ ...headingStyle, color: "#ef4444" }}>Verification Failed</h2>
            <p style={{ ...textStyle, color: "#ef4444" }}>{message}</p>
            <Link
              to="/login"
              style={{
                ...buttonStyle,
                backgroundColor: "#ef4444",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#dc2626")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#ef4444")}
            >
              Go to Login
            </Link>
          </>
        )}
      </div>

      {/* Inline spin animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default VerifyEmail;