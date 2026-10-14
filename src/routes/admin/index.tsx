import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "../../components/AppLayout";
import { useAuth } from "../../lib/auth";
import { api, API_BASE_URL } from "../../lib/api";
import { toast } from "../../components/AppToaster";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from "recharts";

interface AdminSearchParams {
  tab?: "overview" | "donors" | "queue";
}

export const Route = createFileRoute("/admin/")({
  validateSearch: (search: Record<string, unknown>): AdminSearchParams => {
    const validTabs: ("overview" | "donors" | "queue")[] = ["overview", "donors", "queue"];
    const tabParam = search.tab as "overview" | "donors" | "queue";
    return {
      tab: validTabs.includes(tabParam) ? tabParam : "overview",
    };
  },
  head: () => ({
    meta: [
      { title: "Admin Command Center & Donor Management — REDhope" },
      {
        name: "description",
        content: "Executive administration console: donor analytics, medical review queue, and eligibility governance.",
      },
      { property: "og:title", content: "Admin Command Center — REDhope" },
    ],
  }),
  component: AdminDashboardPage,
});

const API_BASE = API_BASE_URL;

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

interface DonorItem {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  bloodGroup: string;
  role: string;
  dateOfBirth?: string;
  age?: number | null;
  gender?: string;
  isEligible: boolean;
  isDonorAvailable: boolean;
  lastDonationDate?: string | null;
  createdAt: string;
  location?: {
    city?: string;
    state?: string;
    pincode?: string;
  };
  screening?: {
    _id: string;
    status: string;
    flagsCount: number;
    submittedAt?: string;
    reviewerDecision?: string | null;
  } | null;
}

interface ScreeningQueueItem {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    bloodGroup: string;
  };
  status: string;
  preliminaryFlags: any[];
  submittedAt?: string;
  createdAt: string;
}

function AdminDashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();

  // Navigation Tabs: overview | donors | queue (synced with URL search params)
  const [activeTab, setActiveTab] = useState<"overview" | "donors" | "queue">(search.tab || "overview");

  useEffect(() => {
    if (search.tab && search.tab !== activeTab) {
      setActiveTab(search.tab);
    }
  }, [search.tab]);

  const handleTabSelect = (tab: "overview" | "donors" | "queue") => {
    setActiveTab(tab);
    navigate({ search: { tab } });
  };

  // Analytics State
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");

  // Donor Management State
  const [donors, setDonors] = useState<DonorItem[]>([]);
  const [donorsLoading, setDonorsLoading] = useState(false);
  const [donorSearch, setDonorSearch] = useState("");
  const [donorRole, setDonorRole] = useState("all");
  const [donorBloodGroup, setDonorBloodGroup] = useState("all");
  const [donorEligibility, setDonorEligibility] = useState("all");
  const [donorScreeningStatus, setDonorScreeningStatus] = useState("all");
  const [donorSortBy, setDonorSortBy] = useState("createdAt");
  const [donorSortOrder, setDonorSortOrder] = useState<"asc" | "desc">("desc");
  const [donorPage, setDonorPage] = useState(1);
  const [donorTotalPages, setDonorTotalPages] = useState(1);
  const [donorTotalCount, setDonorTotalCount] = useState(0);

  // Review Queue State
  const [queueItems, setQueueItems] = useState<ScreeningQueueItem[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);

  // Quick View / Action Modal State
  const [selectedDonor, setSelectedDonor] = useState<DonorItem | null>(null);
  const [isUpdatingEligibility, setIsUpdatingEligibility] = useState(false);
  const [confirmReason, setConfirmReason] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    targetEligible: boolean;
  }>({ show: false, title: "", message: "", targetEligible: true });

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated || !user) {
        navigate({ to: "/login" });
        return;
      }
      if (user.role !== "admin") {
        toast.error("Unauthorized: Platform administrator access required.");
        navigate({ to: "/dashboard" });
        return;
      }

      loadAnalytics();
      loadReviewQueue();
    }
  }, [authLoading, isAuthenticated, user, dateRangeFilter]);

  useEffect(() => {
    if (isAuthenticated && user?.role === "admin") {
      loadDonors();
    }
  }, [
    isAuthenticated,
    user?.role,
    donorPage,
    donorRole,
    donorBloodGroup,
    donorEligibility,
    donorScreeningStatus,
    donorSortBy,
    donorSortOrder,
  ]);

  // Load Real Database Analytics
  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateRangeFilter === "30d") {
        const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        params.set("from", from);
      } else if (dateRangeFilter === "90d") {
        const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        params.set("from", from);
      } else if (dateRangeFilter === "year") {
        const from = new Date(new Date().getFullYear(), 0, 1).toISOString();
        params.set("from", from);
      }

      const res = await api.get<{
        success: boolean;
        data: any;
      }>(`/camps/analytics?${params.toString()}`);

      if (res?.success && res.data) {
        setAnalytics(res.data);
      }
    } catch (err: any) {
      console.warn("Analytics fetch error:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Load Searchable & Filterable Donors
  const loadDonors = async () => {
    setDonorsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(donorPage));
      params.set("limit", "12");
      if (donorSearch.trim()) params.set("search", donorSearch.trim());
      if (donorRole !== "all") params.set("role", donorRole);
      if (donorBloodGroup !== "all") params.set("bloodGroup", donorBloodGroup);
      if (donorEligibility !== "all") params.set("isEligible", donorEligibility);
      if (donorScreeningStatus !== "all") params.set("screeningStatus", donorScreeningStatus);
      params.set("sortBy", donorSortBy);
      params.set("sortOrder", donorSortOrder);

      const res = await api.get<{
        success: boolean;
        count: number;
        data?: {
          users: DonorItem[];
          pagination: { total: number; page: number; limit: number; pages: number };
        };
        users?: DonorItem[];
      }>(`/users?${params.toString()}`);

      if (res?.success) {
        const userList = res.data?.users || res.users || [];
        setDonors(userList);
        setDonorTotalCount(res.data?.pagination?.total ?? res.count ?? userList.length);
        setDonorTotalPages(res.data?.pagination?.pages ?? (Math.ceil((res.count || userList.length) / 12) || 1));
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load donor records.");
    } finally {
      setDonorsLoading(false);
    }
  };

  // Load Medical Review Queue
  const loadReviewQueue = async () => {
    setQueueLoading(true);
    try {
      const res = await api.get<{
        success: boolean;
        data: {
          screenings: ScreeningQueueItem[];
          pagination: { total: number };
        };
      }>("/admin/health-screenings?status=submitted,under_review,needs_information&limit=25");

      if (res?.success && res.data) {
        setQueueItems(res.data.screenings || []);
      }
    } catch (err: any) {
      console.warn("Queue fetch error:", err);
    } finally {
      setQueueLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDonorPage(1);
    loadDonors();
  };

  const handleToggleEligibility = async (targetUserId: string, newEligibleStatus: boolean) => {
    setIsUpdatingEligibility(true);
    try {
      const res = await api.put<{ success: boolean; user: any }>(`/users/${targetUserId}`, {
        isEligible: newEligibleStatus,
        note: confirmReason.trim() || undefined,
      });

      if (res?.success) {
        toast.success(`User eligibility updated to: ${newEligibleStatus ? "Eligible" : "Deferred"}`);
        setDonors((prev) =>
          prev.map((d) => (d._id === targetUserId ? { ...d, isEligible: newEligibleStatus } : d))
        );
        if (selectedDonor && selectedDonor._id === targetUserId) {
          setSelectedDonor({ ...selectedDonor, isEligible: newEligibleStatus });
        }
        setConfirmDialog({ show: false, title: "", message: "", targetEligible: true });
        setConfirmReason("");
        loadAnalytics(); // Refresh overview counts
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update donor eligibility.");
    } finally {
      setIsUpdatingEligibility(false);
    }
  };

  // Derived real metric numbers
  const uMetrics = analytics?.userMetrics;
  const cSummary = analytics?.summary;
  const bMetrics = analytics?.bloodRequestMetrics;

  const totalUsers = uMetrics?.totalUsers ?? uMetrics?.totalRegisteredUsers ?? 0;
  const totalDonors = uMetrics?.totalDonors ?? 0;
  const totalOrganizers = uMetrics?.totalOrganizers ?? 0;
  const totalRecipients = bMetrics?.totalRequests ?? uMetrics?.totalRecipients ?? 0;
  const eligibleDonors = uMetrics?.eligibleDonors ?? 0;
  const deferredDonors = uMetrics?.deferredDonors ?? 0;
  const pendingReviews = uMetrics?.pendingMedicalReviews ?? queueItems.length;
  const totalCamps = cSummary?.totalCamps ?? 0;
  const completedDonations = cSummary?.completedDonations ?? cSummary?.totalDonations ?? 0;

  // Chart datasets
  const registrationTrendData = uMetrics?.registrationTrend || [
    { period: "Recent", registrations: totalUsers },
  ];

  const bloodGroupData = (uMetrics?.usersByBloodGroup || []).map((bg: any) => ({
    bloodGroup: bg.bloodGroup,
    count: bg.count,
  }));

  const screeningDistributionData = (uMetrics?.screeningDistribution || []).filter(
    (item: any) => item.value > 0
  );

  const monthlyDonationData = (analytics?.donations?.monthlyTrend || cSummary?.monthlyTrend || []).map((item: any) => ({
    period: item.period || item.month || item._id || "Recent",
    donations: item.donations ?? item.count ?? item.units ?? 0,
  }));

  const getInitials = (name: string) => {
    if (!name) return "DN";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getAvatarStyle = (name: string) => {
    const styles = [
      "bg-blue-100 text-blue-700",
      "bg-rose-100 text-rose-700",
      "bg-purple-100 text-purple-700",
      "bg-emerald-100 text-emerald-700",
      "bg-cyan-100 text-cyan-700",
      "bg-amber-100 text-amber-700",
      "bg-indigo-100 text-indigo-700",
    ];
    let hash = 0;
    for (let i = 0; i < (name || "").length; i++) hash += name.charCodeAt(i);
    return styles[hash % styles.length];
  };

  const currentActiveNav = activeTab === "donors" ? "users" : activeTab === "queue" ? "medical-review" : "admin-dashboard";

  return (
    <AppLayout
      pageTitle={activeTab === "donors" ? "User & Donor Registry" : "Admin Command Center"}
      activeNav={currentActiveNav}
    >
      <div className="max-w-7xl mx-auto pb-12">
        {/* Header Title & Top Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200/80">
          <div className="flex items-center gap-3.5">
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-red-50 text-[#e60023] font-bold shrink-0 border border-red-100 shadow-2xs">
              <i className={activeTab === "donors" ? "fas fa-users text-xl" : "fas fa-shield-halved text-xl"} />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-[#0e2439] tracking-tight">
                {activeTab === "donors" ? "User & Donor Registry" : "Admin Command Center"}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeTab === "donors"
                  ? "Platform users, registered blood donors, account roles, and clinical eligibility management."
                  : "Platform governance, clinical medical reviews, and live donor health analytics."}
              </p>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2">
            <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Admin sections">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "overview"}
                onClick={() => handleTabSelect("overview")}
                className={`px-3.5 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  activeTab === "overview"
                    ? "bg-[#e60023] border-[#e60023] text-white shadow-sm"
                    : "bg-white border-slate-200 text-[#0e2439] hover:bg-slate-50"
                }`}
              >
                Overview &amp; Metrics
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "donors"}
                onClick={() => handleTabSelect("donors")}
                className={`px-3.5 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  activeTab === "donors"
                    ? "bg-[#e60023] border-[#e60023] text-white shadow-sm"
                    : "bg-white border-slate-200 text-[#0e2439] hover:bg-slate-50"
                }`}
              >
                <i className="fas fa-users mr-1.5" /> User &amp; Donor Registry
              </button>
              <Link
                to="/admin/health-screenings"
                className="px-3.5 py-2 text-xs font-bold rounded-lg bg-white border border-slate-200 text-[#0e2439] hover:bg-slate-50 transition-all"
              >
                <i className="fas fa-stethoscope mr-1.5" /> Review Queue
              </Link>
            </div>
            <button
              type="button"
              onClick={() => {
                if (activeTab === "donors") {
                  loadDonors();
                  toast.success("User registry refreshed from database");
                } else {
                  loadAnalytics();
                  loadReviewQueue();
                  toast.success("Live metrics refreshed from database");
                }
              }}
              className="px-3.5 py-2 text-xs font-bold rounded-lg bg-white border border-blue-200 text-[#0284c7] hover:bg-blue-50 transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
            >
              <i className="fas fa-rotate text-xs text-[#0284c7]" />
              <span>{activeTab === "donors" ? "Refresh Registry" : "Refresh Live Metrics"}</span>
            </button>
          </div>
        </div>

        {/* =========================================================================
            TAB 1: OVERVIEW & REAL DATABASE ANALYTICS
           ========================================================================= */}
        {activeTab === "overview" && (
          <div className="space-y-6 mt-6">
            {/* Filter Bar matching Image 2 */}
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
                <i className="fas fa-calendar-days text-slate-400" />
                <span className="text-slate-500">Analytics Period:</span>
                <select
                  value={dateRangeFilter}
                  onChange={(e) => setDateRangeFilter(e.target.value)}
                  className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer pr-1"
                >
                  <option value="all">All-Time Platform Data</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                  <option value="year">Current Year</option>
                </select>
              </div>
            </div>

            {/* TOP 9 REAL METRIC CARDS matching Image 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* 1. Total Registered Users */}
              <div className="relative overflow-hidden bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between min-h-[140px]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs">
                    <i className="fas fa-users" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Registered Users</span>
                </div>
                <div className="my-2">
                  <div className="text-3xl font-extrabold text-slate-900">{totalUsers.toLocaleString()}</div>
                  <div className="text-xs text-slate-500 mt-1">Platform-wide accounts</div>
                </div>
                <i className="fas fa-users absolute right-4 bottom-2 text-6xl text-slate-900/4 pointer-events-none" />
              </div>

              {/* 2. Registered Donors */}
              <div className="relative overflow-hidden bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between min-h-[140px]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center text-xs">
                    <i className="fas fa-heart" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Registered Donors</span>
                </div>
                <div className="my-2">
                  <div className="text-3xl font-extrabold text-slate-900">{totalDonors.toLocaleString()}</div>
                  <div className="text-xs text-emerald-600 font-semibold mt-1">
                    {totalUsers > 0 ? `${Math.round((totalDonors / totalUsers) * 100)}%` : "0%"} of active accounts
                  </div>
                </div>
                <i className="fas fa-heart absolute right-4 bottom-2 text-6xl text-red-900/4 pointer-events-none" />
              </div>

              {/* 3. Camp Organizers */}
              <div className="relative overflow-hidden bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between min-h-[140px]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-xs">
                    <i className="fas fa-building" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Camp Organizers</span>
                </div>
                <div className="my-2">
                  <div className="text-3xl font-extrabold text-slate-900">{totalOrganizers.toLocaleString()}</div>
                  <div className="text-xs text-slate-500 mt-1">Registered drive hosts</div>
                </div>
                <i className="fas fa-building absolute right-4 bottom-2 text-6xl text-slate-900/4 pointer-events-none" />
              </div>

              {/* 4. Blood Seekers / Requests */}
              <div className="relative overflow-hidden bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between min-h-[140px]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-xs">
                    <i className="fas fa-hand-holding-medical" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Blood Seekers / Requests</span>
                </div>
                <div className="my-2">
                  <div className="text-3xl font-extrabold text-slate-900">{totalRecipients.toLocaleString()}</div>
                  <div className="text-xs text-slate-500 mt-1">Recipients &amp; patient cases</div>
                </div>
                <i className="fas fa-hand-holding-medical absolute right-4 bottom-2 text-6xl text-slate-900/4 pointer-events-none" />
              </div>

              {/* 5. Donors Marked Eligible */}
              <div className="relative overflow-hidden bg-[#f0fdf4] p-5 rounded-2xl border border-[#bbf7d0] shadow-xs flex flex-col justify-between min-h-[140px]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">
                    <i className="fas fa-check-circle" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">Donors Marked Eligible</span>
                </div>
                <div className="my-2">
                  <div className="text-3xl font-extrabold text-emerald-950">{eligibleDonors.toLocaleString()}</div>
                  <div className="text-xs text-emerald-700 font-semibold mt-1">Medically cleared to donate</div>
                </div>
                <i className="fas fa-check-circle absolute right-4 bottom-2 text-6xl text-emerald-900/5 pointer-events-none" />
              </div>

              {/* 6. Deferred / Ineligible */}
              <div className="relative overflow-hidden bg-[#fffbeb] p-5 rounded-2xl border border-[#fde68a] shadow-xs flex flex-col justify-between min-h-[140px]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs">
                    <i className="fas fa-ban" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">Deferred / Ineligible</span>
                </div>
                <div className="my-2">
                  <div className="text-3xl font-extrabold text-amber-950">{deferredDonors.toLocaleString()}</div>
                  <div className="text-xs text-amber-700 font-semibold mt-1">Clinical hold or cooldown</div>
                </div>
                <i className="fas fa-ban absolute right-4 bottom-2 text-6xl text-amber-900/5 pointer-events-none" />
              </div>

              {/* 7. Pending Medical Reviews */}
              <div className="relative overflow-hidden bg-[#eff6ff] p-5 rounded-2xl border border-[#bfdbfe] shadow-xs flex flex-col justify-between min-h-[140px]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs">
                    <i className="fas fa-file-lines" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900">Pending Medical Reviews</span>
                </div>
                <div className="my-2">
                  <div className="text-3xl font-extrabold text-blue-950">{pendingReviews.toLocaleString()}</div>
                  <div className="text-xs text-blue-700 font-semibold mt-1">Awaiting clinical decision</div>
                </div>
                <i className="fas fa-file-lines absolute right-4 bottom-2 text-6xl text-blue-900/5 pointer-events-none" />
              </div>

              {/* 8. Total Camps */}
              <div className="relative overflow-hidden bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between min-h-[140px]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-xs">
                    <i className="fas fa-calendar-check" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Donation Camps</span>
                </div>
                <div className="my-2">
                  <div className="text-3xl font-extrabold text-slate-900">{totalCamps.toLocaleString()}</div>
                  <div className="text-xs text-slate-500 mt-1">Organized donation drives</div>
                </div>
                <i className="fas fa-calendar-check absolute right-4 bottom-2 text-6xl text-slate-900/4 pointer-events-none" />
              </div>

              {/* 9. Completed Donations */}
              <div className="relative overflow-hidden bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between min-h-[140px]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center text-xs">
                    <i className="fas fa-droplet" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Completed Donations</span>
                </div>
                <div className="my-2">
                  <div className="text-3xl font-extrabold text-slate-900">{completedDonations.toLocaleString()}</div>
                  <div className="text-xs text-slate-500 mt-1">Verified units collected</div>
                </div>
                <i className="fas fa-droplet absolute right-4 bottom-2 text-6xl text-red-900/4 pointer-events-none" />
              </div>
            </div>

            {/* CHARTS GRID (2 Columns x 2 Rows) matching Image 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
              {/* CHART 1: User Registrations Over Time */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs min-w-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-chart-column text-blue-600 text-sm" />
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">User Registrations Over Time</h3>
                      <p className="text-xs text-slate-500">Monthly new account signups recorded in database</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 text-xs font-bold bg-slate-100 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1.5">
                    <span>Live Aggregated</span>
                    <i className="fas fa-chevron-down text-[10px] text-slate-400" />
                  </span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={registrationTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="regGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#e63946" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#e63946" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#64748b" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="registrations"
                        name="New Signups"
                        stroke="#e63946"
                        strokeWidth={2.5}
                        fill="url(#regGradient)"
                        dot={{ r: 4, fill: "#e63946" }}
                        activeDot={{ r: 6 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* CHART 2: Donor Distribution by Blood Group */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs min-w-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-droplet text-red-600 text-sm" />
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">Donor Distribution by Blood Group</h3>
                      <p className="text-xs text-slate-500">Breakdown of all registered donors by blood type</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-bold bg-red-50 text-red-600 rounded-lg border border-red-100">
                    8 Blood Groups
                  </span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bloodGroupData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="bloodGroup" tick={{ fontSize: 11, fill: "#64748b" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                      />
                      <Bar dataKey="count" name="Donors" fill="#102a4c" radius={[4, 4, 0, 0]}>
                        {bloodGroupData.map((entry: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.bloodGroup.includes("O") ? "#e63946" : "#102a4c"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* CHART 3: Donor Eligibility & Screening Breakdown */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs min-w-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-chart-pie text-blue-900 text-sm" />
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">Donor Eligibility &amp; Screening Status</h3>
                      <p className="text-xs text-slate-500">Clinical clearance states across donor pool</p>
                    </div>
                  </div>
                </div>
                <div className="h-64 flex flex-col sm:flex-row items-center justify-center gap-4">
                  {screeningDistributionData.length > 0 ? (
                    <>
                      <div className="w-full sm:w-1/2 h-56 relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={screeningDistributionData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={75}
                              paddingAngle={3}
                            >
                              {screeningDistributionData.map((entry: any, index: number) => (
                                <Cell key={`pie-cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Center donut label */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-xl font-black text-slate-900 leading-tight">{totalDonors}</span>
                          <span className="text-[10px] uppercase font-bold text-slate-400">Total Donors</span>
                        </div>
                      </div>
                      <div className="w-full sm:w-1/2 space-y-2.5 text-xs">
                        {screeningDistributionData.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                              <span className="text-slate-700 font-medium">{item.name}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{item.value}</span>
                              <span className="text-slate-400 text-[11px]">
                                {totalDonors > 0 ? `${((item.value / totalDonors) * 100).toFixed(1)}%` : "0%"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-slate-400 py-12">
                      <i className="fas fa-clipboard-list text-3xl mb-2" />
                      <p>No screening records recorded yet.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* CHART 4: Monthly Donation Activity */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs min-w-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-chart-line text-blue-600 text-sm" />
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">Donation Activity Over Time</h3>
                      <p className="text-xs text-slate-500">Verified blood donations completed across camps</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 text-xs font-bold bg-slate-100 text-slate-700 rounded-lg border border-slate-200 flex items-center gap-1.5">
                    <span>Units Tracked</span>
                    <i className="fas fa-chevron-down text-[10px] text-slate-400" />
                  </span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyDonationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="donGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#102a4c" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#102a4c" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#64748b" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="donations"
                        name="Completed Donations"
                        stroke="#102a4c"
                        strokeWidth={2.5}
                        fill="url(#donGradient)"
                        dot={{ r: 4, fill: "#102a4c" }}
                        activeDot={{ r: 6 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Quick Review Queue Summary on Overview */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Urgent Medical Review Queue</h3>
                  <p className="text-xs text-slate-500">
                    Questionnaires with clinical flags or pending medical clearances
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("queue")}
                  className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline"
                >
                  View Full Queue ({queueItems.length}) &rarr;
                </button>
              </div>

              {queueLoading ? (
                <div className="text-center py-10 text-slate-400">
                  <i className="fas fa-spinner fa-spin text-2xl" />
                  <p className="mt-2 text-xs">Loading queue items...</p>
                </div>
              ) : queueItems.length === 0 ? (
                <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <i className="fas fa-clipboard-check text-3xl text-emerald-500 mb-2" />
                  <p className="font-semibold text-sm">Medical Review Queue is Clean</p>
                  <p className="text-xs text-slate-400 mt-1">All donor questionnaires have been clinically reviewed.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500 text-xs font-semibold">
                        <th className="py-2.5">Priority</th>
                        <th className="py-2.5">Donor Name</th>
                        <th className="py-2.5">Blood Group</th>
                        <th className="py-2.5">Clinical Flags</th>
                        <th className="py-2.5">Submitted</th>
                        <th className="py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {queueItems.slice(0, 5).map((q, idx) => (
                        <tr key={q._id} className="hover:bg-slate-50/80">
                          <td className="py-3">
                            {q.preliminaryFlags?.length > 0 ? (
                              <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-red-100 text-red-700">
                                High ({q.preliminaryFlags.length})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 text-slate-600">
                                Standard
                              </span>
                            )}
                          </td>
                          <td className="py-3 font-semibold text-slate-900">
                            {q.user?.name || (q.user?.email ? q.user.email.split("@")[0] : `Donor #${q._id.slice(-6).toUpperCase()}`)}
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 font-bold text-xs rounded bg-red-50 text-red-700">
                              {q.user?.bloodGroup || "—"}
                            </span>
                          </td>
                          <td className="py-3 text-xs text-slate-600">
                            {q.preliminaryFlags?.length > 0
                              ? `${q.preliminaryFlags.length} items to verify`
                              : "No automated flags"}
                          </td>
                          <td className="py-3 text-xs text-slate-500">
                            {q.submittedAt ? new Date(q.submittedAt).toLocaleDateString() : "Pending"}
                          </td>
                          <td className="py-3 text-right">
                            <Link
                              to="/admin/health-screenings/$screeningId"
                              params={{ screeningId: q._id }}
                              className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
                            >
                              Review &rarr;
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: SEARCHABLE & FILTERABLE DONOR MANAGEMENT TABLE
           ========================================================================= */}
        {activeTab === "donors" && (
          <div className="space-y-6 mt-6">
            {/* Control & Search Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
              {/* Top Search Input */}
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                  <input
                    type="text"
                    value={donorSearch}
                    onChange={(e) => setDonorSearch(e.target.value)}
                    placeholder="Search by donor name, email, phone, or User ID..."
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 bg-white font-normal text-slate-800 placeholder-slate-400 focus:outline-none focus:border-red-500 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#e60023] text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors shrink-0 flex items-center gap-2 shadow-2xs cursor-pointer"
                >
                  <i className="fas fa-search text-xs" />
                  <span>Search</span>
                </button>
              </form>

              {/* Filters Row */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 pt-3 border-t border-slate-100">
                {/* Role Filter */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Role</label>
                  <select
                    value={donorRole}
                    onChange={(e) => {
                      setDonorRole(e.target.value);
                      setDonorPage(1);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 focus:outline-none focus:border-red-500"
                  >
                    <option value="all">All Roles</option>
                    <option value="user">Donors (Users)</option>
                    <option value="organizer">Camp Organizers</option>
                    <option value="admin">Administrators</option>
                  </select>
                </div>

                {/* Blood Group Filter */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Blood Group</label>
                  <select
                    value={donorBloodGroup}
                    onChange={(e) => {
                      setDonorBloodGroup(e.target.value);
                      setDonorPage(1);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 focus:outline-none focus:border-red-500"
                  >
                    <option value="all">All Groups</option>
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Eligibility Filter */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Eligibility</label>
                  <select
                    value={donorEligibility}
                    onChange={(e) => {
                      setDonorEligibility(e.target.value);
                      setDonorPage(1);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 focus:outline-none focus:border-red-500"
                  >
                    <option value="all">All Eligibility</option>
                    <option value="true">Verified Eligible</option>
                    <option value="false">Deferred / Ineligible</option>
                  </select>
                </div>

                {/* Screening Status Filter */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Medical Review</label>
                  <select
                    value={donorScreeningStatus}
                    onChange={(e) => {
                      setDonorScreeningStatus(e.target.value);
                      setDonorPage(1);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 focus:outline-none focus:border-red-500"
                  >
                    <option value="all">All Review States</option>
                    <option value="submitted">Pending (Submitted)</option>
                    <option value="approved">Approved</option>
                    <option value="temporarily_deferred">Temporarily Deferred</option>
                    <option value="permanently_deferred">Permanently Deferred</option>
                    <option value="needs_information">Needs More Info</option>
                    <option value="not_submitted">Not Submitted Yet</option>
                  </select>
                </div>

                {/* Sort Option */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Sort By</label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={donorSortBy}
                      onChange={(e) => {
                        setDonorSortBy(e.target.value);
                        setDonorPage(1);
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 focus:outline-none focus:border-red-500"
                    >
                      <option value="createdAt">Registration</option>
                      <option value="name">Name</option>
                      <option value="bloodGroup">Blood Group</option>
                      <option value="lastDonationDate">Last Donation</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setDonorSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                      className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs shrink-0"
                      title={`Sort order: ${donorSortOrder.toUpperCase()}`}
                    >
                      <i className={`fas fa-arrow-${donorSortOrder === "asc" ? "up" : "down"} text-xs`} />
                    </button>
                  </div>
                </div>

                {/* Reset Filters */}
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      setDonorSearch("");
                      setDonorRole("all");
                      setDonorBloodGroup("all");
                      setDonorEligibility("all");
                      setDonorScreeningStatus("all");
                      setDonorSortBy("createdAt");
                      setDonorSortOrder("desc");
                      setDonorPage(1);
                    }}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 h-[38px] cursor-pointer"
                  >
                    <i className="fas fa-rotate text-xs" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Donor Table */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
              {donorsLoading ? (
                <div className="text-center py-20 text-slate-400">
                  <i className="fas fa-spinner fa-spin text-3xl text-[#e60023]" />
                  <p className="mt-3 text-xs font-bold text-slate-500">Loading donor registry records...</p>
                </div>
              ) : donors.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-2xl mx-auto mb-3">
                    <i className="fas fa-user-xmark" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-base">No Matching Users or Donors</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Try adjusting your search criteria, blood group filter, or eligibility criteria.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setDonorSearch("");
                      setDonorBloodGroup("all");
                      setDonorEligibility("all");
                      setDonorScreeningStatus("all");
                      setDonorRole("all");
                      setDonorPage(1);
                    }}
                    className="mt-4 px-4 py-2 text-xs font-bold bg-[#e60023] text-white rounded-lg hover:bg-red-700 transition-colors shadow-2xs cursor-pointer"
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px] bg-slate-50">
                        <th className="py-3 px-4">USER PROFILE</th>
                        <th className="py-3 px-4 text-center">ROLE</th>
                        <th className="py-3 px-4 text-center">BLOOD GROUP</th>
                        <th className="py-3 px-4">AGE / LOCATION</th>
                        <th className="py-3 px-4">ELIGIBILITY STATUS</th>
                        <th className="py-3 px-4">LAST DONATION</th>
                        <th className="py-3 px-4">MEDICAL REVIEW</th>
                        <th className="py-3 px-4 text-right">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {donors.map((d) => {
                        const userName = d.name || d.email?.split("@")[0] || "Unknown User";
                        return (
                          <tr key={d._id} className="hover:bg-slate-50/70 transition-colors">
                            {/* User Profile with Avatar */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-9 h-9 rounded-full ${getAvatarStyle(
                                    userName
                                  )} font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs`}
                                >
                                  {getInitials(userName)}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 text-sm">{userName}</div>
                                  <div className="text-slate-400 text-xs mt-0.5">
                                    {d.email || `ID: ${d._id.slice(-8).toUpperCase()}`}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Account Role */}
                            <td className="py-3.5 px-4 text-center">
                              {d.role === "admin" ? (
                                <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200/60 uppercase">
                                  Admin
                                </span>
                              ) : d.role === "organizer" ? (
                                <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60 uppercase">
                                  Organizer
                                </span>
                              ) : d.isDonorAvailable === false ? (
                                <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60 uppercase">
                                  Recipient
                                </span>
                              ) : (
                                <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 uppercase">
                                  Donor
                                </span>
                              )}
                            </td>

                            {/* Blood Group */}
                            <td className="py-3.5 px-4 text-center">
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold text-red-600 border border-red-200 bg-red-50/40">
                                {d.bloodGroup || "O+"}
                              </span>
                            </td>

                            {/* Age / Location */}
                            <td className="py-3.5 px-4">
                              <div className="text-xs font-semibold text-slate-800">
                                {d.age !== null && d.age !== undefined ? `${d.age} yrs` : "—"}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {d.location?.city
                                  ? `${d.location.city}${d.location.state ? `, ${d.location.state}` : ""}`
                                  : "—"}
                              </div>
                            </td>

                            {/* Eligibility Status */}
                            <td className="py-3.5 px-4">
                              {d.isEligible ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Eligible
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  Deferred
                                </span>
                              )}
                            </td>

                            {/* Last Donation */}
                            <td className="py-3.5 px-4 text-slate-600">
                              {d.lastDonationDate ? (
                                <div>
                                  <div className="font-semibold text-slate-800">
                                    {new Date(d.lastDonationDate).toLocaleDateString("en-GB", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400">None on record</span>
                              )}
                            </td>

                            {/* Medical Review */}
                            <td className="py-3.5 px-4">
                              {d.screening ? (
                                <div>
                                  <span
                                    className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                                      d.screening.status === "approved"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                        : d.screening.status === "submitted"
                                        ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                                        : d.screening.status === "needs_information"
                                        ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                                        : "bg-rose-50 text-rose-700 border border-rose-200/60"
                                    }`}
                                  >
                                    {d.screening.status.replace("_", " ")}
                                  </span>
                                  {d.screening.flagsCount > 0 && (
                                    <div className="text-[10px] text-amber-600 font-bold mt-0.5 flex items-center gap-1">
                                      <i className="fas fa-flag text-[9px]" />
                                      <span>{d.screening.flagsCount} flag(s)</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs">No questionnaire</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                <button
                                  type="button"
                                  onClick={() => setSelectedDonor(d)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition-colors shadow-2xs cursor-pointer"
                                  title="View details and manage eligibility"
                                >
                                  <i className="fas fa-sliders text-slate-500 text-xs" />
                                  <span>Manage</span>
                                </button>
                                {d.screening?._id && (
                                  <Link
                                    to="/admin/health-screenings/$screeningId"
                                    params={{ screeningId: d.screening._id }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold border border-slate-300 transition-colors shadow-2xs"
                                    title="Open medical health review"
                                  >
                                    <i className="far fa-eye text-slate-500 text-xs" />
                                    <span>Review</span>
                                  </Link>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Numbered Pagination Controls matching the design system */}
              <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-white">
                <div>
                  Showing{" "}
                  <strong>
                    {donors.length > 0 ? (donorPage - 1) * 12 + 1 : 0}–
                    {Math.min(donorPage * 12, donorTotalCount)}
                  </strong>{" "}
                  of <strong>{donorTotalCount}</strong> records
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={donorPage <= 1}
                    onClick={() => setDonorPage((p) => Math.max(1, p - 1))}
                    className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center transition-colors font-bold cursor-pointer"
                  >
                    &lt;
                  </button>

                  {Array.from({ length: Math.min(donorTotalPages, 5) }, (_, i) => {
                    let pageNum = i + 1;
                    if (donorTotalPages > 5 && donorPage > 3) {
                      pageNum = donorPage - 3 + i;
                      if (pageNum + (4 - i) > donorTotalPages) {
                        pageNum = donorTotalPages - 4 + i;
                      }
                    }
                    if (pageNum < 1 || pageNum > donorTotalPages) return null;
                    const isCurrent = donorPage === pageNum;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setDonorPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isCurrent
                            ? "bg-[#e60023] text-white shadow-2xs"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    disabled={donorPage >= donorTotalPages}
                    onClick={() => setDonorPage((p) => Math.min(donorTotalPages, p + 1))}
                    className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center transition-colors font-bold cursor-pointer"
                  >
                    &gt;
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: DEDICATED MEDICAL REVIEW QUEUE
           ========================================================================= */}
        {activeTab === "queue" && (
          <div className="space-y-6 mt-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Clinical Review Queue</h2>
                  <p className="text-xs text-slate-500">
                    Health screening questionnaires requiring clinical authorization or flags verification
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                    {queueItems.length} Pending Cases
                  </span>
                  <button
                    type="button"
                    onClick={loadReviewQueue}
                    className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200"
                  >
                    <i className="fas fa-rotate" />
                  </button>
                </div>
              </div>

              {queueLoading ? (
                <div className="text-center py-16 text-slate-400">
                  <i className="fas fa-spinner fa-spin text-3xl text-red-500" />
                  <p className="mt-2 text-xs">Loading pending submissions...</p>
                </div>
              ) : queueItems.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-xl mt-4">
                  <i className="fas fa-circle-check text-4xl text-emerald-500 mb-2" />
                  <h3 className="font-bold text-slate-900 text-base">All Screenings Reviewed</h3>
                  <p className="text-xs text-slate-500 mt-1">There are no pending clinical submissions in the queue.</p>
                </div>
              ) : (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold">
                        <th className="py-3 px-4">Priority</th>
                        <th className="py-3 px-4">Donor Information</th>
                        <th className="py-3 px-4">Blood Group</th>
                        <th className="py-3 px-4">Preliminary Flags Checklist</th>
                        <th className="py-3 px-4">Submitted At</th>
                        <th className="py-3 px-4 text-right">Review Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {queueItems.map((q, idx) => (
                        <tr key={q._id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            {q.preliminaryFlags?.length > 0 ? (
                              <span className="px-2.5 py-1 text-xs font-black rounded-full bg-red-100 text-red-700">
                                Priority ({q.preliminaryFlags.length})
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-600">
                                Normal
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{q.user?.name || "Donor"}</div>
                            <div className="text-xs text-slate-500">{q.user?.email}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold bg-red-50 text-red-700">
                              {q.user?.bloodGroup || "—"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            {q.preliminaryFlags?.length > 0 ? (
                              <div className="space-y-1">
                                {q.preliminaryFlags.slice(0, 2).map((f: any, fIdx: number) => (
                                  <div key={fIdx} className="text-amber-700 font-medium truncate max-w-xs">
                                    • {f.message}
                                  </div>
                                ))}
                                {q.preliminaryFlags.length > 2 && (
                                  <div className="text-slate-400 text-[10px]">
                                    +{q.preliminaryFlags.length - 2} more flags in detail
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-emerald-600 font-medium">Standard Questionnaire Responses</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-500">
                            {q.submittedAt ? new Date(q.submittedAt).toLocaleString() : "Recently"}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <Link
                              to="/admin/health-screenings/$screeningId"
                              params={{ screeningId: q._id }}
                              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors shadow-xs"
                            >
                              <i className="fas fa-stethoscope" /> Review Case &rarr;
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            QUICK DONOR MANAGEMENT MODAL
           ========================================================================= */}
        {selectedDonor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
              <button
                type="button"
                onClick={() => setSelectedDonor(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-lg"
              >
                &times;
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 font-bold flex items-center justify-center text-lg">
                  {selectedDonor.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{selectedDonor.name}</h3>
                  <div className="text-xs text-slate-500">ID: {selectedDonor._id}</div>
                </div>
              </div>

              <div className="space-y-3 bg-slate-50 p-4 rounded-xl text-xs mb-5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Email:</span>
                  <span className="font-semibold text-slate-800">{selectedDonor.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone:</span>
                  <span className="font-semibold text-slate-800">{selectedDonor.phone || "Not set"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Blood Group:</span>
                  <span className="font-bold text-red-600">{selectedDonor.bloodGroup}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Age:</span>
                  <span className="font-semibold text-slate-800">{selectedDonor.age ? `${selectedDonor.age} yrs` : "Unknown"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Location:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedDonor.location?.city ? `${selectedDonor.location.city}, ${selectedDonor.location.state || ""}` : "Not set"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Eligibility:</span>
                  <span className={`font-bold ${selectedDonor.isEligible ? "text-emerald-600" : "text-rose-600"}`}>
                    {selectedDonor.isEligible ? "Verified Eligible" : "Deferred / Blocked"}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                {selectedDonor.screening?._id && (
                  <Link
                    to="/admin/health-screenings/$screeningId"
                    params={{ screeningId: selectedDonor.screening._id }}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors shadow-xs"
                  >
                    <i className="fas fa-stethoscope" /> Open Clinical Review Center &rarr;
                  </Link>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setConfirmDialog({
                      show: true,
                      title: selectedDonor.isEligible ? "Defer Donor Account?" : "Mark Donor as Eligible?",
                      message: selectedDonor.isEligible
                        ? `Are you sure you want to administratively DEFER ${selectedDonor.name}? This will prevent them from donating at camps or receiving compatibility matches.`
                        : `Are you sure you want to administratively CLEAR and mark ${selectedDonor.name} as ELIGIBLE for donation?`,
                      targetEligible: !selectedDonor.isEligible,
                    })
                  }
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-colors ${
                    selectedDonor.isEligible
                      ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                  }`}
                >
                  <i className={`fas fa-${selectedDonor.isEligible ? "ban" : "check-circle"} mr-1.5`} />
                  {selectedDonor.isEligible ? "Administratively Defer Donor" : "Mark as Eligible"}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedDonor(null)}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal for Administrative Decisions */}
        {confirmDialog.show && selectedDonor && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-xl mb-4 mx-auto">
                <i className="fas fa-triangle-exclamation" />
              </div>
              <h3 className="font-bold text-slate-900 text-center text-base mb-2">{confirmDialog.title}</h3>
              <p className="text-xs text-slate-600 text-center leading-relaxed mb-4">
                {confirmDialog.message}
              </p>

              <div className="mb-4 text-left">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Clinical / Administrative Justification Note (Optional):
                </label>
                <textarea
                  value={confirmReason}
                  onChange={(e) => setConfirmReason(e.target.value)}
                  placeholder="Enter reason for this eligibility action..."
                  rows={2}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isUpdatingEligibility}
                  onClick={() => handleToggleEligibility(selectedDonor._id, confirmDialog.targetEligible)}
                  className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl text-xs hover:bg-red-700 disabled:opacity-50"
                >
                  {isUpdatingEligibility ? "Updating..." : "Yes, Confirm Decision"}
                </button>
                <button
                  type="button"
                  disabled={isUpdatingEligibility}
                  onClick={() => {
                    setConfirmDialog({ show: false, title: "", message: "", targetEligible: true });
                    setConfirmReason("");
                  }}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
