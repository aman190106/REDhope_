import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "../../../components/Navbar";
import { Footer } from "../../../components/Footer";
import { toast } from "../../../components/AppToaster";
import { useAuth } from "../../../lib/auth";
import { api } from "../../../lib/api";

export const Route = createFileRoute("/admin/health-screenings/")({
  head: () => ({
    meta: [
      { title: "Medical Screening Reviews — REDhope Admin" },
      {
        name: "description",
        content: "Clinical review console for evaluating donor health questionnaires and medical records.",
      },
      { property: "og:title", content: "Medical Screening Reviews — REDhope Admin" },
    ],
  }),
  component: AdminHealthScreeningsPage,
});

interface DonorSummary {
  _id: string;
  name: string;
  email: string;
  phone: string;
  bloodGroup: string;
  dateOfBirth?: string;
  gender?: string;
}

interface ScreeningSummaryItem {
  _id: string;
  user: DonorSummary;
  status: "draft" | "submitted" | "under_review" | "needs_information" | "approved" | "temporarily_deferred" | "permanently_deferred" | "rejected";
  preliminaryFlags: any[];
  reviewerDecision?: {
    decision: string;
    reason?: string;
    reviewedAt?: string;
  };
  submittedAt?: string;
  createdAt: string;
}

function AdminHealthScreeningsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [screenings, setScreenings] = useState<ScreeningSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated || user?.role !== "admin") {
        toast.error("Unauthorized: Admin or Medical Reviewer access required.");
        navigate({ to: "/login" });
        return;
      }
      loadScreenings();
    }
  }, [authLoading, isAuthenticated, user, statusFilter, page]);

  const loadScreenings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (searchQuery) params.set("search", searchQuery);
      params.set("page", String(page));
      params.set("limit", "15");

      const res = await api.get<{
        success: boolean;
        data: {
          screenings: ScreeningSummaryItem[];
          pagination: { page: number; limit: number; total: number; pages: number };
        };
      }>(`/admin/health-screenings?${params.toString()}`);

      if (res?.success && res.data) {
        setScreenings(res.data.screenings);
        setTotalPages(res.data.pagination.pages);
        setTotalCount(res.data.pagination.total);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load health screenings.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadScreenings();
  };

  return (
    <>
      <Navbar solid />

      <section className="hero hero-compact" style={{ minHeight: "30vh", padding: "60px 0 30px" }}>
        <div className="hero-inner">
          <h1>Medical Review Console</h1>
          <p>Evaluate submitted donor health questionnaires, lab reports, and finalize clinical clearance decisions.</p>
        </div>
      </section>

      <section className="features" style={{ padding: "30px 0 80px" }}>
        <div className="container" style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* Header Controls */}
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
            {/* Status Filter Tabs */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { label: "All", val: "" },
                { label: "Submitted", val: "submitted" },
                { label: "Needs Info", val: "needs_information" },
                { label: "Approved", val: "approved" },
                { label: "Deferred", val: "temporarily_deferred" },
                { label: "Perm. Deferred", val: "permanently_deferred" },
              ].map((tab) => (
                <button
                  key={tab.val}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.val);
                    setPage(1);
                  }}
                  className={`btn ${statusFilter === tab.val ? "" : "btn-outline"}`}
                  style={{ padding: "6px 14px", fontSize: 13 }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Form */}
            <form onSubmit={handleSearch} style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="Search donor name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #cbd5e1",
                  fontSize: 14,
                  minWidth: 260,
                }}
              />
              <button type="submit" className="btn" style={{ padding: "8px 16px", fontSize: 13 }}>
                <i className="fas fa-search" />
              </button>
            </form>
          </div>

          {/* Screenings Table */}
          <div className="form-section" style={{ padding: 0, overflow: "hidden" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "var(--primary)" }}>
                <i className="fas fa-spinner fa-spin fa-3x" />
                <p style={{ marginTop: 12, color: "var(--gray)" }}>Loading screening submissions...</p>
              </div>
            ) : screenings.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <i className="fas fa-clipboard-check fa-3x" style={{ color: "#94a3b8", marginBottom: 12 }} />
                <h3>No Screenings Found</h3>
                <p style={{ color: "var(--gray)", fontSize: 14 }}>
                  No donor health screenings match the current filter criteria.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", color: "#475569" }}>
                      <th style={{ padding: "14px 18px" }}>Donor</th>
                      <th style={{ padding: "14px 18px" }}>Blood Group</th>
                      <th style={{ padding: "14px 18px" }}>Submitted Date</th>
                      <th style={{ padding: "14px 18px" }}>Clinical Flags</th>
                      <th style={{ padding: "14px 18px" }}>Review Status</th>
                      <th style={{ padding: "14px 18px", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {screenings.map((sc) => (
                      <tr key={sc._id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ fontWeight: 600, color: "var(--secondary)" }}>
                            {sc.user?.name || "Anonymous Donor"}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--gray)" }}>{sc.user?.email}</div>
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <span
                            style={{
                              background: "rgba(230, 57, 70, 0.1)",
                              color: "var(--primary)",
                              padding: "4px 10px",
                              borderRadius: 12,
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            {sc.user?.bloodGroup || "—"}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px", color: "#64748b" }}>
                          {sc.submittedAt
                            ? new Date(sc.submittedAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : new Date(sc.createdAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          {sc.preliminaryFlags && sc.preliminaryFlags.length > 0 ? (
                            <span
                              style={{
                                background: "#fef3c7",
                                color: "#92400e",
                                padding: "4px 10px",
                                borderRadius: 12,
                                fontWeight: 700,
                                fontSize: 12,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <i className="fas fa-flag" /> {sc.preliminaryFlags.length} flag(s)
                            </span>
                          ) : (
                            <span style={{ color: "var(--success)", fontSize: 12, fontWeight: 600 }}>
                              <i className="fas fa-check" /> Standard
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <TableStatusBadge status={sc.status} />
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right" }}>
                          <Link
                            to="/admin/health-screenings/$screeningId"
                            params={{ screeningId: sc._id }}
                            className="btn btn-outline"
                            style={{ padding: "6px 14px", fontSize: 13 }}
                          >
                            <i className="fas fa-stethoscope" style={{ marginRight: 6 }} /> Review
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
              <div style={{ fontSize: 13, color: "var(--gray)" }}>
                Showing page {page} of {totalPages} ({totalCount} total submissions)
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="btn btn-outline"
                  style={{ padding: "6px 12px", fontSize: 13 }}
                >
                  &larr; Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="btn btn-outline"
                  style={{ padding: "6px 12px", fontSize: 13 }}
                >
                  Next &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}

function TableStatusBadge({ status }: { status: string }) {
  let bg = "#e2e8f0";
  let color = "#475569";

  if (status === "approved") {
    bg = "#dcfce7";
    color = "#166534";
  } else if (status === "submitted" || status === "under_review") {
    bg = "#dbeafe";
    color = "#1e40af";
  } else if (status === "temporarily_deferred") {
    bg = "#fef3c7";
    color = "#92400e";
  } else if (status === "permanently_deferred" || status === "rejected") {
    bg = "#fee2e2";
    color = "#991b1b";
  }

  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 12,
        background: bg,
        color: color,
        fontWeight: 700,
        fontSize: 12,
        textTransform: "uppercase",
      }}
    >
      {status.replace("_", " ")}
    </span>
  );
}

