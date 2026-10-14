import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { toast } from "../components/AppToaster";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { getEligibilityDisplay, type EligibilityEvaluation } from "../lib/eligibility";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — REDhope" },
      {
        name: "description",
        content: "REDhope dashboard: view your blood requirements, donation history, eligibility status, and upcoming camps.",
      },
      { property: "og:title", content: "Dashboard — REDhope" },
      { property: "og:description", content: "Track your blood donations and eligibility or find compatible donors." },
    ],
  }),
  component: DashboardPage,
});

const COMPATIBLE_DONORS_FOR_RECIPIENT: Record<string, string[]> = {
  "O-": ["O-"],
  "O+": ["O+", "O-"],
  "A-": ["A-", "O-"],
  "A+": ["A+", "A-", "O+", "O-"],
  "B-": ["B-", "O-"],
  "B+": ["B+", "B-", "O+", "O-"],
  "AB-": ["AB-", "A-", "B-", "O-"],
  "AB+": ["AB+", "AB-", "A+", "A-", "B+", "B-", "O+", "O-"],
};

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

  const [eligibility, setEligibility] = useState<EligibilityEvaluation | null>(null);
  const [donations, setDonations] = useState<RecentDonation[]>([]);
  const [campsRegistered, setCampsRegistered] = useState<CampRegistrationItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [customRadius, setCustomRadius] = useState<number | string>(user?.notificationRadiusKm ?? 25);
  const [isSavingRadius, setIsSavingRadius] = useState(false);

  const isOrganizer = user?.role === "organizer";
  const isRecipient = user?.role === "user" && user?.isDonorAvailable === false;
  const isDonor = user?.role === "user" && user?.isDonorAvailable !== false;
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (user?.role === "organizer") {
      navigate({ to: "/organizer" });
    }
  }, [user?.role, navigate]);

  useEffect(() => {
    if (user?.notificationRadiusKm !== undefined) {
      setCustomRadius(user.notificationRadiusKm);
    }
  }, [user?.notificationRadiusKm]);

  const handleSaveRadius = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    const parsed = Number(customRadius);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 200) {
      toast.error("Please enter a valid coverage radius between 1 and 200 km.");
      return;
    }
    const rounded = Math.round(parsed);
    setIsSavingRadius(true);
    try {
      const res = await api.put<{ success: boolean; user: any }>("/auth/me", {
        notificationRadiusKm: rounded,
      });
      if (res?.success) {
        updateUserInMemory({ notificationRadiusKm: rounded });
        toast.success(`Camp alert coverage radius updated to ${rounded} km!`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update notification coverage radius.");
    } finally {
      setIsSavingRadius(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLoadingData(false);
      return;
    }

    if (user?.role === "organizer") {
      setLoadingData(false);
      return;
    }

    if (token) {
      loadDashboardData();
    }
  }, [authLoading, isAuthenticated, token, user?.role, user?.isDonorAvailable]);

  const loadDashboardData = async () => {
    setLoadingData(true);
    try {
      // 1. Fetch Eligibility (for donors and admins)
      if (!isRecipient) {
        try {
          const elRes = await api.get<{ success: boolean; data: EligibilityEvaluation }>("/eligibility/me");
          if (elRes?.success && elRes.data) {
            setEligibility(elRes.data);
          }
        } catch (e) {
          console.warn("Failed to fetch eligibility", e);
        }

        // 2. Fetch Recent Donations (for donors and admins)
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
      }

      // 3. Fetch User Registered Camps (for all users)
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
        toast.success(
          newStatus
            ? "Switched to Blood Donor mode! You are now available for donations."
            : "Switched to Recipient mode (Seeking Blood)."
        );
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
                Please log in or register to view your personal dashboard.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <Link to="/login" className="btn">
                  Sign In
                </Link>
                <Link to="/register" className="btn btn-outline">
                  Register
                </Link>
              </div>
            </div>
          </div>
        </section>
        <Footer />
      </>
    );
  }

  if (isOrganizer) {
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
                <i className="fas fa-gauge-high" />
              </div>
              <h2 style={{ marginBottom: 8 }}>Organizer Dashboard</h2>
              <p style={{ color: "var(--gray)", marginBottom: 24 }}>
                Welcome, Camp Organizer! Please proceed to your specialized Camp Management Console.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <Link to="/organizer" className="btn">
                  Go to Organizer Dashboard
                </Link>
                <Link to="/profile" className="btn btn-outline">
                  My Profile
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
  const eligibilityDisplay = getEligibilityDisplay(eligibility, user);
  const isAvailable = user.isDonorAvailable;

  return (
    <>
      <Navbar solid />

      <section className="hero hero-compact" style={{ minHeight: "35vh", padding: "60px 0 30px" }}>
        <div className="hero-inner">
          <h1>{isRecipient ? "Recipient Dashboard" : "Donor Dashboard"}</h1>
          <p>
            {isRecipient
              ? "Find compatible blood donors, locate nearby donation drives, and manage emergency alerts."
              : "Track your verified donations, medical eligibility, and life-saving activity."}
          </p>
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
              borderLeft: isRecipient ? "5px solid #2563eb" : "5px solid var(--primary)",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{ color: "var(--secondary)", margin: 0 }}>Welcome back, {user.name}!</h2>
                <span
                  style={{
                    backgroundColor: isRecipient ? "rgba(37, 99, 235, 0.12)" : "rgba(230,57,70,0.12)",
                    color: isRecipient ? "#2563eb" : "var(--primary)",
                    padding: "3px 10px",
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  {isRecipient ? "Person Seeking Blood" : isAdmin ? "Admin" : "Blood Donor"}
                </span>
              </div>
              <p style={{ color: "var(--gray)", margin: "6px 0 0" }}>
                {isRecipient
                  ? "Welcome to REDhope. We connect you with verified, medically eligible blood donors across India."
                  : "Thank you for being part of REDhope. Your voluntary blood donations save lives across India."}
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button
                onClick={handleToggleAvailability}
                disabled={togglingStatus}
                className="btn btn-outline"
                style={{
                  borderColor: isAvailable ? "var(--success)" : "#2563eb",
                  color: isAvailable ? "var(--success)" : "#2563eb",
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
                  ? "Available Donor (Active)"
                  : "Recipient Mode (Seeking Blood)"}
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
            {isRecipient ? (
              <>
                {/* Blood Group Needed */}
                <div className="form-section" style={{ padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray)", textTransform: "uppercase" }}>
                    Blood Group Needed
                  </div>
                  <div style={{ fontSize: "2.8rem", fontWeight: 800, color: "#2563eb", lineHeight: 1.2 }}>
                    {user.bloodGroup || "—"}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 4 }}>
                    Recipient requirement
                  </div>
                </div>

                {/* Compatible Donors */}
                <div className="form-section" style={{ padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray)", textTransform: "uppercase" }}>
                    Compatible Donor Types
                  </div>
                  <div
                    style={{
                      fontSize: "1.2rem",
                      fontWeight: 800,
                      color: "var(--secondary)",
                      marginTop: 10,
                      lineHeight: 1.3,
                      minHeight: 38,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexWrap: "wrap",
                      gap: 4,
                    }}
                  >
                    {user.bloodGroup && COMPATIBLE_DONORS_FOR_RECIPIENT[user.bloodGroup]
                      ? COMPATIBLE_DONORS_FOR_RECIPIENT[user.bloodGroup].join(", ")
                      : "Compatible types"}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 6 }}>
                    <Link to="/matching" style={{ color: "#2563eb", fontWeight: 600 }}>
                      Search matching donors &rarr;
                    </Link>
                  </div>
                </div>

                {/* Emergency Donor Search */}
                <div className="form-section" style={{ padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray)", textTransform: "uppercase" }}>
                    Donor Search
                  </div>
                  <div
                    style={{
                      fontSize: "1.3rem",
                      fontWeight: 700,
                      marginTop: 10,
                      color: "var(--success)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      minHeight: 38,
                    }}
                  >
                    <i className="fas fa-search-location" />
                    Live Matching
                  </div>
                  <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 6 }}>
                    <Link to="/matching" style={{ color: "var(--primary)", fontWeight: 600 }}>
                      Find eligible donors &rarr;
                    </Link>
                  </div>
                </div>

                {/* Nearby Donation Camps */}
                <div className="form-section" style={{ padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--gray)", textTransform: "uppercase" }}>
                    Nearby Donation Drives
                  </div>
                  <div style={{ fontSize: "2.8rem", fontWeight: 800, color: "var(--primary)", lineHeight: 1.2 }}>
                    {campsRegistered.length > 0 ? campsRegistered.length : "Camps"}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 4 }}>
                    <Link to="/camps" style={{ color: "var(--primary)", fontWeight: 600 }}>
                      Find nearby camps &rarr;
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <>
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
                      fontSize: "1.3rem",
                      fontWeight: 700,
                      marginTop: 10,
                      color: eligibilityDisplay.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <i className={eligibilityDisplay.icon} />
                    {eligibilityDisplay.badgeText}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 8 }}>
                    <Link
                      to={eligibilityDisplay.linkTo || "/eligibility"}
                      style={{ color: "var(--primary)", fontWeight: 600 }}
                    >
                      {eligibilityDisplay.linkText || "View criteria & rules →"}
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
              </>
            )}
          </div>

          {/* Main Content Layout */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 24,
            }}
          >
            {/* Left Column: Personal Info & Coverage Settings */}
            <div>
              <div className="form-section" style={{ marginBottom: 24 }}>
                <h3>
                  <i className="fas fa-id-card" style={{ marginRight: 8, color: isRecipient ? "#2563eb" : "var(--primary)" }} />
                  {isRecipient ? "Recipient Profile" : "Donor Profile"}
                </h3>

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
                    <div style={{ fontSize: 11, color: "var(--gray)", textTransform: "uppercase" }}>
                      {isRecipient ? "Needed Blood Type" : "Blood Group"}
                    </div>
                    <div style={{ fontWeight: 600, color: "var(--secondary)" }}>
                      {user.bloodGroup || "Not specified"}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 20, textAlign: "right" }}>
                  <Link to="/profile" className="btn btn-outline" style={{ fontSize: 13, padding: "6px 14px" }}>
                    Complete / Update Details
                  </Link>
                </div>
              </div>

              {/* Camp Alert Coverage Radius Card */}
              <div className="form-section" style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <h3 style={{ margin: 0, fontSize: "1.05rem" }}>
                    <i className="fas fa-radar" style={{ marginRight: 8, color: "var(--primary)" }} />
                    Camp Notification Radius
                  </h3>
                  <span
                    style={{
                      background: "rgba(230, 57, 70, 0.1)",
                      color: "var(--primary)",
                      fontWeight: 700,
                      fontSize: 12,
                      padding: "3px 10px",
                      borderRadius: 20,
                    }}
                  >
                    Active: {user.notificationRadiusKm ?? 25} km
                  </span>
                </div>

                <p style={{ fontSize: 13, color: "var(--gray)", margin: "0 0 14px", lineHeight: 1.5 }}>
                  {isRecipient
                    ? "Set your coverage area (in kilometers) to get email and in-app alerts whenever a blood drive or camp is scheduled near your location."
                    : "Define the maximum coverage area (in kilometers) around your location to receive email and in-app alerts whenever a blood donation camp is scheduled near you."}
                </p>

                <form onSubmit={handleSaveRadius} style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
                  <div style={{ position: "relative", flex: 1 }}>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      step={1}
                      value={customRadius}
                      onChange={(e) => setCustomRadius(e.target.value)}
                      placeholder="e.g. 25"
                      style={{
                        width: "100%",
                        padding: "10px 48px 10px 14px",
                        border: "1.5px solid #cbd5e1",
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--secondary)",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        right: 14,
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#94a3b8",
                        pointerEvents: "none",
                      }}
                    >
                      km
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="btn"
                    disabled={
                      isSavingRadius ||
                      Number(customRadius) === (user.notificationRadiusKm ?? 25) ||
                      !customRadius ||
                      Number(customRadius) < 1 ||
                      Number(customRadius) > 200
                    }
                    style={{
                      padding: "10px 18px",
                      fontSize: 14,
                      whiteSpace: "nowrap",
                      opacity:
                        Number(customRadius) === (user.notificationRadiusKm ?? 25) ? 0.6 : 1,
                    }}
                  >
                    {isSavingRadius ? (
                      <>
                        <i className="fas fa-circle-notch fa-spin" style={{ marginRight: 6 }} /> Saving...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save" style={{ marginRight: 6 }} /> Save Radius
                      </>
                    )}
                  </button>
                </form>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 12,
                    fontSize: 12,
                    color: "var(--gray)",
                  }}
                >
                  <i className="fas fa-info-circle" style={{ color: "var(--primary)" }} />
                  <span>Enter any custom distance between 1 km and 200 km.</span>
                </div>
              </div>

              {/* Quick Navigation Cards */}
              <div className="form-section">
                <h3>
                  <i className="fas fa-compass" style={{ marginRight: 8, color: isRecipient ? "#2563eb" : "var(--primary)" }} />
                  Quick Actions
                </h3>
                <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                  {isRecipient ? (
                    <>
                      <Link
                        to="/matching"
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
                        <i className="fas fa-search-location" style={{ fontSize: 20, color: "#16a34a" }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: "#15803d" }}>Find Matching Donors</div>
                          <div style={{ fontSize: 12, color: "var(--gray)" }}>Search compatible donors by proximity & availability</div>
                        </div>
                        <i className="fas fa-chevron-right" style={{ color: "#16a34a" }} />
                      </Link>

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
                        to="/notifications"
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
                        <i className="fas fa-bell" style={{ fontSize: 20, color: "#6366f1" }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>Notifications & Alerts</div>
                          <div style={{ fontSize: 12, color: "var(--gray)" }}>Camp announcements and matched donor notifications</div>
                        </div>
                        <i className="fas fa-chevron-right" style={{ color: "#94a3b8" }} />
                      </Link>
                    </>
                  ) : (
                    <>
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

                      {isAdmin ? (
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
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Role-specific Content */}
            <div>
              {isRecipient ? (
                <>
                  {/* Urgent Matching Banner */}
                  <div
                    className="form-section"
                    style={{
                      marginBottom: 24,
                      background: "linear-gradient(135deg, rgba(230, 57, 70, 0.05) 0%, rgba(29, 53, 87, 0.05) 100%)",
                      border: "1.5px solid rgba(230, 57, 70, 0.3)",
                      borderRadius: 12,
                      padding: 24,
                    }}
                  >
                    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: "50%",
                          background: "var(--primary)",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 22,
                          flexShrink: 0,
                        }}
                      >
                        <i className="fas fa-search-location" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: "0 0 6px", color: "var(--secondary)", fontSize: "1.2rem" }}>
                          Need Blood Urgently?
                        </h3>
                        <p style={{ margin: "0 0 16px", color: "var(--gray)", fontSize: 14, lineHeight: 1.5 }}>
                          Find compatible, medically eligible, and available blood donors ranked by suitability and proximity to your location.
                        </p>
                        <Link
                          to="/matching"
                          className="btn"
                          style={{
                            padding: "10px 22px",
                            fontSize: 14,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <i className="fas fa-heartbeat" /> Search Matching Donors Now
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Compatibility Guide Card */}
                  <div className="form-section" style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <i className="fas fa-shield-halved" style={{ color: "#2563eb", fontSize: 18 }} />
                      <h3 style={{ margin: 0, fontSize: "1.1rem" }}>
                        Red Blood Cell Compatibility ({user.bloodGroup || "Your Type"})
                      </h3>
                    </div>

                    <p style={{ fontSize: 13, color: "var(--gray)", margin: "0 0 14px", lineHeight: 1.5 }}>
                      {user.bloodGroup === "AB+"
                        ? "AB+ is the universal recipient: you can receive red blood cells from any blood group."
                        : user.bloodGroup === "O-"
                        ? "O- recipients can only receive red blood cells from O- donors (universal donor type)."
                        : `As a ${user.bloodGroup || "recipient"}, you can receive red blood cells from the compatible donor groups shown below.`}
                    </p>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {(COMPATIBLE_DONORS_FOR_RECIPIENT[user.bloodGroup || ""] || ["O-", "O+"]).map((bg) => (
                        <span
                          key={bg}
                          style={{
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            border: "1px solid #bfdbfe",
                            padding: "6px 14px",
                            borderRadius: 8,
                            fontWeight: 700,
                            fontSize: 14,
                          }}
                        >
                          <i className="fas fa-check" style={{ marginRight: 6, fontSize: 11 }} />
                          {bg} Compatible
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Upcoming Blood Camps & Drives */}
                  <div className="form-section">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <h3 style={{ margin: 0 }}>
                        <i className="fas fa-tent" style={{ marginRight: 8, color: "var(--primary)" }} />
                        Nearby Blood Camps & Drives
                      </h3>
                      <Link to="/camps" style={{ fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>
                        Explore all
                      </Link>
                    </div>

                    {campsRegistered.length > 0 ? (
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
                    ) : (
                      <div style={{ padding: "24px 16px", textAlign: "center", background: "#f8fafc", borderRadius: 8 }}>
                        <p style={{ color: "var(--gray)", fontSize: 14, margin: "0 0 12px" }}>
                          Discover certified blood drives happening near your location. Connect with organizers and hospitals.
                        </p>
                        <Link to="/camps" className="btn btn-outline" style={{ fontSize: 13, padding: "6px 14px" }}>
                          Browse Nearby Camps
                        </Link>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Registered Camps for Donors */}
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

                  {/* Recent Verified Donations for Donors */}
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
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
