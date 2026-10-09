import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";

export const Route = createFileRoute("/donations")({
  head: () => ({
    meta: [
      { title: "My Donations — REDhope" },
      {
        name: "description",
        content: "Track your blood donation history, completed donations, and verified units on REDhope.",
      },
      { property: "og:title", content: "My Donations — REDhope" },
      { property: "og:description", content: "View your verified blood donation history on REDhope." },
    ],
  }),
  component: DonationsPage,
});

import { API_BASE_URL } from "../lib/api";
const API_BASE = API_BASE_URL;

interface CampSummary {
  _id: string;
  name: string;
  location?: {
    address?: string;
    city?: string;
    state?: string;
  };
  startDate?: string;
  endDate?: string;
}

interface DonationRecord {
  _id: string;
  camp?: CampSummary;
  donationDate: string;
  units: number;
  bloodGroup: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  notes?: string;
  verifiedAt?: string;
  createdAt: string;
}

function DonationsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const savedToken = localStorage.getItem("token") || localStorage.getItem("redhope_token");
    if (!savedToken) {
      setLoading(false);
      return;
    }
    setToken(savedToken);
    fetchDonations(savedToken, 1);
  }, []);

  const fetchDonations = async (authToken: string, page: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/donations/me?page=${page}&limit=10`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (res.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("redhope_token");
        setToken(null);
        setDonations([]);
        return;
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || "Failed to load donation history.");
        setDonations([]);
        return;
      }

      setDonations(json.data.donations || []);
      setTotalPages(json.data.pagination?.totalPages || 1);
      setTotalCount(json.data.pagination?.total || 0);
    } catch (err) {
      console.error("Error fetching donation history:", err);
      setError("Could not connect to server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    if (token) {
      fetchDonations(token, newPage);
    }
  };

  const completedCount = donations.filter((d) => d.status === "completed").length;
  const totalCompletedUnits = donations
    .filter((d) => d.status === "completed")
    .reduce((acc, curr) => acc + (curr.units || 1), 0);

  const getStatusBadge = (status: DonationRecord["status"]) => {
    switch (status) {
      case "completed":
        return {
          bg: "rgba(40, 167, 69, 0.15)",
          color: "#28a745",
          label: "Completed",
          icon: "fa-circle-check",
        };
      case "scheduled":
        return {
          bg: "rgba(0, 123, 255, 0.15)",
          color: "#007bff",
          label: "Scheduled",
          icon: "fa-calendar-clock",
        };
      case "no_show":
        return {
          bg: "rgba(108, 117, 125, 0.15)",
          color: "#6c757d",
          label: "No-Show",
          icon: "fa-user-xmark",
        };
      case "cancelled":
        return {
          bg: "rgba(220, 53, 69, 0.15)",
          color: "#dc3545",
          label: "Cancelled",
          icon: "fa-ban",
        };
      default:
        return {
          bg: "rgba(108, 117, 125, 0.1)",
          color: "#6c757d",
          label: status,
          icon: "fa-clock",
        };
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <>
      <Navbar solid />

      <main style={{ backgroundColor: "#f8f9fa", minHeight: "85vh", padding: "40px 16px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          {/* Header */}
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
              <h1 style={{ margin: 0, fontSize: "2rem", color: "var(--secondary)" }}>
                <i className="fas fa-hand-holding-droplet" style={{ color: "var(--primary)", marginRight: 10 }} />
                My Donation History
              </h1>
              <p style={{ margin: "6px 0 0", color: "var(--gray)", fontSize: 15 }}>
                Track your blood donation journey, units contributed, and verified camp visits.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <Link to="/eligibility" className="btn btn-outline" style={{ padding: "8px 16px", fontSize: 13 }}>
                <i className="fas fa-heart-pulse" style={{ marginRight: 6 }} /> Check Eligibility
              </Link>
              <Link to="/camps" className="btn" style={{ padding: "8px 16px", fontSize: 13 }}>
                <i className="fas fa-tent" style={{ marginRight: 6 }} /> Find Camps
              </Link>
            </div>
          </div>

          {/* Unauthenticated State */}
          {!token && !loading && (
            <div
              style={{
                backgroundColor: "#fff",
                borderRadius: 12,
                padding: "60px 24px",
                textAlign: "center",
                boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
              }}
            >
              <i className="fas fa-lock fa-3x" style={{ color: "var(--primary)", marginBottom: 16 }} />
              <h3 style={{ color: "var(--secondary)", margin: 0 }}>Login Required</h3>
              <p style={{ color: "var(--gray)", maxWidth: 450, margin: "10px auto 24px", fontSize: 15 }}>
                Please log in to view your verified donation records and camp contributions.
              </p>
              <Link to="/donate" className="btn" style={{ padding: "10px 28px" }}>
                Log In / Register
              </Link>
            </div>
          )}

          {/* Authenticated State */}
          {token && (
            <>
              {/* Summary Metrics Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: 10,
                    padding: "20px 24px",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                    borderLeft: "4px solid var(--primary)",
                  }}
                >
                  <div style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, color: "var(--gray)" }}>
                    Total Records
                  </div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--secondary)", marginTop: 4 }}>
                    {totalCount}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: 10,
                    padding: "20px 24px",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                    borderLeft: "4px solid #28a745",
                  }}
                >
                  <div style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, color: "var(--gray)" }}>
                    Completed Donations
                  </div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#28a745", marginTop: 4 }}>
                    {completedCount}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "#fff",
                    borderRadius: 10,
                    padding: "20px 24px",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                    borderLeft: "4px solid #17a2b8",
                  }}
                >
                  <div style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, color: "var(--gray)" }}>
                    Total Units Given
                  </div>
                  <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#17a2b8", marginTop: 4 }}>
                    {totalCompletedUnits} {totalCompletedUnits === 1 ? "unit" : "units"}
                  </div>
                </div>
              </div>

              {/* Main Content Area */}
              <div
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  padding: "24px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                }}
              >
                {loading ? (
                  <div style={{ textAlign: "center", padding: "60px 0" }}>
                    <i className="fas fa-spinner fa-spin fa-2x" style={{ color: "var(--primary)" }} />
                    <p style={{ marginTop: 12, color: "var(--gray)" }}>Loading donation history...</p>
                  </div>
                ) : error ? (
                  <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <i className="fas fa-triangle-exclamation fa-2x" style={{ color: "var(--primary)", marginBottom: 10 }} />
                    <p style={{ color: "var(--gray)" }}>{error}</p>
                    <button
                      type="button"
                      onClick={() => fetchDonations(token, currentPage)}
                      className="btn"
                      style={{ marginTop: 10 }}
                    >
                      Retry
                    </button>
                  </div>
                ) : donations.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 20px" }}>
                    <i className="fas fa-droplet-slash fa-3x" style={{ color: "var(--gray)", marginBottom: 16 }} />
                    <h3 style={{ color: "var(--secondary)", margin: 0 }}>No Donations Recorded Yet</h3>
                    <p style={{ color: "var(--gray)", maxWidth: 440, margin: "10px auto 24px", fontSize: 14 }}>
                      You haven't completed any blood donations through REDhope camps yet. Register for an upcoming camp
                      to contribute and save lives!
                    </p>
                    <Link to="/camps" className="btn" style={{ padding: "10px 24px" }}>
                      Discover Camps Near You
                    </Link>
                  </div>
                ) : (
                  <div>
                    {/* Table View */}
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, textAlign: "left" }}>
                        <thead>
                          <tr style={{ borderBottom: "2px solid var(--light-gray)", color: "var(--secondary)" }}>
                            <th style={{ padding: "12px 14px" }}>Camp</th>
                            <th style={{ padding: "12px 14px" }}>Donation Date</th>
                            <th style={{ padding: "12px 14px" }}>Blood Group</th>
                            <th style={{ padding: "12px 14px" }}>Units</th>
                            <th style={{ padding: "12px 14px" }}>Status</th>
                            <th style={{ padding: "12px 14px" }}>Verified At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {donations.map((d) => {
                            const badge = getStatusBadge(d.status);
                            return (
                              <tr
                                key={d._id}
                                style={{
                                  borderBottom: "1px solid var(--light-gray)",
                                  backgroundColor: d.status === "completed" ? "rgba(40, 167, 69, 0.02)" : "transparent",
                                }}
                              >
                                <td style={{ padding: "14px", fontWeight: 600, color: "var(--secondary)" }}>
                                  <div>
                                    {d.camp?.name || "Blood Donation Camp"}
                                  </div>
                                  {d.camp?.location?.city && (
                                    <div style={{ fontSize: 12, color: "var(--gray)", fontWeight: 400, marginTop: 2 }}>
                                      <i className="fas fa-location-dot" style={{ marginRight: 4 }} />
                                      {d.camp.location.city}, {d.camp.location.state || ""}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: "14px", color: "var(--secondary)" }}>
                                  {formatDate(d.donationDate)}
                                </td>
                                <td style={{ padding: "14px" }}>
                                  <span
                                    style={{
                                      fontWeight: 700,
                                      color: "var(--primary)",
                                      backgroundColor: "rgba(227, 6, 19, 0.08)",
                                      padding: "3px 8px",
                                      borderRadius: 4,
                                      fontSize: 13,
                                    }}
                                  >
                                    {d.bloodGroup}
                                  </span>
                                </td>
                                <td style={{ padding: "14px", fontWeight: 600 }}>
                                  {d.units} {d.units === 1 ? "unit" : "units"}
                                </td>
                                <td style={{ padding: "14px" }}>
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 6,
                                      fontSize: 11,
                                      fontWeight: 700,
                                      textTransform: "uppercase",
                                      padding: "4px 8px",
                                      borderRadius: 4,
                                      backgroundColor: badge.bg,
                                      color: badge.color,
                                    }}
                                  >
                                    <i className={`fas ${badge.icon}`} style={{ fontSize: 11 }} />
                                    {badge.label}
                                  </span>
                                </td>
                                <td style={{ padding: "14px", color: "var(--gray)", fontSize: 13 }}>
                                  {formatDate(d.verifiedAt)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: 20,
                          paddingTop: 16,
                          borderTop: "1px solid var(--light-gray)",
                        }}
                      >
                        <span style={{ fontSize: 13, color: "var(--gray)" }}>
                          Page {currentPage} of {totalPages} ({totalCount} total)
                        </span>

                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage <= 1}
                            className="btn btn-outline"
                            style={{ padding: "6px 14px", fontSize: 12 }}
                          >
                            Previous
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage >= totalPages}
                            className="btn btn-outline"
                            style={{ padding: "6px 14px", fontSize: 12 }}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}

