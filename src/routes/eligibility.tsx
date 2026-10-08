import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { toast } from "../components/AppToaster";

export const Route = createFileRoute("/eligibility")({
  head: () => ({
    meta: [
      { title: "Check Blood Donation Eligibility — REDhope" },
      {
        name: "description",
        content: "Check your current medical eligibility and donor availability for blood donation.",
      },
      { property: "og:title", content: "Check Blood Donation Eligibility — REDhope" },
      { property: "og:description", content: "Check your blood donation eligibility status." },
    ],
  }),
  component: EligibilityPage,
});

import { API_BASE_URL } from "../lib/api";
const API_BASE = API_BASE_URL;

interface EligibilityData {
  isMedicallyEligible: boolean;
  isDonorAvailable: boolean;
  nextEligibleDate: string | null;
  reasons: string[];
  checkedAt: string;
}

function EligibilityPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null);

  // Authentication form state for unauthenticated users
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem("token") || localStorage.getItem("redhope_token");
    if (savedToken) {
      setToken(savedToken);
      fetchEligibility(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchEligibility = async (authToken: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE}/eligibility/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const json = await res.json();

      if (res.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("redhope_token");
        setToken(null);
        setEligibility(null);
        toast.error("Session expired or unauthorized. Please sign in to check eligibility.");
        return;
      }

      if (!res.ok || !json.success) {
        setErrorMsg(json.message || "Failed to load eligibility data.");
        return;
      }

      setEligibility(json.data);
    } catch (err) {
      console.error(err);
      setErrorMsg("Unable to connect to the server. Please verify your network or backend server.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      toast.error("Email and password are required.");
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || "Invalid credentials.");
        return;
      }

      toast.success("Signed in successfully!");
      localStorage.setItem("token", data.token);
      setToken(data.token);
      setAuthPassword("");
      await fetchEligibility(data.token);
    } catch (err) {
      console.error(err);
      toast.error("Could not reach the server.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRefresh = () => {
    if (token) {
      fetchEligibility(token);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <Navbar solid />

      <section className="hero hero-compact" style={{ minHeight: "35vh" }}>
        <div className="hero-inner">
          <h1>Donor Eligibility</h1>
          <p>Instant verification of your health and interval criteria for blood donation.</p>
        </div>
      </section>

      <section className="features" style={{ backgroundColor: "var(--background)", minHeight: "60vh" }}>
        <div className="container">
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <i className="fas fa-spinner fa-spin fa-3x" style={{ color: "var(--primary)" }} />
              <p style={{ marginTop: 16, color: "var(--gray)", fontSize: 16 }}>
                Evaluating eligibility criteria...
              </p>
            </div>
          ) : !token ? (
            /* Unauthenticated Login Card */
            <div className="form-section" style={{ maxWidth: 460, margin: "0 auto" }}>
              <h3>
                <i className="fas fa-lock" /> Sign In to Check Eligibility
              </h3>
              <p style={{ color: "var(--gray)", marginBottom: 20, fontSize: 14 }}>
                Please sign in with your donor account to view your live donation eligibility.
              </p>
              <form onSubmit={handleLogin}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="required-field">
                    <i className="fas fa-envelope" /> Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. john@example.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="required-field">
                    <i className="fas fa-key" /> Password
                  </label>
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
                  className="btn"
                  style={{ width: "100%" }}
                  disabled={authLoading}
                >
                  {authLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin" /> Signing In...
                    </>
                  ) : (
                    "Sign In to View Eligibility"
                  )}
                </button>
              </form>
            </div>
          ) : errorMsg ? (
            /* Error Card */
            <div className="form-section" style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
              <i
                className="fas fa-exclamation-triangle fa-3x"
                style={{ color: "var(--primary)", marginBottom: 16 }}
              />
              <h3 style={{ justifyContent: "center", color: "var(--secondary)" }}>
                Unable to Retrieve Eligibility
              </h3>
              <p style={{ color: "var(--gray)", marginBottom: 24 }}>{errorMsg}</p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button type="button" onClick={handleRefresh} className="btn">
                  <i className="fas fa-redo" /> Try Again
                </button>
                <Link to="/profile" className="btn btn-outline">
                  Go to Profile
                </Link>
              </div>
            </div>
          ) : eligibility ? (
            /* Eligibility Status Display */
            <div style={{ maxWidth: 860, margin: "0 auto" }}>
              {/* Main Banner Based on State */}
              {eligibility.isMedicallyEligible && eligibility.isDonorAvailable ? (
                /* State B: Fully Eligible & Available */
                <div
                  className="form-section"
                  style={{
                    borderLeft: "6px solid var(--success)",
                    padding: 30,
                    marginBottom: 24,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
                    <div
                      style={{
                        backgroundColor: "rgba(40, 167, 69, 0.12)",
                        color: "var(--success)",
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 26,
                        flexShrink: 0,
                      }}
                    >
                      <i className="fas fa-check-circle" />
                    </div>
                    <div>
                      <h2 style={{ color: "var(--secondary)", fontSize: "1.8rem", marginBottom: 6 }}>
                        Eligible to Donate
                      </h2>
                      <p style={{ color: "var(--dark)", fontSize: 15, marginBottom: 12 }}>
                        You meet all standard medical criteria and your minimum donation interval has passed. You are also marked as available for emergency requests.
                      </p>
                      <span
                        style={{
                          backgroundColor: "var(--success)",
                          color: "white",
                          padding: "6px 14px",
                          borderRadius: 20,
                          fontWeight: 700,
                          fontSize: 13,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <i className="fas fa-heart" /> Ready to Save Lives
                      </span>
                    </div>
                  </div>
                </div>
              ) : eligibility.isMedicallyEligible && !eligibility.isDonorAvailable ? (
                /* State C: Medically Eligible but Unavailable */
                <div
                  className="form-section"
                  style={{
                    borderLeft: "6px solid #e09b11",
                    padding: 30,
                    marginBottom: 24,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
                    <div
                      style={{
                        backgroundColor: "rgba(224, 155, 17, 0.12)",
                        color: "#e09b11",
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 26,
                        flexShrink: 0,
                      }}
                    >
                      <i className="fas fa-user-clock" />
                    </div>
                    <div>
                      <h2 style={{ color: "var(--secondary)", fontSize: "1.8rem", marginBottom: 6 }}>
                        Medically Eligible &bull; Currently Unavailable
                      </h2>
                      <p style={{ color: "var(--dark)", fontSize: 15, marginBottom: 12 }}>
                        You satisfy all medical eligibility criteria. However, you have currently marked yourself as <strong>unavailable</strong> for donation requests in your profile.
                      </p>
                      <p style={{ color: "var(--gray)", fontSize: 14 }}>
                        To participate in upcoming blood matching drives, you can toggle your availability on at any time from your{" "}
                        <Link to="/profile" style={{ color: "var(--primary)", fontWeight: 600 }}>
                          profile settings
                        </Link>.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* State D: Not Medically Eligible */
                <div
                  className="form-section"
                  style={{
                    borderLeft: "6px solid var(--primary)",
                    padding: 30,
                    marginBottom: 24,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
                    <div
                      style={{
                        backgroundColor: "rgba(227, 6, 19, 0.12)",
                        color: "var(--primary)",
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 26,
                        flexShrink: 0,
                      }}
                    >
                      <i className="fas fa-times-circle" />
                    </div>
                    <div>
                      <h2 style={{ color: "var(--secondary)", fontSize: "1.8rem", marginBottom: 6 }}>
                        Not Currently Eligible
                      </h2>
                      <p style={{ color: "var(--dark)", fontSize: 15, marginBottom: 12 }}>
                        Based on the current evaluation, you are not eligible to donate blood at this time. Please review the details below.
                      </p>
                      <span
                        style={{
                          backgroundColor: "var(--primary)",
                          color: "white",
                          padding: "6px 14px",
                          borderRadius: 20,
                          fontWeight: 700,
                          fontSize: 13,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <i className="fas fa-calendar-times" /> Waiting Period or Restriction
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Health Screening & Clinical Review Status Card */}
              <div
                className="form-section"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 16,
                  marginBottom: 24,
                  borderLeft: "5px solid #3b82f6",
                }}
              >
                <div>
                  <h3 style={{ margin: "0 0 6px", color: "var(--secondary)" }}>
                    <i className="fas fa-notes-medical" style={{ marginRight: 8, color: "#3b82f6" }} />
                    Donor Health Screening & Medical Review
                  </h3>
                  <p style={{ margin: 0, color: "var(--gray)", fontSize: 14 }}>
                    Submit health questionnaires and verified lab reports (PDF/JPG/PNG) for medical reviewer clearance.
                  </p>
                </div>
                <div>
                  <Link to="/health-screening" className="btn" style={{ padding: "8px 18px", fontSize: 14 }}>
                    Open Health Screening &rarr;
                  </Link>
                </div>
              </div>

              {/* Status Breakdown Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                <div style={{ background: "white", padding: 20, borderRadius: 10, boxShadow: "var(--shadow)" }}>
                  <div style={{ fontSize: 12, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                    Medical Eligibility
                  </div>
                  <div
                    style={{
                      color: eligibility.isMedicallyEligible ? "var(--success)" : "var(--primary)",
                      fontWeight: 700,
                      fontSize: 18,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <i className={eligibility.isMedicallyEligible ? "fas fa-check" : "fas fa-times"} />
                    {eligibility.isMedicallyEligible ? "Passed All Rules" : "Ineligible"}
                  </div>
                </div>

                <div style={{ background: "white", padding: 20, borderRadius: 10, boxShadow: "var(--shadow)" }}>
                  <div style={{ fontSize: 12, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                    Donor Availability
                  </div>
                  <div
                    style={{
                      color: eligibility.isDonorAvailable ? "var(--secondary)" : "var(--gray)",
                      fontWeight: 700,
                      fontSize: 18,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <i className={eligibility.isDonorAvailable ? "fas fa-bell" : "fas fa-bell-slash"} />
                    {eligibility.isDonorAvailable ? "Available to Donate" : "Marked Unavailable"}
                  </div>
                </div>

                {eligibility.nextEligibleDate && (
                  <div style={{ background: "white", padding: 20, borderRadius: 10, boxShadow: "var(--shadow)" }}>
                    <div style={{ fontSize: 12, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                      Next Eligible Date
                    </div>
                    <div
                      style={{
                        color: "var(--primary)",
                        fontWeight: 700,
                        fontSize: 18,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <i className="fas fa-calendar-alt" />
                      {formatDate(eligibility.nextEligibleDate)}
                    </div>
                  </div>
                )}
              </div>

              {/* Ineligibility Reasons (Authoritative from Backend) */}
              {!eligibility.isMedicallyEligible && eligibility.reasons.length > 0 && (
                <div className="form-section">
                  <h3 style={{ color: "var(--secondary)", marginBottom: 14 }}>
                    <i className="fas fa-info-circle" style={{ color: "var(--primary)" }} /> Ineligibility Reasons
                  </h3>
                  <p style={{ color: "var(--gray)", fontSize: 14, marginBottom: 16 }}>
                    The following conditions currently restrict your blood donation eligibility:
                  </p>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
                    {eligibility.reasons.map((reason, idx) => (
                      <li
                        key={idx}
                        style={{
                          backgroundColor: "var(--light)",
                          borderLeft: "4px solid var(--primary)",
                          padding: "12px 16px",
                          borderRadius: 6,
                          color: "var(--dark)",
                          fontWeight: 600,
                          fontSize: 14,
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <i className="fas fa-exclamation-circle" style={{ color: "var(--primary)" }} />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Footer Audit & Action Buttons */}
              <div
                className="form-section"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 16,
                  padding: "18px 24px",
                }}
              >
                <div style={{ color: "var(--gray)", fontSize: 13 }}>
                  <i className="fas fa-clock" /> Last evaluated:{" "}
                  <strong>{formatDateTime(eligibility.checkedAt)}</strong>
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="btn btn-outline"
                    style={{ padding: "8px 18px", fontSize: 13 }}
                  >
                    <i className="fas fa-sync-alt" /> Recheck
                  </button>
                  <Link
                    to="/profile"
                    className="btn"
                    style={{ padding: "8px 18px", fontSize: 13 }}
                  >
                    Manage Profile
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <Footer />
    </>
  );
}

