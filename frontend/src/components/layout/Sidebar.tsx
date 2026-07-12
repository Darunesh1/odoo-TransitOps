import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  LayoutDashboard,
  Truck,
  User,
  MapPin,
  Wrench,
  Fuel,
  BarChart3,
  FileText,
  Bell,
  Settings,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const Sidebar = () => {
  const { accessToken, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem("sidebarCollapsed") === "true";
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
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

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width >= 768 && width < 1024) {
        setCollapsed(true);
      } else if (width >= 1024) {
        const saved = localStorage.getItem("sidebarCollapsed");
        if (saved) {
          setCollapsed(saved === "true");
        } else {
          setCollapsed(false);
        }
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [location]);

  const handleLogout = () => {
    logout();
    navigate("/logout");
  };

  const toggleCollapse = () => setCollapsed(!collapsed);
  const toggleMobile = () => setIsMobileOpen(!isMobileOpen);

  const navItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/fleet", icon: Truck, label: "Fleet" },
    { path: "/drivers", icon: User, label: "Drivers" },
    { path: "/trips", icon: MapPin, label: "Trips" },
    { path: "/maintenance", icon: Wrench, label: "Maintenance" },
    { path: "/fuel", icon: Fuel, label: "Fuel & Expenses" },
    { path: "/analytics", icon: BarChart3, label: "Analytics" },
    { path: "/documents", icon: FileText, label: "Documents" },
    { path: "/notifications", icon: Bell, label: "Notifications" },
  ];

  const bottomItems = [
    { path: "/settings", icon: Settings, label: "Settings" },
  ];

  // 🎨 IMPROVED COLORS (Light: soft slate, Dark: deep gray)
  const colors = {
    background: isDark ? "#111827" : "#F8FAFC",        // soft off-white
    border: isDark ? "#374151" : "#E2E8F0",            // softer border
    text: isDark ? "#F9FAFB" : "#0F172A",              // dark slate
    textMuted: isDark ? "#9CA3AF" : "#64748B",          // muted slate
    hover: isDark ? "#1F2937" : "#EEF4FF",              // subtle blue tint
    active: isDark ? "#2563EB33" : "#DBEAFE",           // blue active background
    activeBorder: "#2563EB",
    hoverText: isDark ? "#F9FAFB" : "#0F172A",
  };

  const linkStyle = (isActive: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: collapsed ? "0" : "12px",
    padding: "11px 14px",                              // consistent spacing
    borderRadius: "10px",
    margin: "4px 12px",                                // cleaner margins
    textDecoration: "none",
    color: isActive ? "#2563EB" : colors.textMuted,    // active → blue
    backgroundColor: isActive ? colors.active : "transparent",
    fontWeight: isActive ? "600" : "500",              // slightly bolder
    transition: "all 0.2s ease",
    borderLeft: isActive ? `4px solid ${colors.activeBorder}` : "4px solid transparent",
    paddingLeft: isActive ? "12px" : "16px",           // adjust for border
    justifyContent: collapsed ? "center" : "flex-start",
    whiteSpace: "nowrap",
    overflow: "hidden",
    position: "relative",
    cursor: "pointer",
    width: "100%",
    boxSizing: "border-box",
  });

  const iconStyle = {
    minWidth: "24px",
    height: "24px",
    flexShrink: 0,
  };

  const sidebarWidth = collapsed ? "80px" : "260px";

  const sidebarContent = (
    <div
      style={{
        width: sidebarWidth,
        height: "100vh",
        backgroundColor: colors.background,
        borderRight: `1px solid ${colors.border}`,
        display: "flex",
        flexDirection: "column",
        transition: "width 0.3s ease, background-color 0.3s ease, border-color 0.3s ease",
        position: "sticky",
        top: 0,
        overflow: "hidden",
        flexShrink: 0,
        // ✨ Light mode shadow – gives the sidebar a floating effect
        boxShadow: isDark ? "none" : "0 1px 12px rgba(15,23,42,0.06)",
      }}
    >
      {/* Logo Section – separate background for visual separation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          padding: "16px 12px",
          borderBottom: `1px solid ${colors.border}`,
          minHeight: "72px",
          transition: "border-color 0.3s ease",
          // 👇 give logo area its own light background to pop
          backgroundColor: isDark ? "#111827" : "#FFFFFF",
        }}
      >
        <Link
          to="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            overflow: "hidden",
            justifyContent: collapsed ? "center" : "flex-start",
            flex: collapsed ? "0" : "1",
          }}
        >
          {/* 🎨 Gradient logo */}
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #2563EB, #3B82F6)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              fontSize: "20px",
              flexShrink: 0,
            }}
          >
            T
          </div>
          {!collapsed && (
            <span
              style={{
                fontWeight: "600",
                fontSize: "1.1rem",
                color: colors.text,
                transition: "color 0.3s ease",
                whiteSpace: "nowrap",
              }}
            >
              TransitOps
            </span>
          )}
        </Link>
        {!collapsed && (
          <button
            onClick={toggleCollapse}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: colors.textMuted,
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "6px",
              transition: "background 0.2s",
              flexShrink: 0,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = colors.hover)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {collapsed && (
          <button
            onClick={toggleCollapse}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: colors.textMuted,
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "6px",
              transition: "background 0.2s",
              flexShrink: 0,
              position: "absolute",
              right: "4px",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = colors.hover)
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav
        style={{
          flex: 1,
          padding: "12px 0",
          overflowY: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
        className="no-scrollbar"
      >
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              style={linkStyle(isActive)}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = colors.hover;
                  e.currentTarget.style.color = colors.hoverText;
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = colors.textMuted;
                }
              }}
            >
              <item.icon size={20} style={iconStyle} />
              {!collapsed && <span>{item.label}</span>}
              {collapsed && (
                <span
                  style={{
                    position: "absolute",
                    left: "70px",
                    backgroundColor: colors.background,
                    padding: "4px 8px",
                    borderRadius: "4px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    fontSize: "0.8rem",
                    color: colors.text,
                    whiteSpace: "nowrap",
                    opacity: 0,
                    pointerEvents: "none",
                    transition: "opacity 0.2s",
                    border: `1px solid ${colors.border}`,
                    zIndex: 999,
                  }}
                  className="tooltip"
                >
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div
        style={{
          borderTop: `1px solid ${colors.border}`,
          padding: "8px 0",
          transition: "border-color 0.3s ease",
        }}
      >
        {bottomItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            style={linkStyle(location.pathname === item.path)}
            onMouseEnter={(e) => {
              if (location.pathname !== item.path) {
                e.currentTarget.style.backgroundColor = colors.hover;
                e.currentTarget.style.color = colors.hoverText;
              }
            }}
            onMouseLeave={(e) => {
              if (location.pathname !== item.path) {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = colors.textMuted;
              }
            }}
          >
            <item.icon size={20} style={iconStyle} />
            {!collapsed && <span>{item.label}</span>}
            {collapsed && (
              <span
                style={{
                  position: "absolute",
                  left: "70px",
                  backgroundColor: colors.background,
                  padding: "4px 8px",
                  borderRadius: "4px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  fontSize: "0.8rem",
                  color: colors.text,
                  whiteSpace: "nowrap",
                  opacity: 0,
                  pointerEvents: "none",
                  transition: "opacity 0.2s",
                  border: `1px solid ${colors.border}`,
                  zIndex: 999,
                }}
                className="tooltip"
              >
                {item.label}
              </span>
            )}
          </Link>
        ))}
        <button
          onClick={handleLogout}
          style={{
            ...linkStyle(false),
            border: "none",
            background: "transparent",
            width: "100%",
            font: "inherit",
            cursor: "pointer",
            justifyContent: collapsed ? "center" : "flex-start",
            margin: "4px 12px",
            padding: "11px 14px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.hover;
            e.currentTarget.style.color = "#ef4444";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = colors.textMuted;
          }}
        >
          <LogOut size={20} style={iconStyle} />
          {!collapsed && <span>Logout</span>}
          {collapsed && (
            <span
              style={{
                position: "absolute",
                left: "70px",
                backgroundColor: colors.background,
                padding: "4px 8px",
                borderRadius: "4px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                fontSize: "0.8rem",
                color: colors.text,
                whiteSpace: "nowrap",
                opacity: 0,
                pointerEvents: "none",
                transition: "opacity 0.2s",
                border: `1px solid ${colors.border}`,
                zIndex: 999,
              }}
              className="tooltip"
            >
              Logout
            </span>
          )}
        </button>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .tooltip {
          opacity: 0 !important;
        }
        a:hover .tooltip,
        button:hover .tooltip {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );

  // Mobile and desktop wrappers – unchanged
  const mobileDrawer = (
    <>
      {isMobileOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 999,
          }}
          onClick={toggleMobile}
        />
      )}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: "280px",
          backgroundColor: colors.background,
          transform: isMobileOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s ease",
          zIndex: 1000,
          boxShadow: "2px 0 12px rgba(0,0,0,0.15)",
        }}
      >
        {sidebarContent}
      </div>
    </>
  );

  const desktopSidebar = (
    <div style={{ display: "flex", height: "100vh", position: "sticky", top: 0 }}>
      {sidebarContent}
    </div>
  );

  return (
    <>
      <button
        onClick={toggleMobile}
        style={{
          display: "none",
          position: "fixed",
          top: "16px",
          left: "16px",
          zIndex: 100,
          background: colors.background,
          border: `1px solid ${colors.border}`,
          borderRadius: "8px",
          padding: "8px",
          color: colors.text,
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
        className="mobile-hamburger"
      >
        <Menu size={24} />
      </button>

      <div style={{ display: "block" }} className="sidebar-mobile">
        {mobileDrawer}
      </div>
      <div style={{ display: "block" }} className="sidebar-desktop">
        {desktopSidebar}
      </div>

      <style>{`
        @media (max-width: 767px) {
          .sidebar-desktop {
            display: none !important;
          }
          .mobile-hamburger {
            display: flex !important;
          }
        }
        @media (min-width: 768px) {
          .sidebar-mobile {
            display: none !important;
          }
          .mobile-hamburger {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
};

export default Sidebar;