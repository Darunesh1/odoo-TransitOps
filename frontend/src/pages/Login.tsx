import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Fleet Manager");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // UI state
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Theme
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "light";
  });

  // Lock state (persisted)
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    const stored = localStorage.getItem("loginFailedAttempts");
    return stored ? parseInt(stored, 10) : 0;
  });
  const [lockUntil, setLockUntil] = useState<number | null>(() => {
    const stored = localStorage.getItem("loginLockUntil");
    return stored ? parseInt(stored, 10) : null;
  });

  // Check lock status
  const isLocked = lockUntil !== null && Date.now() < lockUntil;

  // Load remembered email if it exists
  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Theme toggle effect
  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  // Save failed attempts and lock state
  const updateLockState = (attempts: number, lockTime: number | null) => {
    setFailedAttempts(attempts);
    localStorage.setItem("loginFailedAttempts", attempts.toString());
    if (lockTime) {
      setLockUntil(lockTime);
      localStorage.setItem("loginLockUntil", lockTime.toString());
    } else {
      setLockUntil(null);
      localStorage.removeItem("loginLockUntil");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Check if account is locked
    if (isLocked) {
      const remaining = Math.ceil((lockUntil! - Date.now()) / 60000);
      setError(`Account locked. Try again in ${remaining} minute(s).`);
      return;
    }

    setLoading(true);
    try {
      // Call login with email, password, and rememberMe (third param expects boolean)
      await login(email, password, rememberMe);
      // Success → reset failed attempts
      updateLockState(0, null);
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }
      navigate("/dashboard");
    } catch (err: any) {
      // Failed login → increment attempts
      const newAttempts = failedAttempts + 1;
      let lockTime: number | null = null;
      if (newAttempts >= 5) {
        // Lock for 5 minutes
        lockTime = Date.now() + 5 * 60 * 1000;
        setError("Too many failed attempts. Account locked for 5 minutes.");
      } else {
        const remaining = 5 - newAttempts;
        setError(`Invalid credentials. ${remaining} attempt(s) remaining.`);
      }
      updateLockState(newAttempts, lockTime);

      // Also show any backend error if available
      const detail = err?.response?.data?.detail;
      if (detail) {
        if (Array.isArray(detail)) {
          setError(detail.map((d: any) => d.msg).join(", "));
        } else if (typeof detail === "string") {
          setError(detail);
        }
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
      {/* Theme Toggle Button */}
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

      {/* Login Card */}
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
        <h2
          style={{
            fontSize: "1.75rem",
            fontWeight: "bold",
            textAlign: "center",
            color: isDark ? "#f9fafb" : "#111827",
            marginBottom: "0.5rem",
          }}
        >
          Sign in to your account
        </h2>
        <p
          style={{
            textAlign: "center",
            color: isDark ? "#9ca3af" : "#6b7280",
            marginBottom: "1.5rem",
            fontSize: "0.95rem",
          }}
        >
          Enter your credentials to continue
        </p>

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

        <form onSubmit={handleSubmit}>
          {/* Email */}
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
              EMAIL
            </label>
            <input
              type="email"
              placeholder="Raven.k@transitops.in"
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

          {/* Password */}
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
              PASSWORD
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="********"
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
                aria-label="Toggle password visibility"
              >
                {showPassword ? "👁️" : "🔒"}
              </button>
            </div>
          </div>

          {/* Role (RBAC) */}
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
              ROLE (RBAC)
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
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
                cursor: "pointer",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
              onBlur={(e) =>
                (e.target.style.borderColor = isDark ? "#374151" : "#d1d5db")
              }
            >
              <option value="Fleet Manager">Fleet Manager</option>
              <option value="Driver">Driver</option>
              <option value="Safety Officer">Safety Officer</option>
              <option value="Financial Analyst">Financial Analyst</option>
            </select>
          </div>

          {/* Remember me & Forgot password */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.5rem",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.9rem",
                color: isDark ? "#e5e7eb" : "#374151",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{
                  width: "1rem",
                  height: "1rem",
                  accentColor: "#2563eb",
                  cursor: "pointer",
                }}
              />
              Remember me
            </label>
            <Link
              to="/forgot-password"
              style={{
                fontSize: "0.9rem",
                color: "#2563eb",
                textDecoration: "underline",
              }}
            >
              Forgot password?
            </Link>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={loading || isLocked}
            style={{
              width: "100%",
              padding: "0.8rem",
              backgroundColor:
                loading || isLocked ? "#60a5fa" : "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: "600",
              fontSize: "1rem",
              cursor: loading || isLocked ? "not-allowed" : "pointer",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              if (!loading && !isLocked)
                e.currentTarget.style.backgroundColor = "#1d4ed8";
            }}
            onMouseLeave={(e) => {
              if (!loading && !isLocked)
                e.currentTarget.style.backgroundColor = "#2563eb";
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;