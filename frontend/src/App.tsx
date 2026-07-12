import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, UserRole } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Logout from "./pages/Logout";
import Sidebar from "./components/layout/Sidebar";
import FleetPage from "./pages/FleetPage";
import DriversPage from "./pages/DriversPage"; 
import TripDispatcherPage from "./pages/TripDispatcherPage";

// Placeholder components for other pages
const Trips = () => <div style={{ padding: "2rem" }}>📍 Trips Page</div>;
const Maintenance = () => <div style={{ padding: "2rem" }}>🔧 Maintenance Page</div>;
const Fuel = () => <div style={{ padding: "2rem" }}>⛽ Fuel & Expenses Page</div>;
const Analytics = () => <div style={{ padding: "2rem" }}>📊 Analytics Page</div>;
const Documents = () => <div style={{ padding: "2rem" }}>📄 Documents Page</div>;
const Notifications = () => <div style={{ padding: "2rem" }}>🔔 Notifications Page</div>;
const Settings = () => <div style={{ padding: "2rem" }}>⚙️ Settings Page</div>;
const Users = () => <div style={{ padding: "2rem" }}>👤 User Management (ADMIN)</div>;
const Forbidden = () => <div style={{ padding: "2rem" }}>⛔ 403 Forbidden</div>;

// Layout: Sidebar only (no Navbar)
const Layout = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "flex", height: "100vh" }}>
    <Sidebar />
    <main style={{ flex: 1, padding: "2rem", overflowY: "auto" }}>
      {children}
    </main>
  </div>
);

// Route guards
const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div style={{ padding: "2rem" }}>Loading...</div>;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const RoleRoute = ({
  children,
  allowedRoles,
}: {
  children: JSX.Element;
  allowedRoles: UserRole[];
}) => {
  const { user, loading, isAuthenticated } = useAuth();
  if (loading) return <div style={{ padding: "2rem" }}>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return user && allowedRoles.includes(user.role)
    ? children
    : <Navigate to="/403" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/logout" element={<Logout />} />
          <Route path="/403" element={<Forbidden />} />

          {/* Protected routes with sidebar */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/fleet"
            element={
              <PrivateRoute>
                <Layout>
                  <FleetPage />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/drivers"
            element={
              <PrivateRoute>
                <Layout>
                  <DriversPage /> 
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/trips"
            element={
              <PrivateRoute>
                <Layout>
                  <TripDispatcherPage />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/maintenance"
            element={
              <PrivateRoute>
                <Layout>
                  <Maintenance />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/fuel"
            element={
              <PrivateRoute>
                <Layout>
                  <Fuel />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <PrivateRoute>
                <Layout>
                  <Analytics />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/documents"
            element={
              <PrivateRoute>
                <Layout>
                  <Documents />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <PrivateRoute>
                <Layout>
                  <Notifications />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <PrivateRoute>
                <Layout>
                  <Settings />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/users"
            element={
              <RoleRoute allowedRoles={["ADMIN"]}>
                <Layout>
                  <Users />
                </Layout>
              </RoleRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;