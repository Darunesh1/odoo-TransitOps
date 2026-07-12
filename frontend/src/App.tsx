import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Logout from "./pages/Logout";
import VerifyEmail from "./pages/VerifyEmail";
import Sidebar from "./components/layout/Sidebar";

// Placeholder components – replace with real pages later
const Fleet = () => <div style={{ padding: "2rem" }}>🚚 Fleet Page</div>;
const Drivers = () => <div style={{ padding: "2rem" }}>👨‍✈️ Drivers Page</div>;
const Trips = () => <div style={{ padding: "2rem" }}>📍 Trips Page</div>;
const Maintenance = () => <div style={{ padding: "2rem" }}>🔧 Maintenance Page</div>;
const Fuel = () => <div style={{ padding: "2rem" }}>⛽ Fuel & Expenses Page</div>;
const Analytics = () => <div style={{ padding: "2rem" }}>📊 Analytics Page</div>;
const Documents = () => <div style={{ padding: "2rem" }}>📄 Documents Page</div>;
const Notifications = () => <div style={{ padding: "2rem" }}>🔔 Notifications Page</div>;
const Settings = () => <div style={{ padding: "2rem" }}>⚙️ Settings Page</div>;

// Layout with sidebar and main content area
const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <Sidebar />
      <main style={{ flex: 1, padding: "2rem", overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
};

const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const { accessToken } = useAuth();
  return accessToken ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/logout" element={<Logout />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* Protected routes with sidebar layout */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout>
                  <Navigate to="/dashboard" />
                </Layout>
              </PrivateRoute>
            }
          />
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
                  <Fleet />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/drivers"
            element={
              <PrivateRoute>
                <Layout>
                  <Drivers />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/trips"
            element={
              <PrivateRoute>
                <Layout>
                  <Trips />
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

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;


