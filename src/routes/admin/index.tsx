import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "../../components/AppLayout";
import { useAuth } from "../../lib/auth";
import { API_BASE_URL } from "../../lib/api";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — REDhope" },
      { name: "description", content: "Platform overview, clinical medical reviews, and platform metrics." },
    ],
  }),
  component: AdminDashboardPage,
});

const API_BASE = API_BASE_URL;

interface AnalyticsSummary {
  camps?: {
    totalCamps: number;
    publishedCamps: number;
    completedCamps: number;
  };
  registrations?: {
    totalRegistrations: number;
    active: number;
  };
  donations?: {
    totalDonations: number;
    totalUnitsDonated: number;
  };
  userMetrics?: {
    totalUsers: number;
    donors: number;
    organizers: number;
    admins: number;
    availableDonors: number;
  };
}

interface ScreeningItem {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
    bloodGroup: string;
  };
  status: string;
  submittedAt?: string;
  createdAt: string;
}

function AdminDashboardPage() {
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [screenings, setScreenings] = useState<ScreeningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated || !user) {
        navigate({ to: "/login" });
        return;
      }
      if (user.role !== "admin") {
        navigate({ to: "/dashboard" });
        return;
      }
      loadAdminData();
    }
  }, [authLoading, isAuthenticated, user]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Analytics
      try {
        const res = await fetch(`${API_BASE}/camps/analytics`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (res.ok && json.success) {
          setAnalytics(json.data);
        }
      } catch (err) {
        console.warn("Analytics fetch error:", err);
      }

      // 2. Fetch Pending Health Screenings
      try {
        const scRes = await fetch(`${API_BASE}/admin/health-screenings?status=submitted&limit=5`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const scJson = await scRes.json();
        if (scRes.ok && scJson.success) {
          setScreenings(scJson.data?.screenings || []);
        }
      } catch (err) {
        console.warn("Screenings fetch error:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  const usersCount = analytics?.userMetrics?.totalUsers ? analytics.userMetrics.totalUsers.toLocaleString() : "8,426";
  const activeDonorsCount = analytics?.userMetrics?.availableDonors ? analytics.userMetrics.availableDonors.toLocaleString() : "2,104";
  const activeCampsCount = analytics?.camps?.totalCamps ? analytics.camps.totalCamps.toLocaleString() : "34";
  const medicalReviewsCount = screenings.length > 0 ? screenings.length.toString() : "48";
  const recordedDonationsCount = analytics?.donations?.totalUnitsDonated ? analytics.donations.totalUnitsDonated.toLocaleString() : "1,289";

  return (
    <AppLayout pageTitle="Admin Dashboard">
      <div className="max-w-7xl mx-auto">
        {/* Title & Subtitle matching Canva lines 608-609 */}
        <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-slate-600 mt-2">
          Role context: platform administration · fictional example records
        </p>

        {/* Notice matching Canva lines 610-612 */}
        <div className="notice mt-5">
          All analytics below are example placeholder data only and are not live health, donor, or regional inventory information.
        </div>

        {/* 5 Metric Cards matching Canva lines 613-629 */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-5">
          <div className="metric">
            <p className="text-xs text-slate-500">Users</p>
            <b className="text-2xl mt-1 block text-slate-900">{usersCount}</b>
          </div>
          <div className="metric">
            <p className="text-xs text-slate-500">Active donors</p>
            <b className="text-2xl mt-1 block text-slate-900">{activeDonorsCount}</b>
          </div>
          <div className="metric">
            <p className="text-xs text-slate-500">Active camps</p>
            <b className="text-2xl mt-1 block text-slate-900">{activeCampsCount}</b>
          </div>
          <div className="metric">
            <p className="text-xs text-slate-500">Medical reviews</p>
            <b className="text-2xl mt-1 block text-slate-900">{medicalReviewsCount}</b>
          </div>
          <div className="metric">
            <p className="text-xs text-slate-500">Recorded donations</p>
            <b className="text-2xl mt-1 block text-slate-900">{recordedDonationsCount}</b>
          </div>
        </div>

        {/* Grid 2-cols: Medical review queue + Donation activity by month matching Canva lines 630-695 */}
        <div className="grid lg:grid-cols-2 gap-5 mt-6">
          {/* Medical review queue panel */}
          <section className="panel p-5">
            <div className="flex gap-2 justify-between items-center">
              <h2 className="font-bold text-slate-900">Medical review queue</h2>
              <Link to="/admin/health-screenings" className="btn-secondary text-sm py-1.5 px-3">
                Filter
              </Link>
            </div>

            <div className="table-wrap mt-4">
              <table>
                <thead>
                  <tr>
                    <th>Priority</th>
                    <th>Record</th>
                    <th>Status</th>
                    <th>Reviewer</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {screenings.length > 0 ? (
                    screenings.map((sc, idx) => (
                      <tr key={sc._id}>
                        <td>
                          {idx === 0 ? (
                            <span className="badge badge-red">High</span>
                          ) : (
                            <span className="badge badge-slate">Normal</span>
                          )}
                        </td>
                        <td className="font-semibold text-slate-900">
                          Screening #{sc._id.slice(-4).toUpperCase()}
                        </td>
                        <td>
                          <span className="badge badge-amber">
                            {sc.status === "submitted" ? "Pending" : sc.status}
                          </span>
                        </td>
                        <td className="text-slate-600">Unassigned</td>
                        <td className="text-right">
                          <Link
                            to="/admin/health-screenings"
                            className="text-red-600 font-bold hover:underline"
                          >
                            Review
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <>
                      <tr>
                        <td>
                          <span className="badge badge-red">High</span>
                        </td>
                        <td className="font-semibold text-slate-900">Screening #R-104</td>
                        <td>
                          <span className="badge badge-amber">Pending</span>
                        </td>
                        <td className="text-slate-600">Unassigned</td>
                        <td className="text-right">
                          <Link
                            to="/admin/health-screenings"
                            className="text-red-600 font-bold hover:underline"
                          >
                            Review
                          </Link>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <span className="badge badge-slate">Normal</span>
                        </td>
                        <td className="font-semibold text-slate-900">Screening #R-131</td>
                        <td>
                          <span className="badge badge-amber">In review</span>
                        </td>
                        <td className="text-slate-600">Dr. Mehta</td>
                        <td className="text-right">
                          <Link
                            to="/admin/health-screenings"
                            className="text-red-600 font-bold hover:underline"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Donation activity by month panel */}
          <section className="panel p-5">
            <h2 className="font-bold text-slate-900">Donation activity by month</h2>
            <div className="mt-5 space-y-4 text-sm">
              <div>
                <div className="flex justify-between text-slate-700">
                  <span>August</span>
                  <b className="text-slate-900">218</b>
                </div>
                <div className="bar mt-1">
                  <span style={{ width: "72%" }}></span>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-slate-700">
                  <span>September</span>
                  <b className="text-slate-900">263</b>
                </div>
                <div className="bar mt-1">
                  <span style={{ width: "88%" }}></span>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-slate-700">
                  <span>October</span>
                  <b className="text-slate-900">196</b>
                </div>
                <div className="bar mt-1">
                  <span style={{ width: "65%" }}></span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-5">Example placeholder data — not live inventory.</p>
          </section>
        </div>

        {/* User & camp management panel matching Canva lines 696-735 */}
        <section className="panel p-5 mt-5">
          <div className="flex flex-wrap gap-3 justify-between items-center">
            <h2 className="font-bold text-slate-900">User &amp; camp management</h2>
            <div className="flex gap-2">
              <input
                className="field w-48 text-sm py-1.5"
                placeholder="Search example records"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select
                className="field w-auto text-sm py-1.5"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="review">Review</option>
              </select>
            </div>
          </div>

          <div className="table-wrap mt-4">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Record</th>
                  <th>Area</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Safe action</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Donor</td>
                  <td className="font-semibold text-slate-900">Donor A-104</td>
                  <td>Ahmedabad West</td>
                  <td>
                    <span className="badge badge-green">Active</span>
                  </td>
                  <td>Today</td>
                  <td>
                    <Link to="/matching" className="text-red-600 font-bold hover:underline">
                      View record
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td>Camp</td>
                  <td className="font-semibold text-slate-900">Community Care Drive</td>
                  <td>Riverfront</td>
                  <td>
                    <span className="badge badge-green">Published</span>
                  </td>
                  <td>Yesterday</td>
                  <td>
                    <Link to="/organizer" className="text-red-600 font-bold hover:underline">
                      Manage
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent activity panel matching Canva lines 736-742 */}
        <section className="panel p-5 mt-5 mb-8">
          <h2 className="font-bold text-slate-900">Recent activity</h2>
          <div className="mt-4 text-sm space-y-3">
            <p className="text-slate-700">
              <b className="text-slate-900">Organizer</b> published a camp listing{" "}
              <span className="badge badge-green">Complete</span>{" "}
              <span className="text-slate-500">· 09:15</span>
            </p>
            <p className="text-slate-700">
              <b className="text-slate-900">Medical reviewer</b> assigned Screening #R-131{" "}
              <span className="badge badge-amber">In review</span>{" "}
              <span className="text-slate-500">· 08:40</span>
            </p>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
