import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const Register = () => {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "light";
  });

  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await register(fullName, email, password);
      setSuccess(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg).join(", "));
      } else if (typeof detail === "string") {
        setError(detail);
      } else {
        setError(err?.message || "Registration failed");
      }
    } finally {
      setLoading(false);
    }
  };

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
      }}
    >
      {/* Theme Toggle Button - Top Right */}
      <button
        onClick={toggleTheme}
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          padding: "12px",
          borderRadius: "50%",
          border: "1px solid " + (isDark ? "#374151" : "#e5e7eb"),
          backgroundColor: isDark ? "#1f2937" : "#ffffff",
          color: isDark ? "#f9fafb" : "#111827",
          fontSize: "24px",
          cursor: "pointer",
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          transition: "all 0.3s ease",
          zIndex: 999,
        }}
        aria-label="Toggle theme"
      >
        {isDark ? "☀️" : "🌙"}
      </button>

      {/* Register Card */}
      <div
        style={{
          backgroundColor: isDark ? "#1f2937" : "#ffffff",
          padding: "2rem",
          borderRadius: "12px",
          boxShadow: isDark
            ? "0 25px 50px -12px rgba(0,0,0,0.5)"
            : "0 25px 50px -12px rgba(0,0,0,0.25)",
          width: "100%",
          maxWidth: "420px",
          margin: "0 1rem",
          transition: "all 0.3s ease",
        }}
      >
        {/* Heading - only show when not success */}
        {!success && (
          <>
            <h2
              style={{
                fontSize: "1.75rem",
                fontWeight: "bold",
                textAlign: "center",
                color: isDark ? "#f9fafb" : "#111827",
                marginBottom: "0.5rem",
              }}
            >
              Create Account
            </h2>
            <p
              style={{
                textAlign: "center",
                color: isDark ? "#9ca3af" : "#6b7280",
                marginBottom: "1.5rem",
                fontSize: "0.95rem",
              }}
            >
              Join us and get started
            </p>
          </>
        )}

        {success && (
          <>
            <div
              style={{
                backgroundColor: isDark ? "#065f46" : "#d1fae5",
                color: isDark ? "#6ee7b7" : "#065f46",
                padding: "0.75rem",
                borderRadius: "8px",
                marginBottom: "0.75rem",
                textAlign: "center",
                fontSize: "0.9rem",
              }}
            >
              ✅ Registration successful! Please check your email to verify your account.
            </div>
            <div
              style={{
                backgroundColor: isDark ? "#1e3a5f" : "#dbeafe",
                color: isDark ? "#93c5fd" : "#1e40af",
                padding: "0.75rem",
                borderRadius: "8px",
                marginBottom: "1rem",
                textAlign: "center",
                fontSize: "0.85rem",
              }}
            >
              📧 A verification link has been sent to <strong>{email}</strong>
              <br />
              <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>
                (Check your spam folder if you don't see it)
              </span>
            </div>
            <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
                <Link
                to="/login"
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px 28px",
                    backgroundColor: "#2563eb",
                    color: "white",
                    textDecoration: "none",
                    borderRadius: "8px",
                    fontWeight: "600",
                    fontSize: "1rem",
                    transition: "all 0.2s",
                    border: "none",
                    cursor: "pointer",
                    letterSpacing: "0.5px",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1d4ed8")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
                >
                <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>⏻</span>
                LOGIN NOW
                </Link>
            </div>
          </>
        )}

        {error && (
          <div
            style={{
              backgroundColor: isDark ? "#7f1d1d" : "#fee2e2",
              color: isDark ? "#fca5a5" : "#dc2626",
              padding: "0.75rem",
              borderRadius: "8px",
              marginBottom: "1rem",
              textAlign: "center",
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: "500",
                  color: isDark ? "#e5e7eb" : "#374151",
                  fontSize: "0.9rem",
                }}
              >
                Full Name
              </label>
              <input
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid " + (isDark ? "#374151" : "#d1d5db"),
                  borderRadius: "8px",
                  backgroundColor: isDark ? "#374151" : "#f9fafb",
                  color: isDark ? "#f9fafb" : "#111827",
                  fontSize: "1rem",
                  outline: "none",
                  transition: "border-color 0.2s",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
                onBlur={(e) =>
                  (e.target.style.borderColor = isDark ? "#374151" : "#d1d5db")
                }
                required
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: "500",
                  color: isDark ? "#e5e7eb" : "#374151",
                  fontSize: "0.9rem",
                }}
              >
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid " + (isDark ? "#374151" : "#d1d5db"),
                  borderRadius: "8px",
                  backgroundColor: isDark ? "#374151" : "#f9fafb",
                  color: isDark ? "#f9fafb" : "#111827",
                  fontSize: "1rem",
                  outline: "none",
                  transition: "border-color 0.2s",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
                onBlur={(e) =>
                  (e.target.style.borderColor = isDark ? "#374151" : "#d1d5db")
                }
                required
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: "500",
                  color: isDark ? "#e5e7eb" : "#374151",
                  fontSize: "0.9rem",
                }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    paddingRight: "3rem",
                    border: "1px solid " + (isDark ? "#374151" : "#d1d5db"),
                    borderRadius: "8px",
                    backgroundColor: isDark ? "#374151" : "#f9fafb",
                    color: isDark ? "#f9fafb" : "#111827",
                    fontSize: "1rem",
                    outline: "none",
                    transition: "border-color 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
                  onBlur={(e) =>
                    (e.target.style.borderColor = isDark ? "#374151" : "#d1d5db")
                  }
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    fontSize: "1.2rem",
                    cursor: "pointer",
                    color: isDark ? "#9ca3af" : "#6b7280",
                    padding: "4px",
                  }}
                >
                  {showPassword ? "👁️" : "🔒"}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: "500",
                  color: isDark ? "#e5e7eb" : "#374151",
                  fontSize: "0.9rem",
                }}
              >
                Confirm Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid " + (isDark ? "#374151" : "#d1d5db"),
                  borderRadius: "8px",
                  backgroundColor: isDark ? "#374151" : "#f9fafb",
                  color: isDark ? "#f9fafb" : "#111827",
                  fontSize: "1rem",
                  outline: "none",
                  transition: "border-color 0.2s",
                  boxSizing: "border-box",
                  borderColor: confirmPassword && password !== confirmPassword
                    ? "#dc2626"
                    : confirmPassword && password === confirmPassword
                    ? "#16a34a"
                    : isDark ? "#374151" : "#d1d5db",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
                onBlur={(e) => {
                  if (confirmPassword && password !== confirmPassword) {
                    e.target.style.borderColor = "#dc2626";
                  } else if (confirmPassword && password === confirmPassword) {
                    e.target.style.borderColor = "#16a34a";
                  } else {
                    e.target.style.borderColor = isDark ? "#374151" : "#d1d5db";
                  }
                }}
                required
              />
              {confirmPassword && password !== confirmPassword && (
                <p style={{ color: "#dc2626", fontSize: "0.8rem", marginTop: "4px" }}>
                  Passwords do not match
                </p>
              )}
              {confirmPassword && password === confirmPassword && (
                <p style={{ color: "#16a34a", fontSize: "0.8rem", marginTop: "4px" }}>
                  ✓ Passwords match
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || (confirmPassword !== "" && password !== confirmPassword)}
              style={{
                width: "100%",
                padding: "0.8rem",
                backgroundColor:
                  loading || (confirmPassword !== "" && password !== confirmPassword)
                    ? "#9ca3af"
                    : "#16a34a",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontWeight: "600",
                fontSize: "1rem",
                cursor:
                  loading || (confirmPassword !== "" && password !== confirmPassword)
                    ? "not-allowed"
                    : "pointer",
                transition: "background-color 0.2s",
              }}
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
        )}

        {!success && (
          <p
            style={{
              textAlign: "center",
              marginTop: "1.5rem",
              fontSize: "0.9rem",
              color: isDark ? "#9ca3af" : "#6b7280",
            }}
          >
            Already have an account?{" "}
            <Link
              to="/login"
              style={{
                color: "#2563eb",
                textDecoration: "underline",
                fontWeight: "500",
              }}
            >
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default Register;