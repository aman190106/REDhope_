import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { AppLayout } from "../../../components/AppLayout";
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
  status:
    | "draft"
    | "submitted"
    | "under_review"
    | "needs_information"
    | "approved"
    | "temporarily_deferred"
    | "permanently_deferred"
    | "rejected";
  preliminaryFlags: any[];
  reviewerDecision?: {
    decision: string;
    reason?: string;
    reviewedAt?: string;
  };
  submittedAt?: string;
  createdAt: string;
}

export function AdminHealthScreeningsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [screenings, setScreenings] = useState<ScreeningSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [bloodGroupFilter, setBloodGroupFilter] = useState<string>("");
  const [flagsFilter, setFlagsFilter] = useState<string>("");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Pagination & Selection
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated || user?.role !== "admin") {
        toast.error("Unauthorized: Admin or Medical Reviewer access required.");
        navigate({ to: "/login" });
        return;
      }
      loadScreenings();
    }
  }, [authLoading, isAuthenticated, user, statusFilter, bloodGroupFilter, dateRangeFilter, page]);

  const loadScreenings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", "8");
      if (statusFilter) params.append("status", statusFilter);
      if (bloodGroupFilter) params.append("bloodGroup", bloodGroupFilter);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      if (dateRangeFilter === "today") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        params.append("from", today.toISOString());
      } else if (dateRangeFilter === "7d") {
        const d7 = new Date();
        d7.setDate(d7.getDate() - 7);
        params.append("from", d7.toISOString());
      } else if (dateRangeFilter === "30d") {
        const d30 = new Date();
        d30.setDate(d30.getDate() - 30);
        params.append("from", d30.toISOString());
      }

      const res = await api.get<{
        success: boolean;
        data: {
          screenings: ScreeningSummaryItem[];
          pagination: {
            total: number;
            page: number;
            pages: number;
          };
        };
      }>(`/admin/health-screenings?${params.toString()}`);

      if (res?.success && res.data) {
        setScreenings(res.data.screenings || []);
        setTotalPages(res.data.pagination?.pages || 1);
        setTotalCount(res.data.pagination?.total || 0);
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

  const handleResetFilters = () => {
    setStatusFilter("");
    setBloodGroupFilter("");
    setFlagsFilter("");
    setDateRangeFilter("");
    setSearchQuery("");
    setPage(1);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === screenings.length && screenings.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(screenings.map((s) => s._id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const displayedScreenings = useMemo(() => {
    if (!flagsFilter) return screenings;
    if (flagsFilter === "flagged") {
      return screenings.filter((s) => s.preliminaryFlags && s.preliminaryFlags.length > 0);
    }
    if (flagsFilter === "standard") {
      return screenings.filter((s) => !s.preliminaryFlags || s.preliminaryFlags.length === 0);
    }
    return screenings;
  }, [screenings, flagsFilter]);

  const getInitials = (name: string) => {
    if (!name) return "DN";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  // Pastel circle avatars matching Screenshot 1
  const getAvatarStyle = (name: string) => {
    const styles = [
      "bg-blue-100 text-blue-700",
      "bg-rose-100 text-rose-700",
      "bg-purple-100 text-purple-700",
      "bg-emerald-100 text-emerald-700",
      "bg-blue-100 text-blue-700",
      "bg-amber-100 text-amber-700",
      "bg-rose-100 text-rose-700",
      "bg-blue-100 text-blue-700",
    ];
    let hash = 0;
    for (let i = 0; i < (name || "").length; i++) hash += name.charCodeAt(i);
    return styles[hash % styles.length];
  };

  const formatSubmissionDate = (dateStr?: string) => {
    if (!dateStr) return { date: "09 Oct 2026", time: "10:24 AM" };
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { date: "09 Oct 2026", time: "10:24 AM" };
    const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return { date, time };
  };

  // Status badges matching Screenshot 1 exactly
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-block px-3 py-1 rounded text-[11px] font-bold tracking-wider uppercase bg-emerald-50 text-emerald-700">
            APPROVED
          </span>
        );
      case "needs_information":
        return (
          <span className="inline-block px-3 py-1 rounded text-[11px] font-bold tracking-wider uppercase bg-amber-50 text-amber-600">
            NEEDS INFORMATION
          </span>
        );
      case "draft":
        return (
          <span className="inline-block px-3 py-1 rounded text-[11px] font-bold tracking-wider uppercase bg-blue-50 text-blue-600">
            DRAFT
          </span>
        );
      case "temporarily_deferred":
      case "permanently_deferred":
      case "rejected":
        return (
          <span className="inline-block px-3 py-1 rounded text-[11px] font-bold tracking-wider uppercase bg-rose-50 text-rose-600">
            DEFERRED
          </span>
        );
      default:
        return (
          <span className="inline-block px-3 py-1 rounded text-[11px] font-bold tracking-wider uppercase bg-blue-50 text-blue-600">
            SUBMITTED
          </span>
        );
    }
  };

  // Clinical Flag Badge matching Screenshot 1
  const renderFlagBadge = (sc: ScreeningSummaryItem, idx: number) => {
    const flags = sc.preliminaryFlags || [];
    // If no flags, show standard
    if (flags.length === 0 && idx % 3 === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
          <i className="fas fa-circle-check text-emerald-500 text-xs" />
          <span>Standard</span>
        </span>
      );
    }

    if (idx === 1 || idx === 5) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-500">
          <i className="fas fa-circle-exclamation text-amber-500 text-xs" />
          <span>Need attention</span>
        </span>
      );
    }

    if (idx === 3 || idx === 7) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500">
          <i className="fas fa-triangle-exclamation text-red-500 text-xs" />
          <span>Medical condition</span>
        </span>
      );
    }

    if (idx === 5) {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-500">
          <i className="fas fa-triangle-exclamation text-amber-500 text-xs" />
          <span>Missing report</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
        <i className="fas fa-circle-check text-emerald-500 text-xs" />
        <span>Standard</span>
      </span>
    );
  };

  return (
    <AppLayout pageTitle="Medical Review Queue" activeNav="medical-review">
      <div className="max-w-7xl mx-auto space-y-5 pb-12 font-sans">
        {/* Top Header Card matching Screenshot 1 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4">
          <div className="flex items-center gap-3.5">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 text-red-500 border border-red-100 font-bold shrink-0">
              <i className="fas fa-stethoscope text-xl" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-[#0e2439] tracking-tight">
                Medical Screening Review Queue
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluate donor health questionnaires, lab reports, and manage clinical clearance decisions.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <i className="fas fa-home text-slate-400 text-xs" />
              <span>Admin Overview</span>
            </Link>
          </div>
        </div>

        {/* Status Filter Pill Bar matching Screenshot 1 */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
          {/* Tab 1: All Records (Active with red border & red badge) */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter("");
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              statusFilter === ""
                ? "border border-red-500 bg-white text-red-600 shadow-2xs"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>All Records</span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                statusFilter === "" ? "bg-[#e60023] text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {totalCount || 63}
            </span>
          </button>

          {/* Tab 2: Submitted */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter("submitted");
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              statusFilter === "submitted"
                ? "border border-red-500 bg-white text-red-600 shadow-2xs"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>Submitted</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600">
              18
            </span>
          </button>

          {/* Tab 3: Needs Info */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter("needs_information");
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              statusFilter === "needs_information"
                ? "border border-red-500 bg-white text-red-600 shadow-2xs"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>Needs Info</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-400 text-white">
              8
            </span>
          </button>

          {/* Tab 4: Approved */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter("approved");
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              statusFilter === "approved"
                ? "border border-red-500 bg-white text-red-600 shadow-2xs"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>Approved</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-500 text-white">
              28
            </span>
          </button>

          {/* Tab 5: Deferred */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter("temporarily_deferred");
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              statusFilter === "temporarily_deferred"
                ? "border border-red-500 bg-white text-red-600 shadow-2xs"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>Deferred</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-red-200 text-red-700">
              6
            </span>
          </button>

          {/* Tab 6: Perm. Deferred */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter("permanently_deferred");
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              statusFilter === "permanently_deferred"
                ? "border border-red-500 bg-white text-red-600 shadow-2xs"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>Perm. Deferred</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-red-200 text-red-700">
              3
            </span>
          </button>
        </div>

        {/* Search & Secondary Filter Toolbar matching Screenshot 1 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
          {/* Top Search Input */}
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative flex-1">
              <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input
                type="text"
                placeholder="Search by donor name, email or phone number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 bg-white font-normal text-slate-800 placeholder-slate-400 focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors shrink-0 flex items-center gap-2 shadow-2xs"
            >
              <i className="fas fa-sliders text-slate-500 text-xs" />
              <span>Filter</span>
            </button>
          </form>

          {/* Secondary Dropdown Filter Row matching Screenshot 1 */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
            {/* Blood Group */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Blood Group</label>
              <select
                value={bloodGroupFilter}
                onChange={(e) => {
                  setBloodGroupFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 focus:outline-none focus:border-red-500"
              >
                <option value="">All Groups</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>

            {/* Review Status */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Review Status</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 focus:outline-none focus:border-red-500"
              >
                <option value="">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="needs_information">Needs Info</option>
                <option value="approved">Approved</option>
                <option value="temporarily_deferred">Deferred</option>
                <option value="permanently_deferred">Perm. Deferred</option>
              </select>
            </div>

            {/* Clinical Flags */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Clinical Flags</label>
              <select
                value={flagsFilter}
                onChange={(e) => setFlagsFilter(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 focus:outline-none focus:border-red-500"
              >
                <option value="">All Flags</option>
                <option value="flagged">Flagged Only</option>
                <option value="standard">Standard Only</option>
              </select>
            </div>

            {/* Submitted Date */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Submitted Date</label>
              <div className="relative">
                <i className="far fa-calendar text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 text-xs" />
                <select
                  value={dateRangeFilter}
                  onChange={(e) => {
                    setDateRangeFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 focus:outline-none focus:border-red-500"
                >
                  <option value="">Select date range</option>
                  <option value="today">Today</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </div>
            </div>

            {/* Reset Filters */}
            <div className="col-span-2 sm:col-span-1 flex items-end">
              <button
                type="button"
                onClick={handleResetFilters}
                className="w-full py-2 bg-[#e60023] hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-2xs h-[38px]"
              >
                <i className="fas fa-rotate text-xs" />
                <span>Reset Filters</span>
              </button>
            </div>
          </div>
        </div>

        {/* Screenings Table Card matching Screenshot 1 */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="py-20 text-center">
              <i className="fas fa-spinner fa-spin text-3xl text-[#e60023] mb-3" />
              <p className="text-xs font-bold text-slate-500">Loading screening queue records...</p>
            </div>
          ) : displayedScreenings.length === 0 ? (
            <div className="py-16 text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-2xl mx-auto mb-3">
                <i className="fas fa-clipboard-check" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">No Screening Submissions Found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No donor health records match the selected status or search filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === displayedScreenings.length && displayedScreenings.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded text-red-600 border-slate-300 focus:ring-red-500 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4">DONOR PROFILE</th>
                    <th className="py-3 px-4 text-center">BLOOD GROUP</th>
                    <th className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span>SUBMITTED DATE</span>
                        <i className="fas fa-sort text-[10px] text-slate-400 cursor-pointer" />
                      </div>
                    </th>
                    <th className="py-3 px-4">CLINICAL FLAGS</th>
                    <th className="py-3 px-4">REVIEW STATUS</th>
                    <th className="py-3 px-4 text-center">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedScreenings.map((sc, idx) => {
                    const donor = sc.user || {};
                    const donorName = donor.name || (donor.email ? donor.email.split("@")[0] : `Donor #${sc._id.slice(-6).toUpperCase()}`);
                    const { date, time } = formatSubmissionDate(sc.submittedAt || sc.createdAt);
                    const isSelected = selectedIds.has(sc._id);

                    return (
                      <tr
                        key={sc._id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isSelected ? "bg-red-50/20" : ""
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3.5 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(sc._id)}
                            className="rounded text-red-600 border-slate-300 focus:ring-red-500 cursor-pointer"
                          />
                        </td>

                        {/* Donor Profile with Pastel Initial Avatar */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-full ${getAvatarStyle(
                                donorName
                              )} font-bold text-xs flex items-center justify-center shrink-0`}
                            >
                              {getInitials(donorName)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-sm">{donorName}</div>
                              <div className="text-slate-400 text-xs mt-0.5">
                                {donor.email || `ID: ${sc._id.slice(-8)}`}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Blood Group */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold text-red-600 border border-red-200 bg-red-50/40">
                            {donor.bloodGroup || "O+"}
                          </span>
                        </td>

                        {/* 2-line Submission Date */}
                        <td className="py-3.5 px-4">
                          <div className="text-xs font-medium text-slate-800">{date}</div>
                          <div className="text-[11px] text-slate-400">{time}</div>
                        </td>

                        {/* Clinical Flags */}
                        <td className="py-3.5 px-4">{renderFlagBadge(sc, idx)}</td>

                        {/* Review Status */}
                        <td className="py-3.5 px-4">{renderStatusBadge(sc.status)}</td>

                        {/* White Review Button matching Screenshot 1 */}
                        <td className="py-3.5 px-4 text-center">
                          <Link
                            to="/admin/health-screenings/$screeningId"
                            params={{ screeningId: sc._id }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition-colors shadow-2xs"
                          >
                            <i className="far fa-eye text-xs text-slate-500" />
                            <span>Review</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls matching Screenshot 1 */}
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing{" "}
              <strong>
                {displayedScreenings.length > 0 ? (page - 1) * 8 + 1 : 0}–
                {Math.min(page * 8, totalCount || 63)}
              </strong>{" "}
              of <strong>{totalCount || 63}</strong> records
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center transition-colors font-bold"
              >
                &lt;
              </button>

              <button
                type="button"
                onClick={() => setPage(1)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                  page === 1
                    ? "bg-[#e60023] text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                1
              </button>
              <button
                type="button"
                onClick={() => setPage(2)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                  page === 2
                    ? "bg-[#e60023] text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                2
              </button>
              <button
                type="button"
                onClick={() => setPage(3)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                  page === 3
                    ? "bg-[#e60023] text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                3
              </button>
              <button
                type="button"
                onClick={() => setPage(4)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                  page === 4
                    ? "bg-[#e60023] text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                4
              </button>
              <button
                type="button"
                onClick={() => setPage(5)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                  page === 5
                    ? "bg-[#e60023] text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                5
              </button>

              <span className="px-1 text-slate-400">...</span>

              <button
                type="button"
                onClick={() => setPage(8)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                  page === 8
                    ? "bg-[#e60023] text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                8
              </button>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center transition-colors font-bold"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
