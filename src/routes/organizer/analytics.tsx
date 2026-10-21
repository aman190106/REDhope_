import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { toast } from "../../components/AppToaster";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

export const Route = createFileRoute("/organizer/analytics")({
  head: () => ({
    meta: [
      { title: "Organizer Analytics — REDhope" },
      {
        name: "description",
        content: "Detailed insights into blood donation camp performance, registration trends, and donor demographics.",
      },
      { property: "og:title", content: "Organizer Analytics — REDhope" },
      { property: "og:description", content: "Analyze blood camp performance, capacity utilization, and donor demographics." },
    ],
  }),
  component: OrganizerAnalyticsPage,
});

import { API_BASE_URL } from "../../lib/api";
const API_BASE = API_BASE_URL;

interface AnalyticsSummary {
  totalCamps: number;
  draftCamps: number;
  publishedCamps: number;
  completedCamps: number;
  cancelledCamps: number;
  totalCapacity: number;
  totalRegistrations: number;
  activeRegistrations: number;
  cancelledRegistrations: number;
  capacityUtilization: number;
  totalDonations?: number;
  completedDonations?: number;
  scheduledDonations?: number;
  cancelledDonations?: number;
  noShowDonations?: number;
  totalUnitsDonated?: number;
}

interface RegistrationTrendItem {
  period: string;
  registrations: number;
}

interface DonationTrendItem {
  period: string;
  donations: number;
  units?: number;
}

interface TopCampItem {
  campId: string;
  name: string;
  capacity: number;
  registrations: number;
  utilization: number;
  completedDonations?: number;
  donatedUnits?: number;
}

interface BloodGroupDistributionItem {
  bloodGroup: string;
  count: number;
  units?: number;
}

interface CampStatusDistributionItem {
  status: "draft" | "published" | "completed" | "cancelled";
  count: number;
}

interface UserMetrics {
  totalRegisteredUsers: number;
  availableDonors: number;
  eligibleDonors: number;
  usersByBloodGroup: { bloodGroup: string; count: number }[];
}

interface BloodRequestMetrics {
  totalRequests: number;
  activeRequests: number;
  fulfilledRequests: number;
  cancelledRequests: number;
  requestsByBloodGroup: { bloodGroup: string; count: number }[];
  monthlyTrend: { period: string; count: number }[];
}

interface AnalyticsData {
  summary: AnalyticsSummary;
  registrationTrend: RegistrationTrendItem[];
  topCamps: TopCampItem[];
  bloodGroupDistribution: BloodGroupDistributionItem[];
  campStatusDistribution: CampStatusDistributionItem[];
  donations?: {
    totalDonations: number;
    completedDonations: number;
    scheduledDonations: number;
    cancelledDonations: number;
    noShowDonations: number;
    totalUnitsDonated: number;
    monthlyTrend: DonationTrendItem[];
    bloodGroupDistribution: BloodGroupDistributionItem[];
  };
  scope?: string;
  userMetrics?: UserMetrics;
  bloodRequestMetrics?: BloodRequestMetrics;
}

interface UserProfile {
  _id: string;
  name: string;
  email: string;
  role: "user" | "organizer" | "admin";
}

function OrganizerAnalyticsPage() {
  const navigate = useNavigate();

  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Analytics data state
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // Date filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<{ from?: string; to?: string }>({});

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
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        setCurrentUser(data.user);
        if (data.user.role === "organizer" || data.user.role === "admin") {
          fetchAnalytics(authToken, appliedFilters);
        }
      } else {
        setToken(null);
        setCurrentUser(null);
      }
    } catch {
      setToken(null);
      setCurrentUser(null);
    } finally {
      setLoadingAuth(false);
    }
  };

  const fetchAnalytics = async (
    authToken: string,
    filters: { from?: string; to?: string } = {}
  ) => {
    setLoadingAnalytics(true);
    setAnalyticsError(null);

    try {
      const params = new URLSearchParams();
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);

      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`${API_BASE}/camps/analytics${qs}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setAnalyticsError(data.message || "Failed to load analytics.");
        toast.error(data.message || "Failed to load analytics.");
        return;
      }

      setAnalytics(data.data);
    } catch (err) {
      console.error("Fetch analytics error:", err);
      setAnalyticsError("Could not connect to the analytics server.");
      toast.error("Network error while loading analytics.");
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();

    if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
      toast.error("'From' date cannot be after 'To' date.");
      return;
    }

    const filters: { from?: string; to?: string } = {};
    if (fromDate) filters.from = fromDate;
    if (toDate) filters.to = toDate;

    setAppliedFilters(filters);
    if (token) {
      fetchAnalytics(token, filters);
    }
  };

  const handleResetFilter = () => {
    setFromDate("");
    setToDate("");
    setAppliedFilters({});
    if (token) {
      fetchAnalytics(token, {});
    }
  };

  const formatPeriod = (periodStr: string) => {
    try {
      const [year, month] = periodStr.split("-");
      const d = new Date(parseInt(year), parseInt(month) - 1, 1);
      return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    } catch {
      return periodStr;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "#198754";
      case "draft":
        return "#ffc107";
      case "completed":
        return "#0d6efd";
      case "cancelled":
        return "#dc3545";
      default:
        return "#6c757d";
    }
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 80) return "#198754"; // High: Green
    if (utilization >= 50) return "#0d6efd"; // Medium: Blue
    if (utilization >= 25) return "#ffc107"; // Moderate: Yellow
    return "#6c757d"; // Low: Gray
  };

  return (
    <>
      <Navbar solid />

      {/* Hero */}
      <section className="hero hero-compact" style={{ minHeight: "26vh" }}>
        <div className="hero-inner">
          <h1>Camp Analytics & Insights</h1>
          <p>
            {currentUser?.role === "admin"
              ? "Global drive performance, registration volume, and blood group distribution"
              : "Track your camps, capacity utilization, and donor engagement"}
          </p>
        </div>
      </section>

      <section
        className="features"
        style={{
          backgroundColor: "var(--background)",
          minHeight: "70vh",
          paddingTop: 36,
          paddingBottom: 60,
        }}
      >
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
                Please sign in with your organizer or administrator account to access analytics.
              </p>
              <Link to="/profile" className="btn">
                Sign In to REDhope
              </Link>
            </div>
          ) : currentUser?.role !== "organizer" && currentUser?.role !== "admin" ? (
            /* Non-organizer Forbidden */
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
                Your account role is <strong>Donor ({currentUser?.role})</strong>. The Analytics section is reserved for verified blood drive organizers and administrators.
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
            /* Authorized View */
            <div>
              {/* Top Navigation & Scope Bar */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <Link
                    to="/organizer"
                    className="btn btn-outline"
                    style={{ padding: "8px 16px", fontSize: 13 }}
                  >
                    <i className="fas fa-arrow-left" style={{ marginRight: 6 }} /> Back to Dashboard
                  </Link>

                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      padding: "4px 10px",
                      borderRadius: 4,
                      backgroundColor:
                        currentUser?.role === "admin" ? "#b00000" : "var(--secondary)",
                      color: "white",
                    }}
                  >
                    {currentUser?.role === "admin"
                      ? "Admin Global Scope"
                      : "Organizer Workspace"}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => token && fetchAnalytics(token, appliedFilters)}
                    className="btn btn-outline"
                    style={{ padding: "8px 16px", fontSize: 13 }}
                    disabled={loadingAnalytics}
                  >
                    <i
                      className={`fas fa-rotate ${loadingAnalytics ? "fa-spin" : ""}`}
                      style={{ marginRight: 6 }}
                    />
                    Refresh
                  </button>
                </div>
              </div>

              {/* Date Filter Form */}
              <div
                className="form-section"
                style={{
                  margin: "0 0 28px 0",
                  padding: "16px 20px",
                  borderRadius: 8,
                  backgroundColor: "var(--surface)",
                }}
              >
                <form
                  onSubmit={handleApplyFilter}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 14,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <i className="fas fa-calendar-alt" style={{ color: "var(--primary)" }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                      Filter by Camp Start Date:
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 12, color: "var(--gray)", margin: 0 }}>From:</label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      style={{
                        padding: "6px 10px",
                        fontSize: 13,
                        borderRadius: 4,
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--background)",
                        color: "var(--text)",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 12, color: "var(--gray)", margin: 0 }}>To:</label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      style={{
                        padding: "6px 10px",
                        fontSize: 13,
                        borderRadius: 4,
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--background)",
                        color: "var(--text)",
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                    <button
                      type="submit"
                      className="btn"
                      style={{ padding: "6px 14px", fontSize: 12 }}
                      disabled={loadingAnalytics}
                    >
                      <i className="fas fa-filter" style={{ marginRight: 5 }} /> Apply Filter
                    </button>
                    {(appliedFilters.from || appliedFilters.to) && (
                      <button
                        type="button"
                        onClick={handleResetFilter}
                        className="btn btn-outline"
                        style={{ padding: "6px 12px", fontSize: 12 }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </form>

                {(appliedFilters.from || appliedFilters.to) && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--gray)" }}>
                    <i className="fas fa-circle-info" style={{ marginRight: 5 }} />
                    Filtering camps starting{" "}
                    {appliedFilters.from ? `from ${appliedFilters.from}` : ""}
                    {appliedFilters.from && appliedFilters.to ? " " : ""}
                    {appliedFilters.to ? `up to ${appliedFilters.to}` : ""}
                  </div>
                )}
              </div>

              {/* Error Alert */}
              {analyticsError && (
                <div
                  style={{
                    backgroundColor: "rgba(227, 6, 19, 0.1)",
                    border: "1px solid var(--primary)",
                    borderRadius: 6,
                    padding: "16px 20px",
                    color: "var(--primary)",
                    marginBottom: 24,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <i className="fas fa-circle-exclamation" style={{ marginRight: 8 }} />
                    {analyticsError}
                  </div>
                  <button
                    type="button"
                    onClick={() => token && fetchAnalytics(token, appliedFilters)}
                    className="btn btn-outline"
                    style={{ padding: "4px 12px", fontSize: 12 }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Loading State */}
              {loadingAnalytics && !analytics ? (
                <div style={{ textAlign: "center", padding: "60px 0" }}>
                  <i className="fas fa-spinner fa-spin fa-2x" style={{ color: "var(--primary)" }} />
                  <p style={{ marginTop: 12, color: "var(--gray)" }}>Computing camp analytics...</p>
                </div>
              ) : analytics ? (
                <>
                  {/* Summary Metric Cards */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                      gap: 16,
                      marginBottom: 32,
                    }}
                  >
                    {/* Total Camps */}
                    <div
                      className="form-section"
                      style={{
                        margin: 0,
                        padding: "20px 22px",
                        textAlign: "center",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ fontSize: 32, fontWeight: 800, color: "var(--secondary)" }}>
                        {analytics.summary.totalCamps}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 4, fontWeight: 600 }}>
                        Total Camps
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--gray)",
                          marginTop: 8,
                          display: "flex",
                          justifyContent: "center",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={{ color: "#198754" }}>● {analytics.summary.publishedCamps} pub</span>
                        <span style={{ color: "#ffc107" }}>● {analytics.summary.draftCamps} dft</span>
                        <span style={{ color: "#0d6efd" }}>● {analytics.summary.completedCamps} cmp</span>
                      </div>
                    </div>

                    {/* Total Capacity */}
                    <div
                      className="form-section"
                      style={{ margin: 0, padding: "20px 22px", textAlign: "center" }}
                    >
                      <div style={{ fontSize: 32, fontWeight: 800, color: "var(--secondary)" }}>
                        {analytics.summary.totalCapacity}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 4, fontWeight: 600 }}>
                        Total Capacity Slots
                      </div>
                      <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 8 }}>
                        Across all scheduled camps
                      </div>
                    </div>

                    {/* Active Registrations */}
                    <div
                      className="form-section"
                      style={{ margin: 0, padding: "20px 22px", textAlign: "center" }}
                    >
                      <div style={{ fontSize: 32, fontWeight: 800, color: "var(--primary)" }}>
                        {analytics.summary.activeRegistrations}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 4, fontWeight: 600 }}>
                        Active Registrations
                      </div>
                      <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 8 }}>
                        {analytics.summary.totalRegistrations} total ({analytics.summary.cancelledRegistrations} cancelled)
                      </div>
                    </div>

                    {/* Total Donations & Units */}
                    <div
                      className="form-section"
                      style={{ margin: 0, padding: "20px 22px", textAlign: "center" }}
                    >
                      <div style={{ fontSize: 32, fontWeight: 800, color: "#198754" }}>
                        {analytics.summary.completedDonations ?? 0}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 4, fontWeight: 600 }}>
                        Completed Donations
                      </div>
                      <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 8 }}>
                        {analytics.summary.totalUnitsDonated ?? 0} units collected ({analytics.summary.totalDonations ?? 0} total)
                      </div>
                    </div>

                    {/* Capacity Utilization */}
                    <div
                      className="form-section"
                      style={{ margin: 0, padding: "20px 22px", textAlign: "center" }}
                    >
                      <div
                        style={{
                          fontSize: 32,
                          fontWeight: 800,
                          color: getUtilizationColor(analytics.summary.capacityUtilization),
                        }}
                      >
                        {analytics.summary.capacityUtilization}%
                      </div>
                      <div style={{ fontSize: 13, color: "var(--gray)", marginTop: 4, fontWeight: 600 }}>
                        Capacity Utilization
                      </div>
                      <div
                        style={{
                          marginTop: 10,
                          backgroundColor: "#e5e7eb",
                          borderRadius: 999,
                          height: 6,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(analytics.summary.capacityUtilization, 100)}%`,
                            backgroundColor: getUtilizationColor(analytics.summary.capacityUtilization),
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Visualizations Section */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
                      gap: 20,
                      marginBottom: 32,
                    }}
                  >
                    {/* Monthly Registration Trend */}
                    <div
                      className="form-section"
                      style={{ margin: 0, padding: "24px 20px" }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 16,
                        }}
                      >
                        <h3 style={{ fontSize: 16, margin: 0, color: "var(--secondary)" }}>
                          <i className="fas fa-chart-line" style={{ color: "var(--primary)", marginRight: 8 }} />
                          Registration Volume Trend
                        </h3>
                        <span style={{ fontSize: 12, color: "var(--gray)" }}>Monthly breakdown</span>
                      </div>

                      {analytics.registrationTrend && analytics.registrationTrend.length > 0 ? (
                        <div style={{ width: "100%", height: 260 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={analytics.registrationTrend}
                              margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                              <XAxis
                                dataKey="period"
                                tickFormatter={formatPeriod}
                                tick={{ fontSize: 12, fill: "#666" }}
                              />
                              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#666" }} />
                              <Tooltip
                                formatter={(value: any) => [`${value} Donors`, "Registrations"]}
                                labelFormatter={(label: any) => formatPeriod(String(label))}
                                contentStyle={{
                                  borderRadius: 8,
                                  border: "1px solid #ddd",
                                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey="registrations"
                                stroke="#e30613"
                                strokeWidth={3}
                                dot={{ fill: "#e30613", r: 5 }}
                                activeDot={{ r: 7 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div
                          style={{
                            height: 220,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            color: "var(--gray)",
                          }}
                        >
                          <i className="fas fa-chart-line fa-2x" style={{ marginBottom: 10, opacity: 0.4 }} />
                          <p style={{ fontSize: 13 }}>No registration activity recorded yet.</p>
                        </div>
                      )}
                    </div>

                    {/* Blood Group Distribution */}
                    <div
                      className="form-section"
                      style={{ margin: 0, padding: "24px 20px" }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 16,
                        }}
                      >
                        <h3 style={{ fontSize: 16, margin: 0, color: "var(--secondary)" }}>
                          <i className="fas fa-droplet" style={{ color: "var(--primary)", marginRight: 8 }} />
                          Registered Donors by Blood Group
                        </h3>
                        <span style={{ fontSize: 12, color: "var(--gray)" }}>Donor demographics</span>
                      </div>

                      {analytics.bloodGroupDistribution && analytics.bloodGroupDistribution.length > 0 ? (
                        <div style={{ width: "100%", height: 260 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={analytics.bloodGroupDistribution}
                              margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                              <XAxis dataKey="bloodGroup" tick={{ fontSize: 12, fill: "#666" }} />
                              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#666" }} />
                              <Tooltip
                                formatter={(value: any) => [`${value} Donors`, "Count"]}
                                contentStyle={{
                                  borderRadius: 8,
                                  border: "1px solid #ddd",
                                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                                }}
                              />
                              <Bar dataKey="count" fill="#e30613" radius={[4, 4, 0, 0]}>
                                {analytics.bloodGroupDistribution.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={index === 0 ? "#b00000" : "#e30613"}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div
                          style={{
                            height: 220,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            color: "var(--gray)",
                          }}
                        >
                          <i className="fas fa-droplet fa-2x" style={{ marginBottom: 10, opacity: 0.4 }} />
                          <p style={{ fontSize: 13 }}>No donor blood group data available yet.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Second Row: Status Distribution & Top Camps */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
                      gap: 20,
                      marginBottom: 32,
                    }}
                  >
                    {/* Camp Status Breakdown Card */}
                    <div className="form-section" style={{ margin: 0, padding: "24px 20px" }}>
                      <h3 style={{ fontSize: 16, margin: "0 0 16px 0", color: "var(--secondary)" }}>
                        <i className="fas fa-pie-chart" style={{ color: "var(--primary)", marginRight: 8 }} />
                        Camp Lifecycle Distribution
                      </h3>

                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {analytics.campStatusDistribution.map((item) => {
                          const pct =
                            analytics.summary.totalCamps > 0
                              ? Math.round((item.count / analytics.summary.totalCamps) * 100)
                              : 0;
                          return (
                            <div key={item.status}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  marginBottom: 4,
                                  fontSize: 13,
                                }}
                              >
                                <span
                                  style={{
                                    textTransform: "capitalize",
                                    fontWeight: 600,
                                    color: "var(--text)",
                                  }}
                                >
                                  <span
                                    style={{
                                      display: "inline-block",
                                      width: 8,
                                      height: 8,
                                      borderRadius: "50%",
                                      backgroundColor: getStatusColor(item.status),
                                      marginRight: 8,
                                    }}
                                  />
                                  {item.status}
                                </span>
                                <span style={{ color: "var(--gray)", fontWeight: 500 }}>
                                  {item.count} camps ({pct}%)
                                </span>
                              </div>
                              <div
                                style={{
                                  backgroundColor: "#e5e7eb",
                                  borderRadius: 999,
                                  height: 6,
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    height: "100%",
                                    width: `${pct}%`,
                                    backgroundColor: getStatusColor(item.status),
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Top Performing Camps */}
                    <div className="form-section" style={{ margin: 0, padding: "24px 20px" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 16,
                        }}
                      >
                        <h3 style={{ fontSize: 16, margin: 0, color: "var(--secondary)" }}>
                          <i className="fas fa-trophy" style={{ color: "#ffc107", marginRight: 8 }} />
                          Top Performing Camps
                        </h3>
                        <span style={{ fontSize: 12, color: "var(--gray)" }}>By registrations</span>
                      </div>

                      {analytics.topCamps && analytics.topCamps.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {analytics.topCamps.map((camp, idx) => (
                            <div
                              key={camp.campId}
                              style={{
                                padding: "12px 14px",
                                borderRadius: 6,
                                border: "1px solid var(--border)",
                                backgroundColor: "var(--background)",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 12,
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 800,
                                      color: "#888",
                                      width: 18,
                                    }}
                                  >
                                    #{idx + 1}
                                  </span>
                                  <Link
                                    to="/organizer/camps/$campId"
                                    params={{ campId: camp.campId }}
                                    style={{
                                      fontSize: 14,
                                      fontWeight: 700,
                                      color: "var(--secondary)",
                                      textDecoration: "none",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                    title={camp.name}
                                  >
                                    {camp.name}
                                  </Link>
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: "var(--gray)",
                                    marginTop: 4,
                                    paddingLeft: 26,
                                  }}
                                >
                                  Capacity: {camp.capacity} slots
                                </div>
                              </div>

                              <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ fontSize: 15, fontWeight: 800, color: "var(--primary)" }}>
                                  {camp.registrations} donors
                                </div>
                                <div
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: getUtilizationColor(camp.utilization),
                                  }}
                                >
                                  {camp.utilization}% full
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div
                          style={{
                            height: 180,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            color: "var(--gray)",
                          }}
                        >
                          <p style={{ fontSize: 13 }}>No camp performance data available.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Donation Performance & Trends Row */}
                  {analytics.donations && (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
                          gap: 20,
                          marginBottom: 32,
                        }}
                      >
                        {/* Monthly Donation Volume Trend */}
                        <div className="form-section" style={{ margin: 0, padding: "24px 20px" }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: 16,
                            }}
                          >
                            <h3 style={{ fontSize: 16, margin: 0, color: "var(--secondary)" }}>
                              <i className="fas fa-hand-holding-heart" style={{ color: "#198754", marginRight: 8 }} />
                              Completed Donations & Units Trend
                            </h3>
                            <span style={{ fontSize: 12, color: "var(--gray)" }}>Monthly collections</span>
                          </div>

                          {analytics.donations.monthlyTrend && analytics.donations.monthlyTrend.length > 0 ? (
                            <div style={{ width: "100%", height: 260 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={analytics.donations.monthlyTrend}
                                  margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                  <XAxis
                                    dataKey="period"
                                    tickFormatter={formatPeriod}
                                    tick={{ fontSize: 12, fill: "#666" }}
                                  />
                                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#666" }} />
                                  <Tooltip
                                    formatter={(value: any, name: any) => [
                                      name === "units" ? `${value} Units` : `${value} Donations`,
                                      name === "units" ? "Units Collected" : "Completed Donations",
                                    ]}
                                    labelFormatter={(label: any) => formatPeriod(String(label))}
                                    contentStyle={{
                                      borderRadius: 8,
                                      border: "1px solid #ddd",
                                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                                    }}
                                  />
                                  <Bar dataKey="donations" fill="#198754" radius={[4, 4, 0, 0]} name="donations" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <div
                              style={{
                                height: 220,
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                alignItems: "center",
                                color: "var(--gray)",
                              }}
                            >
                              <i className="fas fa-hand-holding-heart fa-2x" style={{ marginBottom: 10, opacity: 0.4 }} />
                              <p style={{ fontSize: 13 }}>No completed donations recorded in this period.</p>
                            </div>
                          )}
                        </div>

                        {/* Donation Blood Group Breakdown */}
                        <div className="form-section" style={{ margin: 0, padding: "24px 20px" }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: 16,
                            }}
                          >
                            <h3 style={{ fontSize: 16, margin: 0, color: "var(--secondary)" }}>
                              <i className="fas fa-cubes-stacked" style={{ color: "var(--primary)", marginRight: 8 }} />
                              Units Donated by Blood Group
                            </h3>
                            <span style={{ fontSize: 12, color: "var(--gray)" }}>Total units</span>
                          </div>

                          {analytics.donations.bloodGroupDistribution && analytics.donations.bloodGroupDistribution.some((b) => (b.units ?? 0) > 0) ? (
                            <div style={{ width: "100%", height: 260 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={analytics.donations.bloodGroupDistribution}
                                  margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                  <XAxis dataKey="bloodGroup" tick={{ fontSize: 12, fill: "#666" }} />
                                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#666" }} />
                                  <Tooltip
                                    formatter={(value: any) => [`${value} Units`, "Collected"]}
                                    contentStyle={{
                                      borderRadius: 8,
                                      border: "1px solid #ddd",
                                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                                    }}
                                  />
                                  <Bar dataKey="units" fill="#b00000" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          ) : (
                            <div
                              style={{
                                height: 220,
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                alignItems: "center",
                                color: "var(--gray)",
                              }}
                            >
                              <i className="fas fa-droplet fa-2x" style={{ marginBottom: 10, opacity: 0.4 }} />
                              <p style={{ fontSize: 13 }}>No donated units recorded yet.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Admin-Only Insights Section */}
                    {currentUser?.role === "admin" && (analytics.userMetrics || analytics.bloodRequestMetrics) && (
                      <div style={{ marginTop: 40, borderTop: "2px dashed var(--border)", paddingTop: 32 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              textTransform: "uppercase",
                              padding: "4px 10px",
                              borderRadius: 4,
                              backgroundColor: "#b00000",
                              color: "white",
                            }}
                          >
                            System-Wide Administrator Metrics
                          </span>
                          <span style={{ fontSize: 13, color: "var(--gray)" }}>
                            Aggregated across all users & public blood requests (zero PII)
                          </span>
                        </div>

                        {/* Admin Metric Cards */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                            gap: 16,
                            marginBottom: 24,
                          }}
                        >
                          {analytics.userMetrics && (
                            <>
                              <div className="form-section" style={{ margin: 0, padding: "18px 20px", textAlign: "center" }}>
                                <div style={{ fontSize: 28, fontWeight: 800, color: "var(--secondary)" }}>
                                  {analytics.userMetrics.totalRegisteredUsers}
                                </div>
                                <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 4, fontWeight: 600 }}>
                                  Total Registered Users
                                </div>
                              </div>
                              <div className="form-section" style={{ margin: 0, padding: "18px 20px", textAlign: "center" }}>
                                <div style={{ fontSize: 28, fontWeight: 800, color: "#198754" }}>
                                  {analytics.userMetrics.availableDonors}
                                </div>
                                <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 4, fontWeight: 600 }}>
                                  Available Donors
                                </div>
                              </div>
                              <div className="form-section" style={{ margin: 0, padding: "18px 20px", textAlign: "center" }}>
                                <div style={{ fontSize: 28, fontWeight: 800, color: "var(--primary)" }}>
                                  {analytics.userMetrics.eligibleDonors}
                                </div>
                                <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 4, fontWeight: 600 }}>
                                  Medically Eligible Donors
                                </div>
                              </div>
                            </>
                          )}

                          {analytics.bloodRequestMetrics && (
                            <>
                              <div className="form-section" style={{ margin: 0, padding: "18px 20px", textAlign: "center" }}>
                                <div style={{ fontSize: 28, fontWeight: 800, color: "var(--secondary)" }}>
                                  {analytics.bloodRequestMetrics.totalRequests}
                                </div>
                                <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 4, fontWeight: 600 }}>
                                  Total Blood Requests
                                </div>
                                <div style={{ fontSize: 11, color: "var(--gray)", marginTop: 4 }}>
                                  {analytics.bloodRequestMetrics.activeRequests} active, {analytics.bloodRequestMetrics.fulfilledRequests} fulfilled
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}

