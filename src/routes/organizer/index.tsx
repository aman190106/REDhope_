import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { toast } from "../../components/AppToaster";
import { LocationPickerMap } from "../../components/LocationPickerMap";

export const Route = createFileRoute("/organizer/")({
  head: () => ({
    meta: [
      { title: "Organizer Dashboard — REDhope" },
      {
        name: "description",
        content: "Manage blood donation camps, review donor registrations, and monitor camp capacity.",
      },
      { property: "og:title", content: "Organizer Dashboard — REDhope" },
      { property: "og:description", content: "Manage blood donation drives and registered donors." },
    ],
  }),
  component: OrganizerDashboardPage,
});

import { API_BASE_URL } from "../../lib/api";
const API_BASE = API_BASE_URL;

interface CampLocation {
  address: string;
  city: string;
  state: string;
  pincode: string;
  coordinates?: [number, number];
}

interface CampItem {
  _id: string;
  name: string;
  description?: string;
  location: CampLocation;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  registrationCount: number;
  status: "draft" | "published" | "completed" | "cancelled";
  createdAt?: string;
}

interface UserProfile {
  _id: string;
  name: string;
  email: string;
  role: "user" | "organizer" | "admin";
}

function OrganizerDashboardPage() {
  const navigate = useNavigate();

  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Camps state
  const [camps, setCamps] = useState<CampItem[]>([]);
  const [loadingCamps, setLoadingCamps] = useState(false);
  const [campsError, setCampsError] = useState<string | null>(null);

  // Status tab filter
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Create Camp modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingCamp, setCreatingCamp] = useState(false);
  const [newCampName, setNewCampName] = useState("");
  const [newCampDescription, setNewCampDescription] = useState("");
  const [newCampAddress, setNewCampAddress] = useState("");
  const [newCampCity, setNewCampCity] = useState("");
  const [newCampState, setNewCampState] = useState("");
  const [newCampPincode, setNewCampPincode] = useState("");
  const [newCampLng, setNewCampLng] = useState("");
  const [newCampLat, setNewCampLat] = useState("");
  const [newCampStartDate, setNewCampStartDate] = useState("");
  const [newCampEndDate, setNewCampEndDate] = useState("");
  const [newCampStartTime, setNewCampStartTime] = useState("09:00");
  const [newCampEndTime, setNewCampEndTime] = useState("17:00");
  const [newCampCapacity, setNewCampCapacity] = useState("50");

  // Check auth and role
  useEffect(() => {
    const savedToken = localStorage.getItem("token") || localStorage.getItem("redhope_token");
    if (!savedToken) {
      setLoadingAuth(false);
      return;
    }

    setToken(savedToken);
    checkAuth(savedToken);
  }, []);

  const checkAuth = async (authToken: string) => {
    setLoadingAuth(true);
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (res.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("redhope_token");
        setToken(null);
        setCurrentUser(null);
        return;
      }

      const json = await res.json();
      if (res.ok && json.success && json.user) {
        setCurrentUser(json.user);
        if (json.user.role === "organizer" || json.user.role === "admin") {
          fetchMyCamps(authToken);
        }
      }
    } catch (err) {
      console.error("Auth check error:", err);
    } finally {
      setLoadingAuth(false);
    }
  };

  const fetchMyCamps = async (authToken: string) => {
    setLoadingCamps(true);
    setCampsError(null);
    try {
      // status=all with authorization returns all organizer's camps
      const res = await fetch(`${API_BASE}/camps?status=all`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setCampsError(json.message || "Failed to load camps.");
        setCamps([]);
        return;
      }

      setCamps(json.camps || []);
    } catch (err) {
      console.error("Error loading camps:", err);
      setCampsError("Could not reach backend server to fetch camps.");
      setCamps([]);
    } finally {
      setLoadingCamps(false);
    }
  };

  // Lifecycle action handler (e.g. Publish draft, Cancel camp)
  const handleUpdateStatus = async (campId: string, newStatus: string) => {
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/camps/${campId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || `Failed to update camp status to ${newStatus}.`);
        return;
      }

      toast.success(
        newStatus === "published"
          ? "Camp published successfully!"
          : newStatus === "cancelled"
          ? "Camp cancelled."
          : `Camp status updated to ${newStatus}.`
      );

      // Refresh list
      fetchMyCamps(token);
    } catch (err) {
      console.error("Status update error:", err);
      toast.error("Network error while updating camp status.");
    }
  };

  // Handle Create Camp submission
  const handleCreateCamp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!newCampName.trim() || newCampName.trim().length < 3) {
      toast.error("Camp name must be at least 3 characters.");
      return;
    }

    if (!newCampAddress.trim() || !newCampCity.trim() || !newCampState.trim() || !newCampPincode.trim()) {
      toast.error("Address, city, state, and 6-digit pincode are required.");
      return;
    }

    if (!/^[1-9][0-9]{5}$/.test(newCampPincode.trim())) {
      toast.error("Pincode must be a valid 6-digit Indian pincode.");
      return;
    }

    if (!newCampStartDate || !newCampEndDate) {
      toast.error("Start date and end date are required.");
      return;
    }

    const locData: CampLocation = {
      address: newCampAddress.trim(),
      city: newCampCity.trim(),
      state: newCampState.trim(),
      pincode: newCampPincode.trim(),
    };

    if (newCampLng.trim() && newCampLat.trim()) {
      const lng = Number(newCampLng);
      const lat = Number(newCampLat);
      if (isNaN(lng) || isNaN(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        toast.error("Coordinates must be valid numbers (lng: -180..180, lat: -90..90).");
        return;
      }
      locData.coordinates = [lng, lat];
    }

    const payload = {
      name: newCampName.trim(),
      description: newCampDescription.trim() || undefined,
      location: locData,
      startDate: newCampStartDate,
      endDate: newCampEndDate,
      startTime: newCampStartTime,
      endTime: newCampEndTime,
      capacity: Number(newCampCapacity) || 50,
      status: "draft",
    };

    setCreatingCamp(true);
    try {
      const res = await fetch(`${API_BASE}/camps`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to create camp.");
        return;
      }

      toast.success("Camp created as Draft! You can review and publish it.");
      setShowCreateModal(false);

      // Reset form fields
      setNewCampName("");
      setNewCampDescription("");
      setNewCampAddress("");
      setNewCampCity("");
      setNewCampState("");
      setNewCampPincode("");
      setNewCampLng("");
      setNewCampLat("");
      setNewCampStartDate("");
      setNewCampEndDate("");
      setNewCampStartTime("09:00");
      setNewCampEndTime("17:00");
      setNewCampCapacity("50");

      fetchMyCamps(token);
    } catch (err) {
      console.error("Create camp error:", err);
      toast.error("Failed to connect to the server.");
    } finally {
      setCreatingCamp(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Compute summary stats
  const totalCamps = camps.length;
  const draftCamps = camps.filter((c) => c.status === "draft").length;
  const publishedCamps = camps.filter((c) => c.status === "published").length;
  const completedCamps = camps.filter((c) => c.status === "completed").length;
  const cancelledCamps = camps.filter((c) => c.status === "cancelled").length;
  const totalRegistrations = camps.reduce((sum, c) => sum + (c.registrationCount || 0), 0);

  // Filtered camps based on active tab
  const displayedCamps =
    statusFilter === "all" ? camps : camps.filter((c) => c.status === statusFilter);

  return (
    <>
      <Navbar solid />

      <section className="hero hero-compact" style={{ minHeight: "30vh" }}>
        <div className="hero-inner">
          <h1>Organizer Dashboard</h1>
          <p>
            {currentUser?.role === "admin"
              ? "Administrator Camp Management & Donor Records"
              : "Organize camps, track capacities, and manage registered donors"}
          </p>
        </div>
      </section>

      <section className="features" style={{ backgroundColor: "var(--background)", minHeight: "65vh", paddingTop: 40, paddingBottom: 60 }}>
        <div className="container">
          {loadingAuth ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <i className="fas fa-spinner fa-spin fa-3x" style={{ color: "var(--primary)" }} />
              <p style={{ marginTop: 16, color: "var(--gray)" }}>Verifying permissions...</p>
            </div>
          ) : !token ? (
            /* Unauthenticated */
            <div
              className="form-section"
              style={{
                textAlign: "center",
                padding: "60px 30px",
                maxWidth: 500,
                margin: "0 auto",
              }}
            >
              <i className="fas fa-lock fa-3x" style={{ color: "var(--primary)", marginBottom: 16 }} />
              <h3 style={{ justifyContent: "center" }}>Authentication Required</h3>
              <p style={{ color: "var(--gray)", marginBottom: 24, fontSize: 14 }}>
                Please sign in with your organizer or administrator account to access the dashboard.
              </p>
              <Link to="/login" className="btn">
                Sign In to REDhope
              </Link>
            </div>
          ) : currentUser?.role !== "organizer" && currentUser?.role !== "admin" ? (
            /* Normal User: Permission Denied */
            <div
              className="form-section"
              style={{
                textAlign: "center",
                padding: "60px 30px",
                maxWidth: 550,
                margin: "0 auto",
                borderColor: "rgba(227, 6, 19, 0.2)",
              }}
            >
              <i className="fas fa-ban fa-3x" style={{ color: "var(--primary)", marginBottom: 16 }} />
              <h3 style={{ justifyContent: "center", color: "var(--primary)" }}>Access Denied</h3>
              <p style={{ color: "var(--gray)", marginBottom: 20, fontSize: 15, lineHeight: 1.6 }}>
                Your account role is <strong>Donor ({currentUser?.role})</strong>. The Organizer Dashboard is reserved for verified blood drive organizers and administrators.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <Link to="/camps" className="btn">
                  Browse Blood Camps
                </Link>
                <Link to="/organize" className="btn btn-outline">
                  Apply to Host a Camp
                </Link>
              </div>
            </div>
          ) : (
            /* Authorized Organizer or Admin View */
            <div>
              {/* Top Action Bar */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 16,
                  marginBottom: 30,
                }}
              >
                <div>
                  <h2 style={{ fontSize: "1.6rem", color: "var(--secondary)", margin: 0 }}>
                    Welcome back, {currentUser?.name}
                  </h2>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      padding: "2px 8px",
                      borderRadius: 4,
                      backgroundColor: currentUser?.role === "admin" ? "#b00000" : "var(--secondary)",
                      color: "white",
                      marginTop: 4,
                      display: "inline-block",
                    }}
                  >
                    Role: {currentUser?.role}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <Link
                    to="/organizer/analytics"
                    className="btn btn-outline"
                    style={{ padding: "10px 18px", fontSize: 13 }}
                  >
                    <i className="fas fa-chart-line" style={{ marginRight: 6 }} /> Analytics
                  </Link>
                  <button
                    type="button"
                    onClick={() => fetchMyCamps(token)}
                    className="btn btn-outline"
                    style={{ padding: "10px 18px", fontSize: 13 }}
                  >
                    <i className="fas fa-rotate" style={{ marginRight: 6 }} /> Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="btn"
                    style={{ padding: "10px 20px", fontSize: 13 }}
                  >
                    <i className="fas fa-plus" style={{ marginRight: 6 }} /> Create New Camp
                  </button>
                </div>
              </div>

              {/* Summary Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                  gap: 18,
                  marginBottom: 35,
                }}
              >
                <div className="form-section" style={{ margin: 0, padding: "20px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "var(--secondary)" }}>{totalCamps}</div>
                  <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 4 }}>Total Camps</div>
                </div>

                <div className="form-section" style={{ margin: 0, padding: "20px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#6c757d" }}>{draftCamps}</div>
                  <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 4 }}>Drafts</div>
                </div>

                <div className="form-section" style={{ margin: 0, padding: "20px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#28a745" }}>{publishedCamps}</div>
                  <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 4 }}>Published</div>
                </div>

                <div className="form-section" style={{ margin: 0, padding: "20px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "var(--secondary)" }}>{completedCamps}</div>
                  <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 4 }}>Completed</div>
                </div>

                <div className="form-section" style={{ margin: 0, padding: "20px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#dc3545" }}>{cancelledCamps}</div>
                  <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 4 }}>Cancelled</div>
                </div>

                <div className="form-section" style={{ margin: 0, padding: "20px 24px", textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "var(--primary)" }}>{totalRegistrations}</div>
                  <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 4 }}>Total Donors</div>
                </div>
              </div>

              {/* Status Tab Filters */}
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginBottom: 24,
                  flexWrap: "wrap",
                  borderBottom: "1px solid var(--light-gray)",
                  paddingBottom: 10,
                }}
              >
                {[
                  { key: "all", label: `All (${totalCamps})` },
                  { key: "draft", label: `Draft (${draftCamps})` },
                  { key: "published", label: `Published (${publishedCamps})` },
                  { key: "completed", label: `Completed (${completedCamps})` },
                  { key: "cancelled", label: `Cancelled (${cancelledCamps})` },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatusFilter(tab.key)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "6px 14px",
                      fontSize: 14,
                      fontWeight: 600,
                      color: statusFilter === tab.key ? "var(--primary)" : "var(--gray)",
                      borderBottom: statusFilter === tab.key ? "2px solid var(--primary)" : "2px solid transparent",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Camps List / Table */}
              {loadingCamps ? (
                <div style={{ textAlign: "center", padding: "60px 0" }}>
                  <i className="fas fa-spinner fa-spin fa-3x" style={{ color: "var(--primary)" }} />
                  <p style={{ marginTop: 16, color: "var(--gray)" }}>Loading camps...</p>
                </div>
              ) : campsError ? (
                <div className="form-section" style={{ textAlign: "center", padding: "50px 30px" }}>
                  <i className="fas fa-exclamation-triangle fa-2x" style={{ color: "var(--primary)", marginBottom: 12 }} />
                  <p style={{ color: "var(--gray)" }}>{campsError}</p>
                  <button type="button" onClick={() => fetchMyCamps(token)} className="btn">
                    Retry
                  </button>
                </div>
              ) : displayedCamps.length === 0 ? (
                <div className="form-section" style={{ textAlign: "center", padding: "60px 30px" }}>
                  <i className="fas fa-folder-open fa-3x" style={{ color: "var(--gray)", marginBottom: 16 }} />
                  <h3 style={{ justifyContent: "center", color: "var(--secondary)" }}>No Camps Found</h3>
                  <p style={{ color: "var(--gray)", maxWidth: 450, margin: "0 auto 20px" }}>
                    {statusFilter === "all"
                      ? "You haven't created any blood donation camps yet. Click 'Create New Camp' to begin."
                      : `No camps found with status '${statusFilter}'.`}
                  </p>
                  <button type="button" onClick={() => setShowCreateModal(true)} className="btn">
                    <i className="fas fa-plus" style={{ marginRight: 6 }} /> Create First Camp
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {displayedCamps.map((camp) => {
                    const remainingSlots = Math.max(0, camp.capacity - camp.registrationCount);
                    const isFull = camp.registrationCount >= camp.capacity;

                    const statusBadgeColors = {
                      draft: { bg: "#e2e3e5", color: "#383d41" },
                      published: { bg: "rgba(40, 167, 69, 0.15)", color: "#28a745" },
                      completed: { bg: "rgba(26, 54, 93, 0.12)", color: "var(--secondary)" },
                      cancelled: { bg: "rgba(220, 53, 69, 0.12)", color: "#dc3545" },
                    };

                    const badge = statusBadgeColors[camp.status] || { bg: "#e2e3e5", color: "#383d41" };

                    return (
                      <div
                        key={camp._id}
                        className="form-section"
                        style={{
                          margin: 0,
                          padding: "22px 26px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 18,
                        }}
                      >
                        <div style={{ flex: "1 1 320px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                padding: "3px 8px",
                                borderRadius: 4,
                                backgroundColor: badge.bg,
                                color: badge.color,
                              }}
                            >
                              {camp.status}
                            </span>
                            <span style={{ fontSize: 13, color: "var(--gray)" }}>
                              <i className="fas fa-location-dot" style={{ marginRight: 4, color: "var(--primary)" }} />
                              {camp.location.city}, {camp.location.state}
                            </span>
                          </div>

                          <h3 style={{ fontSize: "1.25rem", margin: "0 0 8px 0", color: "var(--secondary)" }}>
                            {camp.name}
                          </h3>

                          <div style={{ fontSize: 13, color: "var(--gray)", display: "flex", gap: 18, flexWrap: "wrap" }}>
                            <span>
                              <i className="fas fa-calendar" style={{ marginRight: 6, color: "var(--primary)" }} />
                              {formatDate(camp.startDate)}
                              {camp.startDate !== camp.endDate ? ` – ${formatDate(camp.endDate)}` : ""}
                            </span>
                            <span>
                              <i className="fas fa-clock" style={{ marginRight: 6, color: "var(--primary)" }} />
                              {camp.startTime} – {camp.endTime}
                            </span>
                          </div>
                        </div>

                        {/* Capacity Metrics */}
                        <div
                          style={{
                            padding: "10px 18px",
                            backgroundColor: "var(--background)",
                            borderRadius: 8,
                            textAlign: "center",
                            minWidth: 160,
                          }}
                        >
                          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--secondary)" }}>
                            {camp.registrationCount} / {camp.capacity}
                          </div>
                          <div style={{ fontSize: 12, color: isFull ? "#b00000" : "#28a745", fontWeight: 600 }}>
                            {isFull ? "Camp Full" : `${remainingSlots} slots remaining`}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <Link
                            to={`/organizer/camps/${camp._id}` as any}
                            className="btn btn-outline"
                            style={{ padding: "8px 16px", fontSize: 13 }}
                          >
                            <i className="fas fa-users" style={{ marginRight: 6 }} /> Donors & Manage
                          </Link>

                          {camp.status === "draft" && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(camp._id, "published")}
                              className="btn"
                              style={{
                                padding: "8px 16px",
                                fontSize: 13,
                                backgroundColor: "#28a745",
                              }}
                            >
                              <i className="fas fa-paper-plane" style={{ marginRight: 6 }} /> Publish
                            </button>
                          )}

                          {(camp.status === "draft" || camp.status === "published") && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to cancel '${camp.name}'?`)) {
                                  handleUpdateStatus(camp._id, "cancelled");
                                }
                              }}
                              className="btn btn-outline"
                              style={{
                                padding: "8px 14px",
                                fontSize: 13,
                                borderColor: "#dc3545",
                                color: "#dc3545",
                              }}
                            >
                              Cancel Camp
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* CREATE CAMP MODAL */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
            overflowY: "auto",
          }}
        >
          <div
            className="form-section"
            style={{
              maxWidth: 700,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              margin: "auto",
              padding: 30,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: "var(--secondary)" }}>
                <i className="fas fa-hospital-user" style={{ color: "var(--primary)" }} /> Create Blood Donation Camp
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--gray)" }}
              >
                <i className="fas fa-times" />
              </button>
            </div>

            <form onSubmit={handleCreateCamp}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="required-field">Camp Name</label>
                <input
                  type="text"
                  placeholder="e.g. Parul University Youth Blood Drive"
                  value={newCampName}
                  onChange={(e) => setNewCampName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Description (Optional)</label>
                <textarea
                  placeholder="Describe the drive, guidelines, and facilities available..."
                  value={newCampDescription}
                  onChange={(e) => setNewCampDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div className="form-group">
                  <label className="required-field">Address</label>
                  <input
                    type="text"
                    placeholder="e.g. Campus Auditorium, Sector 4"
                    value={newCampAddress}
                    onChange={(e) => setNewCampAddress(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="required-field">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Vadodara"
                    value={newCampCity}
                    onChange={(e) => setNewCampCity(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div className="form-group">
                  <label className="required-field">State</label>
                  <input
                    type="text"
                    placeholder="e.g. Gujarat"
                    value={newCampState}
                    onChange={(e) => setNewCampState(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="required-field">Pincode (6 digits)</label>
                  <input
                    type="text"
                    placeholder="e.g. 390019"
                    value={newCampPincode}
                    onChange={(e) => setNewCampPincode(e.target.value)}
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              <LocationPickerMap
                latitude={newCampLat ? parseFloat(newCampLat) : null}
                longitude={newCampLng ? parseFloat(newCampLng) : null}
                height={260}
                label="Pin Camp Venue on Map"
                helperText="Click on the venue location or click 'Use My Current Location' to place the camp pin."
                onChange={({ latitude: lat, longitude: lng, city: geoCity, state: geoState, pincode: geoPincode }) => {
                  setNewCampLat(String(lat));
                  setNewCampLng(String(lng));
                  if (geoCity && !newCampCity) setNewCampCity(geoCity);
                  if (geoState && !newCampState) setNewCampState(geoState);
                  if (geoPincode && !newCampPincode) setNewCampPincode(geoPincode);
                }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div className="form-group">
                  <label className="required-field">Start Date</label>
                  <input
                    type="date"
                    value={newCampStartDate}
                    onChange={(e) => setNewCampStartDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="required-field">End Date</label>
                  <input
                    type="date"
                    value={newCampEndDate}
                    onChange={(e) => setNewCampEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
                <div className="form-group">
                  <label className="required-field">Start Time</label>
                  <input
                    type="text"
                    placeholder="09:00"
                    value={newCampStartTime}
                    onChange={(e) => setNewCampStartTime(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="required-field">End Time</label>
                  <input
                    type="text"
                    placeholder="17:00"
                    value={newCampEndTime}
                    onChange={(e) => setNewCampEndTime(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="required-field">Donor Capacity</label>
                  <input
                    type="number"
                    min={1}
                    value={newCampCapacity}
                    onChange={(e) => setNewCampCapacity(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCamp}
                  className="btn"
                >
                  {creatingCamp ? (
                    <>
                      <i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} /> Creating Draft...
                    </>
                  ) : (
                    "Create Camp as Draft"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}

