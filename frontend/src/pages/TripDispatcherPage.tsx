import React, { useEffect, useState } from "react";
import { tripService } from "../services/tripService";
import { vehicleService } from "../services/vehicleService";
import { driverService } from "../services/driverService";
import { Trip, TripCreate, TripStatus, TripCompleteInput } from "../types/trip";
import { Vehicle } from "../types/vehicle";
import { Driver, DriverStatus } from "../types/driver";

const TripDispatcherPage: React.FC = () => {
  // ─── Theme ──────────────────────────────────────────────
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  useEffect(() => {
    const handleThemeChange = () => {
      setTheme(localStorage.getItem("theme") || "light");
    };
    window.addEventListener("themeChanged", handleThemeChange);
    window.addEventListener("storage", handleThemeChange);
    return () => {
      window.removeEventListener("themeChanged", handleThemeChange);
      window.removeEventListener("storage", handleThemeChange);
    };
  }, []);

  const isDark = theme === "dark";

  // ─── State ──────────────────────────────────────────────
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // All vehicles and drivers for mapping (names, capacities)
  const [vehiclesMap, setVehiclesMap] = useState<Record<string, Vehicle>>({});
  const [driversMap, setDriversMap] = useState<Record<string, Driver>>({});

  // Available resources for dropdowns
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);

  // Create trip form
  const [form, setForm] = useState<TripCreate>({
    source: "",
    destination: "",
    vehicle_id: "",
    driver_id: "",
    cargo_weight: 0,
    planned_distance: 0,
    revenue: 0,
  });
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Complete trip modal state
  const [completingTripId, setCompletingTripId] = useState<string | null>(null);
  const [completeData, setCompleteData] = useState<TripCompleteInput>({
    final_odometer: 0,
    fuel_consumed: 0,
  });

  // ─── Load Data ──────────────────────────────────────────
  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        tripsData,
        allVehicles,
        allDrivers,
        availVehicles,
        availDrivers,
      ] = await Promise.all([
        tripService.getTrips({ limit: 50 }),
        vehicleService.getVehicles({ limit: 100 }),
        driverService.getDrivers({ limit: 100 }),
        vehicleService.getAvailableVehicles(),
        driverService.getAvailableDrivers(),
      ]);

      setTrips(tripsData);

      const vMap: Record<string, Vehicle> = {};
      allVehicles.forEach((v) => (vMap[v.id] = v));
      setVehiclesMap(vMap);

      const dMap: Record<string, Driver> = {};
      allDrivers.forEach((d) => (dMap[d.id] = d));
      setDriversMap(dMap);

      setAvailableVehicles(availVehicles);
      setAvailableDrivers(availDrivers);
    } catch (err: any) {
      console.error("Error loading data:", err);
      setError(err.response?.data?.detail || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // ─── Form Handlers ──────────────────────────────────────
  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        name === "cargo_weight" || name === "planned_distance"
          ? Number(value)
          : value,
    }));

    // Validate capacity on vehicle or cargo change
    if (name === "vehicle_id") {
      const veh = availableVehicles.find((v) => v.id === value) || null;
      setSelectedVehicle(veh);
      if (veh) {
        const cargo = form.cargo_weight || 0;
        const maxLoad = veh.max_load_capacity || 0;
        if (cargo > maxLoad) {
          setCapacityError(`Capacity exceeded by ${cargo - maxLoad} kg`);
        } else {
          setCapacityError(null);
        }
      }
    }

    if (name === "cargo_weight") {
      const cargo = Number(value);
      if (selectedVehicle) {
        const maxLoad = selectedVehicle.max_load_capacity || 0;
        if (cargo > maxLoad) {
          setCapacityError(`Capacity exceeded by ${cargo - maxLoad} kg`);
        } else {
          setCapacityError(null);
        }
      }
    }
  };

  // ─── Create Trip ────────────────────────────────────────
  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (capacityError) {
      alert("Cannot create trip: " + capacityError);
      return;
    }
    setIsSubmitting(true);
    try {
      const newTrip = await tripService.createTrip(form);
      setTrips((prev) => [newTrip, ...prev]);
      setForm({
        source: "",
        destination: "",
        vehicle_id: "",
        driver_id: "",
        cargo_weight: 0,
        planned_distance: 0,
        revenue: 0,
      });
      setSelectedVehicle(null);
      setCapacityError(null);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to create trip");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Dispatch ────────────────────────────────────────────
  const handleDispatch = async (id: string) => {
    try {
      const updated = await tripService.dispatchTrip(id);
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to dispatch trip");
    }
  };

  // ─── Complete ────────────────────────────────────────────
  const handleComplete = async (id: string) => {
    if (!completingTripId) return;
    try {
      const updated = await tripService.completeTrip(id, completeData);
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setCompletingTripId(null);
      setCompleteData({ final_odometer: 0, fuel_consumed: 0 });
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to complete trip");
    }
  };

  // ─── Cancel ──────────────────────────────────────────────
  const handleCancel = async (id: string) => {
    if (!window.confirm("Cancel this trip?")) return;
    try {
      const updated = await tripService.cancelTrip(id);
      setTrips((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to cancel trip");
    }
  };

  // ─── Helpers ────────────────────────────────────────────
  const getStatusColor = (status: TripStatus) => {
    switch (status) {
      case TripStatus.DRAFT:
        return "#9ca3af";
      case TripStatus.DISPATCHED:
        return "#3b82f6";
      case TripStatus.COMPLETED:
        return "#10b981";
      case TripStatus.CANCELLED:
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  // ─── Themed Colors ──────────────────────────────────────
  const colors = {
    bg: isDark ? "#111827" : "#f9fafb",
    cardBg: isDark ? "#1f2937" : "#ffffff",
    border: isDark ? "#374151" : "#e2e8f0",
    text: isDark ? "#f9fafb" : "#0f172a",
    textMuted: isDark ? "#9ca3af" : "#475569",
    inputBg: isDark ? "#374151" : "#ffffff",
    inputBorder: isDark ? "#4b5563" : "#e2e8f0",
    hoverBg: isDark ? "#374151" : "#f1f5f9",
    errorBg: isDark ? "#7f1d1d" : "#fee2e2",
    errorText: isDark ? "#fca5a5" : "#b91c1c",
  };

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "100%",
        backgroundColor: colors.bg,
        minHeight: "100vh",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        color: colors.text,
        transition: "background-color 0.3s, color 0.3s",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
        .btn-primary:hover { background-color: #1d4ed8 !important; }
        .btn-secondary:hover { background-color: ${isDark ? "#4b5563" : "#e5e7eb"} !important; }
        .btn-danger:hover { background-color: #dc2626 !important; }
        .btn-success:hover { background-color: #059669 !important; }
        .trip-card { transition: all 0.2s ease; }
        .trip-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        @media (max-width: 1024px) {
          .trip-layout { flex-direction: column; }
          .trip-form-section { width: 100% !important; }
          .trip-board-section { width: 100% !important; }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 700,
            margin: 0,
            letterSpacing: "-0.02em",
          }}
        >
          Trip Dispatcher
        </h1>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {[TripStatus.DRAFT, TripStatus.DISPATCHED, TripStatus.COMPLETED, TripStatus.CANCELLED].map(
            (status) => (
              <span
                key={status}
                style={{
                  padding: "4px 12px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: 500,
                  backgroundColor: getStatusColor(status) + "20",
                  color: getStatusColor(status),
                  border: `1px solid ${getStatusColor(status)}40`,
                }}
              >
                {status}
              </span>
            )
          )}
        </div>
      </div>

      {/* Two‑column layout */}
      <div
        className="trip-layout"
        style={{
          display: "flex",
          gap: "24px",
          alignItems: "flex-start",
        }}
      >
        {/* Left: Create Trip Form */}
        <div
          className="trip-form-section"
          style={{ flex: "0 0 45%", minWidth: "300px" }}
        >
          <div
            style={{
              backgroundColor: colors.cardBg,
              border: `1px solid ${colors.border}`,
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <h2
              style={{
                fontSize: "18px",
                fontWeight: 600,
                margin: "0 0 16px 0",
              }}
            >
              Create Trip
            </h2>
            <form
              onSubmit={handleCreateTrip}
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <div>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>
                  Source *
                </label>
                <input
                  type="text"
                  name="source"
                  value={form.source}
                  onChange={handleFormChange}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: `1px solid ${colors.inputBorder}`,
                    borderRadius: "8px",
                    fontSize: "14px",
                    backgroundColor: colors.inputBg,
                    color: colors.text,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>
                  Destination *
                </label>
                <input
                  type="text"
                  name="destination"
                  value={form.destination}
                  onChange={handleFormChange}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: `1px solid ${colors.inputBorder}`,
                    borderRadius: "8px",
                    fontSize: "14px",
                    backgroundColor: colors.inputBg,
                    color: colors.text,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>
                  Vehicle (Available Only) *
                </label>
                <select
                  name="vehicle_id"
                  value={form.vehicle_id}
                  onChange={handleFormChange}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: `1px solid ${colors.inputBorder}`,
                    borderRadius: "8px",
                    fontSize: "14px",
                    backgroundColor: colors.inputBg,
                    color: colors.text,
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="">Select vehicle</option>
                  {availableVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} - {v.max_load_capacity} kg capacity
                    </option>
                  ))}
                </select>
                {selectedVehicle && (
                  <div
                    style={{
                      fontSize: "13px",
                      color: colors.textMuted,
                      marginTop: "4px",
                    }}
                  >
                    Max capacity: {selectedVehicle.max_load_capacity} kg
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>
                  Driver (Available Only) *
                </label>
                <select
                  name="driver_id"
                  value={form.driver_id}
                  onChange={handleFormChange}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: `1px solid ${colors.inputBorder}`,
                    borderRadius: "8px",
                    fontSize: "14px",
                    backgroundColor: colors.inputBg,
                    color: colors.text,
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="">Select driver</option>
                  {availableDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.license_number})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>
                  Cargo Weight (kg) *
                </label>
                <input
                  type="number"
                  name="cargo_weight"
                  value={form.cargo_weight}
                  onChange={handleFormChange}
                  required
                  min="0"
                  step="0.01"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: `1px solid ${colors.inputBorder}`,
                    borderRadius: "8px",
                    fontSize: "14px",
                    backgroundColor: colors.inputBg,
                    color: colors.text,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                {capacityError && (
                  <div
                    style={{
                      marginTop: "6px",
                      fontSize: "13px",
                      color: "#ef4444",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>✖</span> {capacityError} — dispatch blocked
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: "14px", fontWeight: 500 }}>
                  Planned Distance (km) *
                </label>
                <input
                  type="number"
                  name="planned_distance"
                  value={form.planned_distance}
                  onChange={handleFormChange}
                  required
                  min="0"
                  step="0.01"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: `1px solid ${colors.inputBorder}`,
                    borderRadius: "8px",
                    fontSize: "14px",
                    backgroundColor: colors.inputBg,
                    color: colors.text,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!!capacityError || isSubmitting}
                  style={{
                    padding: "10px 24px",
                    backgroundColor:
                      capacityError || isSubmitting ? "#94a3b8" : "#2563eb",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    cursor:
                      capacityError || isSubmitting ? "not-allowed" : "pointer",
                    transition: "background-color 0.2s",
                    boxShadow: "0 2px 6px rgba(37,99,235,0.25)",
                    flex: 1,
                  }}
                >
                  {isSubmitting ? "Creating..." : "Create Draft"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    padding: "10px 20px",
                    backgroundColor: isDark ? "#374151" : "#f1f5f9",
                    border: `1px solid ${colors.border}`,
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                    cursor: "pointer",
                    color: colors.text,
                  }}
                  onClick={() => {
                    setForm({
                      source: "",
                      destination: "",
                      vehicle_id: "",
                      driver_id: "",
                      cargo_weight: 0,
                      planned_distance: 0,
                      revenue: 0,
                    });
                    setSelectedVehicle(null);
                    setCapacityError(null);
                  }}
                >
                  Clear
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right: Live Board */}
        <div
          className="trip-board-section"
          style={{ flex: 1, minWidth: "300px" }}
        >
          <div
            style={{
              backgroundColor: colors.cardBg,
              border: `1px solid ${colors.border}`,
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <h2
              style={{
                fontSize: "18px",
                fontWeight: 600,
                margin: "0 0 16px 0",
              }}
            >
              Live Board
            </h2>
            {loading ? (
              <div
                style={{
                  textAlign: "center",
                  color: colors.textMuted,
                  padding: "20px",
                }}
              >
                Loading trips...
              </div>
            ) : error ? (
              <div
                style={{
                  color: colors.errorText,
                  padding: "12px",
                  backgroundColor: colors.errorBg,
                  borderRadius: "8px",
                }}
              >
                {error}
              </div>
            ) : trips.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: colors.textMuted,
                  padding: "20px",
                }}
              >
                No trips yet.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  maxHeight: "600px",
                  overflowY: "auto",
                }}
              >
                {trips.map((trip) => {
                  const statusColor = getStatusColor(trip.status);
                  const vehicle = vehiclesMap[trip.vehicle_id];
                  const driver = driversMap[trip.driver_id];

                  // Capacity check for this trip
                  const capacityErr = vehicle
                    ? trip.cargo_weight > vehicle.max_load_capacity
                      ? `Exceeds capacity by ${trip.cargo_weight - vehicle.max_load_capacity} kg`
                      : null
                    : null;

                  const canDispatch =
                    trip.status === TripStatus.DRAFT && !capacityErr;
                  const canComplete = trip.status === TripStatus.DISPATCHED;
                  const canCancel =
                    trip.status === TripStatus.DRAFT ||
                    trip.status === TripStatus.DISPATCHED;

                  return (
                    <div
                      key={trip.id}
                      className="trip-card"
                      style={{
                        padding: "16px",
                        border: `1px solid ${colors.border}`,
                        borderRadius: "8px",
                        backgroundColor: isDark ? "#1f2937" : "#f8fafc",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          flexWrap: "wrap",
                          gap: "8px",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: "16px",
                            }}
                          >
                            <span
                              style={{
                                color: colors.textMuted,
                                fontWeight: 400,
                              }}
                            >
                              {trip.trip_number}
                            </span>
                            – {trip.source} → {trip.destination}
                          </div>
                          <div
                            style={{
                              fontSize: "13px",
                              color: colors.textMuted,
                              marginTop: "4px",
                            }}
                          >
                            Vehicle: {vehicle?.name || trip.vehicle_id.slice(0, 8)} | Driver:{" "}
                            {driver?.name || trip.driver_id.slice(0, 8)}
                          </div>
                          <div
                            style={{
                              fontSize: "13px",
                              color: colors.textMuted,
                            }}
                          >
                            Cargo: {trip.cargo_weight} kg | Distance:{" "}
                            {trip.planned_distance} km
                          </div>
                          {capacityErr && (
                            <div
                              style={{
                                fontSize: "12px",
                                color: "#ef4444",
                                marginTop: "4px",
                              }}
                            >
                              ✖ {capacityErr}
                            </div>
                          )}
                          <div style={{ marginTop: "6px" }}>
                            <span
                              style={{
                                padding: "2px 10px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                fontWeight: 500,
                                backgroundColor: statusColor + "20",
                                color: statusColor,
                              }}
                            >
                              {trip.status}
                            </span>
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "6px",
                            flexWrap: "wrap",
                          }}
                        >
                          {canDispatch && (
                            <button
                              className="btn-primary"
                              style={{
                                padding: "6px 14px",
                                backgroundColor: "#2563eb",
                                color: "#fff",
                                border: "none",
                                borderRadius: "6px",
                                fontSize: "12px",
                                cursor: "pointer",
                              }}
                              onClick={() => handleDispatch(trip.id)}
                            >
                              Dispatch
                            </button>
                          )}
                          {canComplete && (
                            <button
                              className="btn-success"
                              style={{
                                padding: "6px 14px",
                                backgroundColor: "#10b981",
                                color: "#fff",
                                border: "none",
                                borderRadius: "6px",
                                fontSize: "12px",
                                cursor: "pointer",
                              }}
                              onClick={() => {
                                setCompletingTripId(trip.id);
                                const odometer = window.prompt(
                                  "Final odometer (km):"
                                );
                                const fuel = window.prompt(
                                  "Fuel consumed (litres):"
                                );
                                if (odometer !== null && fuel !== null) {
                                  setCompleteData({
                                    final_odometer: parseFloat(odometer) || 0,
                                    fuel_consumed: parseFloat(fuel) || 0,
                                  });
                                  handleComplete(trip.id);
                                } else {
                                  setCompletingTripId(null);
                                }
                              }}
                            >
                              Complete
                            </button>
                          )}
                          {canCancel && (
                            <button
                              className="btn-danger"
                              style={{
                                padding: "6px 14px",
                                backgroundColor: "#ef4444",
                                color: "#fff",
                                border: "none",
                                borderRadius: "6px",
                                fontSize: "12px",
                                cursor: "pointer",
                              }}
                              onClick={() => handleCancel(trip.id)}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rule note */}
      <div
        style={{
          marginTop: "24px",
          fontSize: "13px",
          color: colors.textMuted,
          padding: "8px 0",
        }}
      >
        <strong>Rule:</strong> Cargo weight must not exceed vehicle max load
        capacity. Dispatch disabled until valid.
      </div>
    </div>
  );
};

export default TripDispatcherPage;