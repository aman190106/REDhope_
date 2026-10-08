import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { toast } from "../../components/AppToaster";

export const Route = createFileRoute("/camps/$campId")({
  head: () => ({
    meta: [
      { title: "Camp Details & Registration — REDhope" },
      {
        name: "description",
        content: "View blood donation camp details, check your registration and eligibility status, and register to donate.",
      },
      { property: "og:title", content: "Camp Details & Registration — REDhope" },
      { property: "og:description", content: "Register for blood donation camp and save lives." },
    ],
  }),
  component: CampDetailsPage,
});

const API_BASE = "http://localhost:5000";

interface CampLocation {
  address: string;
  city: string;
  state: string;
  pincode: string;
  type?: string;
  coordinates?: [number, number];
}

interface CampDetail {
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
  organizer?: {
    _id: string;
    name: string;
  };
  createdAt?: string;
}

interface RegistrationInfo {
  _id: string;
  camp: string;
  status: "registered" | "cancelled";
  registeredAt: string;
  cancelledAt?: string | null;
}

interface EligibilityInfo {
  isMedicallyEligible: boolean;
  isDonorAvailable: boolean;
  nextEligibleDate: string | null;
  reasons: string[];
  checkedAt: string;
}

function CampDetailsPage() {
  const { campId } = Route.useParams();

  // Camp details state
  const [camp, setCamp] = useState<CampDetail | null>(null);
  const [loadingCamp, setLoadingCamp] = useState(true);
  const [campError, setCampError] = useState<string | null>(null);

  // Authentication state
  const [token, setToken] = useState<string | null>(null);

  // Registration state
  const [registration, setRegistration] = useState<RegistrationInfo | null>(null);
  const [loadingReg, setLoadingReg] = useState(false);

  // Eligibility advisory state
  const [eligibility, setEligibility] = useState<EligibilityInfo | null>(null);
  const [loadingElig, setLoadingElig] = useState(false);

  // Action states
  const [submittingRegister, setSubmittingRegister] = useState(false);
  const [submittingCancel, setSubmittingCancel] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Inline auth state for unauthenticated users wishing to register
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Read auth token from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem("token") || localStorage.getItem("redhope_token");
    setToken(savedToken);
  }, []);

  // Fetch camp details
  const fetchCampDetails = async () => {
    setLoadingCamp(true);
    setCampError(null);
    try {
      const res = await fetch(`${API_BASE}/camps/${campId}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        setCampError(json.message || "Failed to load camp details.");
        setCamp(null);
        return;
      }

      setCamp(json.camp);
    } catch (err) {
      console.error("Error fetching camp details:", err);
      setCampError("Unable to connect to the server. Please check your network connection.");
    } finally {
      setLoadingCamp(false);
    }
  };

  // Fetch current user registration status for this camp
  const fetchMyRegistration = async (authToken: string) => {
    setLoadingReg(true);
    try {
      const res = await fetch(`${API_BASE}/camps/${campId}/registrations/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (res.status === 404) {
        // Normal state: user is not registered for this camp
        setRegistration(null);
        return;
      }

      if (res.status === 401) {
        // Token expired/invalid
        localStorage.removeItem("token");
        localStorage.removeItem("redhope_token");
        setToken(null);
        setRegistration(null);
        return;
      }

      const json = await res.json();
      if (res.ok && json.success && json.data?.registration) {
        setRegistration(json.data.registration);
      } else {
        setRegistration(null);
      }
    } catch (err) {
      console.error("Error checking registration status:", err);
      // Fail silently for status check
      setRegistration(null);
    } finally {
      setLoadingReg(false);
    }
  };

  // Fetch user eligibility advisory
  const fetchEligibilityAdvisory = async (authToken: string) => {
    setLoadingElig(true);
    try {
      const res = await fetch(`${API_BASE}/eligibility/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (res.status === 401) {
        setEligibility(null);
        return;
      }

      const json = await res.json();
      if (res.ok && json.success && json.data) {
        setEligibility(json.data);
      }
    } catch (err) {
      console.error("Error fetching eligibility advisory:", err);
    } finally {
      setLoadingElig(false);
    }
  };

  useEffect(() => {
    fetchCampDetails();
  }, [campId]);

  useEffect(() => {
    if (token) {
      fetchMyRegistration(token);
      fetchEligibilityAdvisory(token);
    } else {
      setRegistration(null);
      setEligibility(null);
    }
  }, [campId, token]);

  // Handle inline login
  const handleInlineLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      toast.error("Please enter email and password.");
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || "Invalid credentials.");
        return;
      }

      toast.success("Signed in successfully!");
      localStorage.setItem("token", json.token);
      setToken(json.token);
      setShowAuthForm(false);
      setAuthPassword("");

      // Refresh registration and eligibility for this user
      await fetchMyRegistration(json.token);
      await fetchEligibilityAdvisory(json.token);
    } catch (err) {
      console.error(err);
      toast.error("Could not reach the server.");
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle register request
  const handleRegister = async () => {
    if (!token) {
      setShowAuthForm(true);
      toast.error("Please sign in with your donor account to register.");
      return;
    }

    setSubmittingRegister(true);
    try {
      const res = await fetch(`${API_BASE}/camps/${campId}/register`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const json = await res.json();

      if (res.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("redhope_token");
        setToken(null);
        setShowAuthForm(true);
        toast.error("Please log in to register.");
        return;
      }

      if (res.status === 403) {
        toast.error(json.message || "You are not allowed to register for this camp.");
        return;
      }

      if (res.status === 409) {
        toast.error("You're already registered for this camp.");
        await fetchMyRegistration(token);
        return;
      }

      if (!res.ok || !json.success) {
        // Detailed error messages from backend
        if (json.reasons && Array.isArray(json.reasons) && json.reasons.length > 0) {
          toast.error(`${json.message || "Registration failed"}: ${json.reasons.join(", ")}`);
        } else if (json.message === "camp is at full capacity") {
          toast.error("Sorry, this camp is currently full.");
        } else if (json.message?.includes("already started")) {
          toast.error("Registration for this camp has closed.");
        } else {
          toast.error(json.message || "Failed to register for camp.");
        }
        return;
      }

      // Success
      toast.success(json.message || "Registered for camp successfully!");

      // Update state from returned data or refetch
      if (json.data?.registration) {
        setRegistration(json.data.registration);
      } else {
        await fetchMyRegistration(token);
      }

      if (json.data?.camp) {
        setCamp((prev) =>
          prev
            ? {
                ...prev,
                registrationCount: json.data.camp.registrationCount,
                capacity: json.data.camp.capacity,
              }
            : null
        );
      } else {
        await fetchCampDetails();
      }
    } catch (err) {
      console.error("Register error:", err);
      toast.error("Could not connect to the server. Please try again.");
    } finally {
      setSubmittingRegister(false);
    }
  };

  // Handle cancel registration request
  const handleCancelRegistration = async () => {
    if (!token) return;

    setSubmittingCancel(true);
    try {
      const res = await fetch(`${API_BASE}/camps/${campId}/register`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (res.status === 401) {
        toast.error("Session expired. Please sign in again.");
        setToken(null);
        return;
      }

      if (!res.ok || !json.success) {
        toast.error(json.message || "Could not cancel registration.");
        return;
      }

      toast.success(json.message || "Registration cancelled successfully.");
      setShowCancelModal(false);

      // Refresh registration status and camp counts
      await fetchMyRegistration(token);
      await fetchCampDetails();
    } catch (err) {
      console.error("Cancel registration error:", err);
      toast.error("Could not reach the server to cancel registration.");
    } finally {
      setSubmittingCancel(false);
    }
  };

  // Helper date/time formatters
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const isCampStarted = (startDateStr: string, startTimeStr: string) => {
    try {
      const start = new Date(startDateStr);
      if (startTimeStr && startTimeStr.includes(":")) {
        const [h, m] = startTimeStr.split(":").map(Number);
        start.setHours(h, m, 0, 0);
      }
      return new Date() >= start;
    } catch {
      return false;
    }
  };

  return (
    <>
      <Navbar solid />

      <section className="hero hero-compact" style={{ minHeight: "30vh" }}>
        <div className="hero-inner">
          <Link
            to="/camps"
            style={{
              color: "rgba(255, 255, 255, 0.8)",
              fontSize: 14,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 10,
            }}
          >
            <i className="fas fa-arrow-left" /> Back to Camps Directory
          </Link>
          <h1 style={{ fontSize: "2.4rem" }}>{camp ? camp.name : "Camp Details"}</h1>
          <p>{camp ? `${camp.location.city}, ${camp.location.state}` : "Blood Donation Drive"}</p>
        </div>
      </section>

      <section className="features" style={{ backgroundColor: "var(--background)", minHeight: "65vh", paddingTop: 40, paddingBottom: 70 }}>
        <div className="container">
          {loadingCamp ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <i className="fas fa-spinner fa-spin fa-3x" style={{ color: "var(--primary)" }} />
              <p style={{ marginTop: 16, color: "var(--gray)", fontSize: 16 }}>
                Loading camp details...
              </p>
            </div>
          ) : campError || !camp ? (
            <div
              className="form-section"
              style={{
                textAlign: "center",
                padding: "60px 30px",
                maxWidth: 600,
                margin: "0 auto",
              }}
            >
              <i className="fas fa-circle-exclamation fa-3x" style={{ color: "var(--primary)", marginBottom: 16 }} />
              <h3 style={{ justifyContent: "center", color: "var(--primary)" }}>Camp Not Available</h3>
              <p style={{ color: "var(--gray)", marginBottom: 24 }}>
                {campError || "This blood donation camp could not be found or is not currently open to the public."}
              </p>
              <Link to="/camps" className="btn">
                <i className="fas fa-arrow-left" style={{ marginRight: 8 }} /> Browse Other Camps
              </Link>
            </div>
          ) : (
            (() => {
              const remainingSlots = Math.max(0, camp.capacity - camp.registrationCount);
              const isFull = camp.registrationCount >= camp.capacity;
              const hasStarted = isCampStarted(camp.startDate, camp.startTime);
              const isRegistered = registration?.status === "registered";
              const isCancelled = registration?.status === "cancelled";
              const notPublished = camp.status !== "published";

              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 30, alignItems: "start" }}>
                  {/* Left Column: Camp Info */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    {/* Basic Info Card */}
                    <div className="form-section" style={{ margin: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            padding: "4px 10px",
                            borderRadius: 4,
                            backgroundColor:
                              hasStarted || notPublished
                                ? "#6c757d"
                                : isFull
                                ? "#ffc107"
                                : "rgba(40, 167, 69, 0.15)",
                            color:
                              hasStarted || notPublished
                                ? "#fff"
                                : isFull
                                ? "#856404"
                                : "#28a745",
                          }}
                        >
                          {notPublished
                            ? camp.status
                            : hasStarted
                            ? "Camp Started / Closed"
                            : isFull
                            ? "Camp Full"
                            : "Open for Registration"}
                        </span>

                        <span style={{ fontSize: 13, color: "var(--gray)" }}>
                          <i className="fas fa-certificate" style={{ marginRight: 6, color: "var(--secondary)" }} />
                          Verified Camp
                        </span>
                      </div>

                      <h2 style={{ fontSize: "1.75rem", color: "var(--secondary)", marginBottom: 14 }}>
                        {camp.name}
                      </h2>

                      {camp.description && (
                        <p style={{ color: "var(--gray)", fontSize: 15, lineHeight: 1.6, marginBottom: 20 }}>
                          {camp.description}
                        </p>
                      )}

                      {/* Organizer Safe Badge */}
                      {camp.organizer && (
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 14px",
                            backgroundColor: "var(--background)",
                            borderRadius: 20,
                            fontSize: 13,
                            color: "var(--secondary)",
                            fontWeight: 600,
                            marginBottom: 20,
                          }}
                        >
                          <i className="fas fa-user-shield" style={{ color: "var(--primary)" }} />
                          Organized by: {camp.organizer.name}
                        </div>
                      )}

                      {/* Details list */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 14,
                          paddingTop: 16,
                          borderTop: "1px solid var(--light-gray)",
                          fontSize: 14,
                        }}
                      >
                        <div>
                          <i className="fas fa-calendar-day" style={{ width: 22, color: "var(--primary)" }} />
                          <strong style={{ color: "var(--secondary)" }}>Date: </strong>
                          <span>
                            {formatDate(camp.startDate)}
                            {camp.startDate !== camp.endDate ? ` to ${formatDate(camp.endDate)}` : ""}
                          </span>
                        </div>

                        <div>
                          <i className="fas fa-clock" style={{ width: 22, color: "var(--primary)" }} />
                          <strong style={{ color: "var(--secondary)" }}>Time: </strong>
                          <span>
                            {camp.startTime} – {camp.endTime}
                          </span>
                        </div>

                        <div>
                          <i className="fas fa-location-dot" style={{ width: 22, color: "var(--primary)" }} />
                          <strong style={{ color: "var(--secondary)" }}>Address: </strong>
                          <span>{camp.location.address}</span>
                        </div>

                        <div>
                          <i className="fas fa-city" style={{ width: 22, color: "var(--primary)" }} />
                          <strong style={{ color: "var(--secondary)" }}>City & State: </strong>
                          <span>
                            {camp.location.city}, {camp.location.state} — {camp.location.pincode}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Capacity Info Card */}
                    <div className="form-section" style={{ margin: 0 }}>
                      <h3 style={{ fontSize: "1.2rem", marginBottom: 14 }}>
                        <i className="fas fa-chart-pie" style={{ color: "var(--primary)" }} /> Donor Capacity & Slots
                      </h3>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 16,
                          textAlign: "center",
                          marginBottom: 16,
                        }}
                      >
                        <div
                          style={{
                            padding: 16,
                            backgroundColor: "var(--background)",
                            borderRadius: 8,
                            border: "1px solid var(--light-gray)",
                          }}
                        >
                          <div style={{ fontSize: 24, fontWeight: 800, color: "var(--secondary)" }}>
                            {camp.registrationCount} / {camp.capacity}
                          </div>
                          <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 4 }}>
                            Donors Registered
                          </div>
                        </div>

                        <div
                          style={{
                            padding: 16,
                            backgroundColor: isFull ? "#fff3cd" : "rgba(40, 167, 69, 0.08)",
                            borderRadius: 8,
                            border: `1px solid ${isFull ? "#ffeeba" : "rgba(40, 167, 69, 0.2)"}`,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 24,
                              fontWeight: 800,
                              color: isFull ? "#856404" : "#28a745",
                            }}
                          >
                            {isFull ? "0" : remainingSlots}
                          </div>
                          <div style={{ fontSize: 13, color: isFull ? "#856404" : "var(--gray)", marginTop: 4 }}>
                            Slots Remaining
                          </div>
                        </div>
                      </div>

                      {/* Capacity progress bar */}
                      <div
                        style={{
                          width: "100%",
                          height: 8,
                          backgroundColor: "var(--light-gray)",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(100, Math.round((camp.registrationCount / camp.capacity) * 100))}%`,
                            backgroundColor: isFull ? "#dc3545" : "var(--primary)",
                            transition: "width 0.3s ease",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Registration Card */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    <div className="form-section" style={{ margin: 0, border: "2px solid rgba(26, 54, 93, 0.1)" }}>
                      <h3 style={{ fontSize: "1.3rem", marginBottom: 16 }}>
                        <i className="fas fa-hand-holding-heart" style={{ color: "var(--primary)" }} /> Camp Registration
                      </h3>

                      {/* Authenticated user registration status */}
                      {loadingReg ? (
                        <div style={{ textAlign: "center", padding: "30px 0" }}>
                          <i className="fas fa-spinner fa-spin fa-2x" style={{ color: "var(--primary)" }} />
                          <p style={{ marginTop: 10, color: "var(--gray)", fontSize: 14 }}>
                            Checking your registration status...
                          </p>
                        </div>
                      ) : !token ? (
                        /* Unauthenticated prompt */
                        <div>
                          <div
                            style={{
                              padding: 16,
                              backgroundColor: "rgba(227, 6, 19, 0.05)",
                              borderRadius: 8,
                              border: "1px solid rgba(227, 6, 19, 0.15)",
                              marginBottom: 20,
                            }}
                          >
                            <p style={{ margin: 0, fontSize: 14, color: "var(--secondary)" }}>
                              <i className="fas fa-lock" style={{ marginRight: 8, color: "var(--primary)" }} />
                              <strong>Authentication Required:</strong> Please log in to view your eligibility and reserve your donation slot.
                            </p>
                          </div>

                          {!showAuthForm ? (
                            <button
                              type="button"
                              onClick={() => setShowAuthForm(true)}
                              className="btn"
                              style={{ width: "100%", padding: "12px 20px" }}
                            >
                              Sign In to Register
                            </button>
                          ) : (
                            <form onSubmit={handleInlineLogin} style={{ marginTop: 10 }}>
                              <div className="form-group" style={{ marginBottom: 14 }}>
                                <label className="required-field">Email</label>
                                <input
                                  type="email"
                                  placeholder="john@example.com"
                                  value={authEmail}
                                  onChange={(e) => setAuthEmail(e.target.value)}
                                  required
                                />
                              </div>

                              <div className="form-group" style={{ marginBottom: 18 }}>
                                <label className="required-field">Password</label>
                                <input
                                  type="password"
                                  placeholder="Enter your password"
                                  value={authPassword}
                                  onChange={(e) => setAuthPassword(e.target.value)}
                                  required
                                />
                              </div>

                              <button
                                type="submit"
                                disabled={authLoading}
                                className="btn"
                                style={{ width: "100%", padding: "12px 20px" }}
                              >
                                {authLoading ? (
                                  <>
                                    <i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} /> Signing in...
                                  </>
                                ) : (
                                  "Sign In & Continue"
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => setShowAuthForm(false)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "var(--gray)",
                                  fontSize: 13,
                                  width: "100%",
                                  marginTop: 10,
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                }}
                              >
                                Cancel
                              </button>
                            </form>
                          )}
                        </div>
                      ) : isRegistered ? (
                        /* Current User is Registered */
                        <div>
                          <div
                            style={{
                              padding: "18px 20px",
                              backgroundColor: "rgba(40, 167, 69, 0.08)",
                              borderRadius: 8,
                              border: "1px solid rgba(40, 167, 69, 0.3)",
                              marginBottom: 20,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                              <i className="fas fa-check-circle fa-lg" style={{ color: "#28a745" }} />
                              <strong style={{ fontSize: 16, color: "#28a745" }}>
                                You are Registered for this Camp!
                              </strong>
                            </div>
                            <p style={{ margin: 0, fontSize: 13, color: "var(--gray)" }}>
                              Slot confirmed on {formatDate(registration.registeredAt)}. Please arrive at the venue during operating hours with a valid photo ID.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setShowCancelModal(true)}
                            className="btn btn-outline"
                            style={{
                              width: "100%",
                              borderColor: "#dc3545",
                              color: "#dc3545",
                              padding: "12px 20px",
                            }}
                          >
                            <i className="fas fa-times-circle" style={{ marginRight: 8 }} /> Cancel Registration
                          </button>
                        </div>
                      ) : (
                        /* User is NOT currently registered (or was previously cancelled) */
                        <div>
                          {isCancelled && (
                            <div
                              style={{
                                padding: 12,
                                backgroundColor: "rgba(108, 117, 125, 0.08)",
                                borderRadius: 6,
                                border: "1px solid var(--light-gray)",
                                fontSize: 13,
                                color: "var(--gray)",
                                marginBottom: 16,
                              }}
                            >
                              <i className="fas fa-info-circle" style={{ marginRight: 6 }} />
                              You previously cancelled your registration for this camp. You can reactivate it below if slots are open.
                            </div>
                          )}

                          {/* Advisory Eligibility Banner (Optional advisory info) */}
                          {eligibility && !eligibility.isMedicallyEligible && (
                            <div
                              style={{
                                padding: 14,
                                backgroundColor: "#fff3cd",
                                border: "1px solid #ffeeba",
                                borderRadius: 6,
                                marginBottom: 18,
                                fontSize: 13,
                                color: "#856404",
                              }}
                            >
                              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                                <i className="fas fa-triangle-exclamation" style={{ marginRight: 6 }} />
                                Eligibility Notice:
                              </div>
                              <ul style={{ paddingLeft: 18, margin: 0 }}>
                                {eligibility.reasons.map((r, i) => (
                                  <li key={i}>{r}</li>
                                ))}
                              </ul>
                              {eligibility.nextEligibleDate && (
                                <div style={{ marginTop: 6, fontSize: 12 }}>
                                  Next eligible date: {formatDate(eligibility.nextEligibleDate)}
                                </div>
                              )}
                            </div>
                          )}

                          {eligibility && !eligibility.isDonorAvailable && (
                            <div
                              style={{
                                padding: 14,
                                backgroundColor: "#fff3cd",
                                border: "1px solid #ffeeba",
                                borderRadius: 6,
                                marginBottom: 18,
                                fontSize: 13,
                                color: "#856404",
                              }}
                            >
                              <i className="fas fa-user-clock" style={{ marginRight: 6 }} />
                              Your donor status is marked as <strong>Unavailable</strong> in your profile. Update your profile before registering.
                            </div>
                          )}

                          {/* Register Button */}
                          {hasStarted ? (
                            <button
                              type="button"
                              disabled
                              className="btn"
                              style={{
                                width: "100%",
                                backgroundColor: "var(--gray)",
                                cursor: "not-allowed",
                                opacity: 0.7,
                              }}
                            >
                              Registration Closed (Camp Started)
                            </button>
                          ) : notPublished ? (
                            <button
                              type="button"
                              disabled
                              className="btn"
                              style={{
                                width: "100%",
                                backgroundColor: "var(--gray)",
                                cursor: "not-allowed",
                                opacity: 0.7,
                              }}
                            >
                              Camp Not Open
                            </button>
                          ) : isFull ? (
                            <button
                              type="button"
                              disabled
                              className="btn"
                              style={{
                                width: "100%",
                                backgroundColor: "#ffc107",
                                color: "#856404",
                                cursor: "not-allowed",
                              }}
                            >
                              Camp Full
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleRegister}
                              disabled={submittingRegister}
                              className="btn"
                              style={{ width: "100%", padding: "12px 20px" }}
                            >
                              {submittingRegister ? (
                                <>
                                  <i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} /> Reserving Slot...
                                </>
                              ) : isCancelled ? (
                                "Re-register for Camp"
                              ) : (
                                "Register for Camp"
                              )}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Guidelines snippet */}
                      <div
                        style={{
                          marginTop: 24,
                          paddingTop: 18,
                          borderTop: "1px solid var(--light-gray)",
                          fontSize: 12,
                          color: "var(--gray)",
                        }}
                      >
                        <div style={{ fontWeight: 600, color: "var(--secondary)", marginBottom: 6 }}>
                          Important Guidelines:
                        </div>
                        <ul style={{ paddingLeft: 16, margin: 0, lineHeight: 1.5 }}>
                          <li>Age must be 18+ with minimum weight 45–50 kg.</li>
                          <li>Have a light meal and drink plenty of water prior to donation.</li>
                          <li>Government photo ID is required for verification.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </section>

      {/* Cancellation Confirmation Modal */}
      {showCancelModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            className="form-section"
            style={{
              maxWidth: 450,
              width: "100%",
              margin: 0,
              padding: 28,
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
            }}
          >
            <h3 style={{ color: "#dc3545", marginBottom: 14 }}>
              <i className="fas fa-triangle-exclamation" /> Cancel Camp Registration?
            </h3>
            <p style={{ color: "var(--gray)", fontSize: 14, marginBottom: 22, lineHeight: 1.5 }}>
              Are you sure you want to cancel your donation registration for <strong>{camp.name}</strong>? Your reserved slot will be released for other willing donors.
            </p>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={submittingCancel}
                className="btn btn-outline"
                style={{ padding: "10px 18px", fontSize: 13 }}
              >
                Keep Registration
              </button>
              <button
                type="button"
                onClick={handleCancelRegistration}
                disabled={submittingCancel}
                className="btn"
                style={{
                  backgroundColor: "#dc3545",
                  padding: "10px 20px",
                  fontSize: 13,
                }}
              >
                {submittingCancel ? (
                  <>
                    <i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} /> Cancelling...
                  </>
                ) : (
                  "Yes, Cancel"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}

