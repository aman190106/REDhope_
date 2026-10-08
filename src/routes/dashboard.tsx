import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { toast } from "../components/AppToaster";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Donor Dashboard — REDhope" },
      {
        name: "description",
        content: "REDhope donor dashboard: view your donation history, eligibility status, upcoming camps, and availability.",
      },
      { property: "og:title", content: "Donor Dashboard — REDhope" },
      { property: "og:description", content: "Track your blood donations and eligibility." },
    ],
  }),
  component: DashboardPage,
});

interface EligibilitySummary {
  isMedicallyEligible: boolean;
  isDonorAvailable: boolean;
  nextEligibleDate: string | null;
  reasons: string[];
}

interface RecentDonation {
  _id: string;
  camp?: {
    name: string;
    location?: { city?: string; address?: string };
  };
  donationDate: string;
  units: number;
  bloodGroup: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
}

interface CampRegistrationItem {
  _id: string;
  camp: {
    _id: string;
    name: string;
    startDate?: string;
    endDate?: string;
    location?: { city?: string; address?: string };
    status?: string;
  };
  registrationDate: string;
  status: string;
}

function DashboardPage() {
  const { user, token, isAuthenticated, isLoading: authLoading, updateUserInMemory } = useAuth();
  const navigate = useNavigate();

  const [eligibility, setEligibility] = useState<EligibilitySummary | null>(null);
  const [donations, setDonations] = useState<RecentDonation[]>([]);
  const [campsRegistered, setCampsRegistered] = useState<CampRegistrationItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [togglingStatus, setTogglingStatus] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLoadingData(false);
      return;
    }

    if (token) {
      loadDashboardData();
    }
  }, [authLoading, isAuthenticated, token]);

  const loadDashboardData = async () => {
    setLoadingData(true);
    try {
      // 1. Fetch Eligibility
      try {
        const elRes = await api.get<{ success: boolean; data: EligibilitySummary }>("/eligibility/me");
        if (elRes?.success && elRes.data) {
          setEligibility(elRes.data);
        }
      } catch (e) {
        console.warn("Failed to fetch eligibility", e);
      }

      // 2. Fetch Recent Donations (limit 5)
      try {
        const donRes = await api.get<{
          success: boolean;
          data: { donations: RecentDonation[] };
        }>("/donations/me?limit=5");
        if (donRes?.success && donRes.data?.donations) {
          setDonations(donRes.data.donations);
        }
      } catch (e) {
        console.warn("Failed to fetch donations", e);
      }

      // 3. Fetch User Registered Camps
      try {
        const campsRes = await api.get<{
          success: boolean;
          data: CampRegistrationItem[];
        }>("/camps/registrations/me");
        if (campsRes?.success && Array.isArray(campsRes.data)) {
          setCampsRegistered(campsRes.data);
        }
      } catch (e) {
        // Not critical if camps registrations endpoint isn't present
      }
    } finally {
      setLoadingData(false);
    }
  };

  const handleToggleAvailability = async () => {
    if (!user) return;
    const newStatus = !user.isDonorAvailable;
    setTogglingStatus(true);
    try {
      const res = await api.put<{ success: boolean; user: any }>("/auth/me", {
        isDonorAvailable: newStatus,
      });
      if (res?.success) {
        updateUserInMemory({ isDonorAvailable: newStatus });
        toast.success(newStatus ? "You are now marked as available for donations!" : "Donor availability turned off.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update availability status.");
    } finally {
      setTogglingStatus(false);
    }
  };

  if (authLoading) {
    return (
      <>
        <Navbar solid />
        <div style={{ minHeight: "60vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ textAlign: "center", color: "var(--primary)" }}>
            <i className="fas fa-circle-notch fa-spin" style={{ fontSize: "2.5rem" }} />
            <p style={{ marginTop: 12, color: "var(--gray)" }}>Loading dashboard...</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <>
        <Navbar solid />
        <section className="features" style={{ minHeight: "70vh", display: "flex", alignItems: "center" }}>
          <div className="container" style={{ maxWidth: 500, margin: "40px auto", textAlign: "center" }}>
            <div className="form-section">
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "rgba(230, 57, 70, 0.1)",
                  color: "var(--primary)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  marginBottom: 16,
                }}
              >
                <i className="fas fa-lock" />
              </div>
              <h2 style={{ marginBottom: 8 }}>Authentication Required</h2>
              <p style={{ color: "var(--gray)", marginBottom: 24 }}>
                Please log in or register to view your personal donor dashboard, tracked donations, and eligibility status.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <Link to="/login" className="btn">
                  Sign In
                </Link>
                <Link to="/register" className="btn btn-outline">
                  Register as Donor
                </Link>
              </div>
            </div>
          </div>
        </section>
        <Footer />
      </>
    );
  }

  const completedDonationsCount = donations.filter((d) => d.status === "completed").length;
  const isMedicallyEligible = eligibility?.isMedicallyEligible ?? user.isEligible;
  const isAvailable = user.isDonorAvailable;

  return (
    <>
      <Navbar solid />

      <section className="hero hero-compact" style={{ minHeight: "35vh", padding: "60px 0 30px" }}>
        <div className="hero-inner">
          <h1>Donor Dashboard</h1>
          <p>Track your verified donations, medical eligibility, and life-saving activity.</p>
        </div>
      </section>

      <section className="features" style={{ padding: "30px 0 80px" }}>
        <div className="container" style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* Welcome Banner */}
          <div
            className="form-section"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 16,
              marginBottom: 24,
              borderLeft: "5px solid var(--primary)",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ color: "var(--secondary)", margin: 0 }}>Welcome back, {user.name}!</h2>
                <span
                  style={{
                    backgroundColor: "rgba(230,57,70,0.12)",
                    color: "var(--primary)",
                    padding: "3px 10px",
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  {user.role}
                </span>
              </div>
              <p style={{ color: "var(--gray)", margin: "6px 0 0" }}>
                Thank you for being part of REDhope. Your voluntary blood donations save lives across India.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button
                onClick={handleToggleAvailability}
                disabled={togglingStatus}
                className="btn btn-outline"
                style={{
                  borderColor: isAvailable ? "var(--success)" : "var(--gray)",
                  color: isAvailable ? "var(--success)" : "var(--gray)",
                  backgroundColor: "white",
                  fontSize: 14,
                  padding: "8px 16px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <i className={`fas fa-toggle-${isAvailable ? "on" : "off"}`} style={{ fontSize: 18 }} />
                {togglingStatus
                  ? "Updating..."
                  : isAvailable
                  ? "Available for Emergency Calls"
                  : "Unavailable for Calls"}
              </button>

              <Link to="/profile" className="btn" style={{ padding: "8px 18px", fontSize: 14 }}>
                <i className="fas fa-user-edit" style={{ marginRight: 6 }} /> Edit Profile
              </Link>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 20,
              marginBottom: 28,
            }}
          >
            {/* Blood Group */}
            <div className="form-section" style={{ padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray)", textTransform: "uppercase" }}>
                Blood Group
              </div>
              <div style={{ fontSize: "2.8rem", fontWeight: 800, color: "var(--primary)", lineHeight: 1.2 }}>
                {user.bloodGroup || "—"}
              </div>
              <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 4 }}>
                Verified donor type
              </div>
            </div>

            {/* Eligibility */}
            <div className="form-section" style={{ padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray)", textTransform: "uppercase" }}>
                Eligibility Status
              </div>
              <div
                style={{
                  fontSize: "1.4rem",
                  fontWeight: 700,
                  marginTop: 10,
                  color: isMedicallyEligible ? "var(--success)" : "#d97706",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <i className={`fas fa-${isMedicallyEligible ? "check-circle" : "clock"}`} />
                {isMedicallyEligible ? "Eligible to Donate" : "Waiting Period"}
              </div>
              <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 8 }}>
                <Link to="/eligibility" style={{ color: "var(--primary)", fontWeight: 600 }}>
                  View criteria & rules &rarr;
                </Link>
              </div>
            </div>

            {/* Total Donations */}
            <div className="form-section" style={{ padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray)", textTransform: "uppercase" }}>
                Completed Donations
              </div>
              <div style={{ fontSize: "2.8rem", fontWeight: 800, color: "var(--secondary)", lineHeight: 1.2 }}>
                {completedDonationsCount}
              </div>
              <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 4 }}>
                {user.lastDonationDate
                  ? `Last on ${new Date(user.lastDonationDate).toLocaleDateString()}`
                  : "No recorded donations yet"}
              </div>
            </div>

            {/* Registered Camps */}
            <div className="form-section" style={{ padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray)", textTransform: "uppercase" }}>
                Active Camps
              </div>
              <div style={{ fontSize: "2.8rem", fontWeight: 800, color: "var(--primary)", lineHeight: 1.2 }}>
                {campsRegistered.length}
              </div>
              <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 4 }}>
                <Link to="/camps" style={{ color: "var(--primary)", fontWeight: 600 }}>
                  Find nearby camps &rarr;
                </Link>
              </div>
            </div>
          </div>

          {/* Main Content Layout */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 24,
            }}
          >
            {/* Left Column: Personal Info & Quick Actions */}
            <div>
              <div className="form-section" style={{ marginBottom: 24 }}>
                <h3><i className="fas fa-id-card" style={{ marginRight: 8, color: "var(--primary)" }} /> Donor Profile</h3>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
                  <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: "var(--gray)", textTransform: "uppercase" }}>Phone</div>
                    <div style={{ fontWeight: 600, color: "var(--secondary)" }}>{user.phone || "Not set"}</div>
                  </div>

                  <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: "var(--gray)", textTransform: "uppercase" }}>Email</div>
                    <div style={{ fontWeight: 600, color: "var(--secondary)", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {user.email}
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: "var(--gray)", textTransform: "uppercase" }}>City / State</div>
                    <div style={{ fontWeight: 600, color: "var(--secondary)" }}>
                      {user.location?.city ? `${user.location.city}, ${user.location.state || ""}` : "Location not set"}
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: "var(--gray)", textTransform: "uppercase" }}>Date of Birth</div>
                    <div style={{ fontWeight: 600, color: "var(--secondary)" }}>
                      {user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : "Not specified"}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 20, textAlign: "right" }}>
                  <Link to="/profile" className="btn btn-outline" style={{ fontSize: 13, padding: "6px 14px" }}>
                    Complete / Update Details
                  </Link>
                </div>
              </div>

              {/* Quick Navigation Cards */}
              <div className="form-section">
                <h3><i className="fas fa-compass" style={{ marginRight: 8, color: "var(--primary)" }} /> Quick Actions</h3>
                <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                  <Link
                    to="/camps"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      borderRadius: 8,
                      background: "#f8fafc",
                      textDecoration: "none",
                      color: "inherit",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <i className="fas fa-map-marked-alt" style={{ fontSize: 20, color: "var(--primary)" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>Discover Blood Camps</div>
                      <div style={{ fontSize: 12, color: "var(--gray)" }}>Find upcoming drives in your city or map location</div>
                    </div>
                    <i className="fas fa-chevron-right" style={{ color: "#94a3b8" }} />
                  </Link>

                  <Link
                    to="/matching"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      borderRadius: 8,
                      background: "#f8fafc",
                      textDecoration: "none",
                      color: "inherit",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <i className="fas fa-hands-helping" style={{ fontSize: 20, color: "#10b981" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>Emergency Matching</div>
                      <div style={{ fontSize: 12, color: "var(--gray)" }}>Connect patients in need with compatible donors</div>
                    </div>
                    <i className="fas fa-chevron-right" style={{ color: "#94a3b8" }} />
                  </Link>

                  <Link
                    to="/donations"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      borderRadius: 8,
                      background: "#f8fafc",
                      textDecoration: "none",
                      color: "inherit",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <i className="fas fa-file-medical-alt" style={{ fontSize: 20, color: "#6366f1" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>Donation History & Records</div>
                      <div style={{ fontSize: 12, color: "var(--gray)" }}>View all past units and verified donation logs</div>
                    </div>
                    <i className="fas fa-chevron-right" style={{ color: "#94a3b8" }} />
                  </Link>

                  <Link
                    to="/health-screening"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      borderRadius: 8,
                      background: "#f0fdf4",
                      textDecoration: "none",
                      color: "inherit",
                      border: "1px solid #bbf7d0",
                    }}
                  >
                    <i className="fas fa-notes-medical" style={{ fontSize: 20, color: "var(--success)" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>Health Screening & Medical Review</div>
                      <div style={{ fontSize: 12, color: "var(--gray)" }}>Questionnaire & medical report clearance</div>
                    </div>
                    <i className="fas fa-chevron-right" style={{ color: "#16a34a" }} />
                  </Link>

                  {user.role === "admin" ? (
                    <Link
                      to="/admin/health-screenings"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 16px",
                        borderRadius: 8,
                        background: "#eff6ff",
                        textDecoration: "none",
                        color: "inherit",
                        border: "1px solid #bfdbfe",
                      }}
                    >
                      <i className="fas fa-stethoscope" style={{ fontSize: 20, color: "#2563eb" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>Medical Review Console</div>
                        <div style={{ fontSize: 12, color: "var(--gray)" }}>Clinical review of donor screenings and reports</div>
                      </div>
                      <i className="fas fa-chevron-right" style={{ color: "#2563eb" }} />
                    </Link>
                  ) : null}

                  {user.role === "organizer" || user.role === "admin" ? (
                    <Link
                      to="/organizer"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 16px",
                        borderRadius: 8,
                        background: "#fffbeb",
                        textDecoration: "none",
                        color: "inherit",
                        border: "1px solid #fde68a",
                      }}
                    >
                      <i className="fas fa-gauge-high" style={{ fontSize: 20, color: "#d97706" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>Organizer Console</div>
                        <div style={{ fontSize: 12, color: "var(--gray)" }}>Manage camps, donors, and view real-time analytics</div>
                      </div>
                      <i className="fas fa-chevron-right" style={{ color: "#d97706" }} />
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Right Column: Recent Activity & Registered Camps */}
            <div>
              {/* Registered Camps */}
              <div className="form-section" style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ margin: 0 }}>
                    <i className="fas fa-calendar-check" style={{ marginRight: 8, color: "var(--primary)" }} />
                    My Camp Registrations
                  </h3>
                  <Link to="/camps" style={{ fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>
                    Browse all
                  </Link>
                </div>

                {loadingData ? (
                  <div style={{ padding: "20px 0", textAlign: "center", color: "var(--gray)" }}>
                    <i className="fas fa-circle-notch fa-spin" style={{ marginRight: 8 }} /> Loading camps...
                  </div>
                ) : campsRegistered.length === 0 ? (
                  <div style={{ padding: "24px 16px", textAlign: "center", background: "#f8fafc", borderRadius: 8 }}>
                    <p style={{ color: "var(--gray)", fontSize: 14, margin: "0 0 12px" }}>
                      You haven't registered for any upcoming blood camps yet.
                    </p>
                    <Link to="/camps" className="btn btn-outline" style={{ fontSize: 13, padding: "6px 14px" }}>
                      Find Camps Near You
                    </Link>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {campsRegistered.map((reg) => (
                      <div
                        key={reg._id}
                        style={{
                          padding: 14,
                          background: "#f8fafc",
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--secondary)" }}>
                            {reg.camp?.name || "Blood Donation Camp"}
                          </div>
                          <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 2 }}>
                            <i className="fas fa-map-marker-alt" style={{ marginRight: 6 }} />
                            {reg.camp?.location?.city || "Location details on camp page"}
                          </div>
                          {reg.camp?.startDate && (
                            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                              <i className="fas fa-calendar-alt" style={{ marginRight: 6 }} />
                              {new Date(reg.camp.startDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        {reg.camp?._id && (
                          <Link
                            to="/camps/$campId"
                            params={{ campId: reg.camp._id }}
                            className="btn btn-outline"
                            style={{ fontSize: 12, padding: "4px 10px" }}
                          >
                            Details
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Donations */}
              <div className="form-section">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ margin: 0 }}>
                    <i className="fas fa-history" style={{ marginRight: 8, color: "var(--primary)" }} />
                    Recent Donations
                  </h3>
                  <Link to="/donations" style={{ fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>
                    View all history
                  </Link>
                </div>

                {loadingData ? (
                  <div style={{ padding: "20px 0", textAlign: "center", color: "var(--gray)" }}>
                    <i className="fas fa-circle-notch fa-spin" style={{ marginRight: 8 }} /> Loading history...
                  </div>
                ) : donations.length === 0 ? (
                  <div style={{ padding: "24px 16px", textAlign: "center", background: "#f8fafc", borderRadius: 8 }}>
                    <p style={{ color: "var(--gray)", fontSize: 14, margin: "0 0 12px" }}>
                      No verified donation records yet. Join a blood camp to make your first donation!
                    </p>
                    <Link to="/camps" className="btn btn-outline" style={{ fontSize: 13, padding: "6px 14px" }}>
                      Find Camps
                    </Link>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {donations.map((d) => (
                      <div
                        key={d._id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "12px 16px",
                          background: "#f8fafc",
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          gap: 12,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--secondary)" }}>
                            {new Date(d.donationDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                          <div style={{ fontSize: 13, color: "var(--gray)" }}>
                            {d.camp?.name || "Blood Drive"} &bull; {d.units} unit ({d.bloodGroup})
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "white",
                            background:
                              d.status === "completed"
                                ? "var(--success)"
                                : d.status === "scheduled"
                                ? "#3b82f6"
                                : "#ef4444",
                            padding: "4px 10px",
                            borderRadius: 20,
                            textTransform: "uppercase",
                          }}
                        >
                          {d.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
