import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { toast } from "../components/AppToaster";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — REDhope" },
      {
        name: "description",
        content: "View your blood donation notifications, camp updates, and match alerts.",
      },
      { property: "og:title", content: "Notifications — REDhope" },
      {
        property: "og:description",
        content: "Stay informed about matching blood requests and camp updates on REDhope.",
      },
    ],
  }),
  component: NotificationsPage,
});

import { API_BASE_URL } from "../lib/api";
const API_BASE = API_BASE_URL;

interface NotificationMetadata {
  campId?: string;
  registrationId?: string;
  bloodGroup?: string;
  unitsNeeded?: number;
  [key: string]: unknown;
}

interface NotificationItem {
  _id: string;
  user: string;
  type: "blood_match" | "camp_registration" | "camp_update" | "camp_cancellation" | "system";
  title: string;
  message: string;
  isRead: boolean;
  metadata?: NotificationMetadata;
  createdAt: string;
  updatedAt: string;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function NotificationsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Auth form state (when logged out)
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Notification list state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loadingList, setLoadingList] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 15,
    totalPages: 1,
  });

  // Filter state
  const [filterType, setFilterType] = useState<string>("all"); // 'all', 'unread', 'blood_match', 'camp', 'system'
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  // Load auth token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("token") || localStorage.getItem("redhope_token");
    if (savedToken) {
      setToken(savedToken);
      fetchNotifications(savedToken, page);
      fetchUnreadCount(savedToken);
    }
    setLoadingAuth(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const data = await res.json();

      if (!res.ok || !data.token) {
        toast.error("Login Failed", data.message || "Invalid email or password.");
        setAuthLoading(false);
        return;
      }

      const activeToken = data.token;
      localStorage.setItem("token", activeToken);
      localStorage.setItem("redhope_token", activeToken);
      setToken(activeToken);
      toast.success("Welcome back!", { description: "Signed in successfully." });

      fetchNotifications(activeToken, 1);
      fetchUnreadCount(activeToken);
    } catch {
      toast.error("Network Error", { description: "Unable to sign in. Please verify your backend connection." });
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchUnreadCount = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok && data.success && typeof data.count === "number") {
        setUnreadCount(data.count);
      }
    } catch {
      // silently fail count poll
    }
  };

  const fetchNotifications = async (authToken: string, pageNum: number) => {
    setLoadingList(true);
    try {
      const res = await fetch(`${API_BASE}/notifications?page=${pageNum}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setNotifications(data.data || []);
        if (data.pagination) {
          setPagination(data.pagination);
          setPage(data.pagination.page);
        }
      } else {
        toast.error("Fetch Error", { description: data.message || "Failed to load notifications." });
      }
    } catch {
      toast.error("Network Error", { description: "Unable to retrieve notifications." });
    } finally {
      setLoadingList(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    if (!token) return;
    setActionLoadingId(id);
    try {
      const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setNotifications((prev) =>
          prev.map((item) => (item._id === id ? { ...item, isRead: true } : item))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
        toast.success("Notification updated", { description: "Marked as read." });
      } else {
        toast.error("Error", { description: data.message || "Failed to mark notification as read." });
      }
    } catch {
      toast.error("Network Error", { description: "Unable to update notification." });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!token || unreadCount === 0) return;
    setMarkingAllRead(true);
    try {
      const res = await fetch(`${API_BASE}/notifications/read-all`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
        setUnreadCount(0);
        toast.success("Success", { description: "All notifications marked as read." });
      } else {
        toast.error("Error", { description: data.message || "Failed to mark all as read." });
      }
    } catch {
      toast.error("Network Error", { description: "Unable to update all notifications." });
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!token) return;
    const target = notifications.find((n) => n._id === id);
    setActionLoadingId(id);

    try {
      const res = await fetch(`${API_BASE}/notifications/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setNotifications((prev) => prev.filter((item) => item._id !== id));
        if (target && !target.isRead) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        setPagination((prev) => ({
          ...prev,
          total: Math.max(0, prev.total - 1),
        }));
        toast.success("Deleted", { description: "Notification removed." });
      } else {
        toast.error("Error", { description: data.message || "Failed to delete notification." });
      }
    } catch {
      toast.error("Network Error", { description: "Unable to delete notification." });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (!token || newPage < 1 || newPage > pagination.totalPages) return;
    fetchNotifications(token, newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const formatTimestamp = (isoDate: string) => {
    try {
      const date = new Date(isoDate);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHrs = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHrs / 24);

      if (diffSec < 60) return "Just now";
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHrs < 24) return `${diffHrs}h ago`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    } catch {
      return isoDate;
    }
  };

  // Filter list
  const filteredNotifications = notifications.filter((item) => {
    if (filterType === "all") return true;
    if (filterType === "unread") return !item.isRead;
    if (filterType === "blood_match") return item.type === "blood_match";
    if (filterType === "camp") {
      return (
        item.type === "camp_registration" ||
        item.type === "camp_update" ||
        item.type === "camp_cancellation"
      );
    }
    if (filterType === "system") return item.type === "system";
    return true;
  });

  const getTypeBadge = (type: NotificationItem["type"]) => {
    switch (type) {
      case "blood_match":
        return {
          label: "Blood Match",
          icon: "fa-heart-pulse",
          bgColor: "#ffebee",
          color: "#c62828",
          borderColor: "#ffcdd2",
        };
      case "camp_registration":
        return {
          label: "Camp Registration",
          icon: "fa-id-card",
          bgColor: "#e3f2fd",
          color: "#1565c0",
          borderColor: "#bbdefb",
        };
      case "camp_update":
        return {
          label: "Camp Update",
          icon: "fa-bullhorn",
          bgColor: "#fff8e1",
          color: "#f57f17",
          borderColor: "#ffe082",
        };
      case "camp_cancellation":
        return {
          label: "Camp Cancelled",
          icon: "fa-ban",
          bgColor: "#fbe9e7",
          color: "#d84315",
          borderColor: "#ffccbc",
        };
      case "system":
      default:
        return {
          label: "System Alert",
          icon: "fa-circle-info",
          bgColor: "#ede7f6",
          color: "#4527a0",
          borderColor: "#d1c4e9",
        };
    }
  };

  return (
    <>
      <Navbar solid={true} />

      {/* Hero Header */}
      <section
        style={{
          background: "linear-gradient(135deg, var(--secondary) 0%, #1a365d 100%)",
          color: "#ffffff",
          padding: "60px 0 40px",
          textAlign: "center",
        }}
      >
        <div className="container">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: "50%",
              backgroundColor: "rgba(230, 57, 70, 0.2)",
              color: "var(--primary)",
              fontSize: 28,
              marginBottom: 16,
            }}
          >
            <i className="fas fa-bell" />
          </div>
          <h1 style={{ fontSize: "2.4rem", marginBottom: 12, fontWeight: 800 }}>
            Notifications & Alerts
          </h1>
          <p
            style={{
              fontSize: "1.1rem",
              color: "rgba(255, 255, 255, 0.8)",
              maxWidth: 600,
              margin: "0 auto",
            }}
          >
            Stay updated on matching blood donation requests, camp registrations, and schedule notices.
          </p>
        </div>
      </section>

      {/* Main Body */}
      <section
        style={{
          backgroundColor: "var(--background, #f8f9fa)",
          minHeight: "65vh",
          padding: "40px 0 80px",
        }}
      >
        <div className="container" style={{ maxWidth: 900 }}>
          {loadingAuth ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <i className="fas fa-spinner fa-spin fa-3x" style={{ color: "var(--primary)" }} />
              <p style={{ marginTop: 16, color: "var(--gray)", fontSize: 16 }}>Checking session...</p>
            </div>
          ) : !token ? (
            /* Unauthenticated View */
            <div className="form-section" style={{ maxWidth: 460, margin: "0 auto", background: "#fff", padding: 32, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
              <h3 style={{ fontSize: "1.4rem", marginBottom: 10, color: "var(--secondary)" }}>
                <i className="fas fa-lock" style={{ marginRight: 8, color: "var(--primary)" }} />
                Sign In to View Notifications
              </h3>
              <p style={{ color: "var(--gray)", marginBottom: 24, fontSize: 14 }}>
                Please sign in with your REDhope credentials to see your personal alerts and updates.
              </p>
              <form onSubmit={handleLogin}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="e.g. donor@example.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 24 }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                    Password
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Enter your password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn"
                  style={{ width: "100%", padding: "12px 0" }}
                  disabled={authLoading}
                >
                  {authLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} /> Signing In...
                    </>
                  ) : (
                    "Sign In to Notifications"
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* Authenticated Notification Center */
            <div>
              {/* Header Toolbar */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 16,
                  backgroundColor: "#ffffff",
                  padding: "18px 24px",
                  borderRadius: 8,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <h2 style={{ fontSize: "1.3rem", margin: 0, color: "var(--secondary)" }}>
                    Inbox
                  </h2>
                  {unreadCount > 0 && (
                    <span
                      style={{
                        backgroundColor: "#e63946",
                        color: "#ffffff",
                        padding: "3px 10px",
                        borderRadius: 12,
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    >
                      {unreadCount} unread
                    </span>
                  )}
                  <span style={{ color: "var(--gray)", fontSize: 14 }}>
                    ({pagination.total} total)
                  </span>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    onClick={() => {
                      fetchNotifications(token, page);
                      fetchUnreadCount(token);
                    }}
                    className="btn btn-outline"
                    title="Refresh notifications"
                    style={{
                      padding: "8px 14px",
                      fontSize: 13,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    disabled={loadingList}
                  >
                    <i className={`fas fa-rotate-right ${loadingList ? "fa-spin" : ""}`} />
                    Refresh
                  </button>

                  <button
                    onClick={handleMarkAllAsRead}
                    className="btn"
                    style={{
                      padding: "8px 16px",
                      fontSize: 13,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      opacity: unreadCount === 0 || markingAllRead ? 0.6 : 1,
                      cursor: unreadCount === 0 || markingAllRead ? "not-allowed" : "pointer",
                    }}
                    disabled={unreadCount === 0 || markingAllRead}
                  >
                    <i className="fas fa-check-double" />
                    {markingAllRead ? "Marking..." : "Mark All as Read"}
                  </button>
                </div>
              </div>

              {/* Filter Tabs */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 20,
                  overflowX: "auto",
                  paddingBottom: 4,
                }}
              >
                {[
                  { id: "all", label: "All" },
                  { id: "unread", label: `Unread (${unreadCount})` },
                  { id: "blood_match", label: "Blood Matches" },
                  { id: "camp", label: "Camps" },
                  { id: "system", label: "System" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterType(tab.id)}
                    className="tab-btn"
                    style={{
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: 20,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      transition: "all 0.22s ease",
                      backgroundColor: filterType === tab.id ? "var(--secondary)" : "#ffffff",
                      color: filterType === tab.id ? "#ffffff" : "var(--gray)",
                      boxShadow: filterType === tab.id ? "0 4px 12px rgba(26, 54, 93, 0.2)" : "0 1px 3px rgba(0,0,0,0.06)",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Notification Cards List */}
              {loadingList ? (
                <div style={{ textAlign: "center", padding: "60px 0", background: "#fff", borderRadius: 8 }}>
                  <i className="fas fa-spinner fa-spin fa-2x" style={{ color: "var(--primary)" }} />
                  <p style={{ marginTop: 12, color: "var(--gray)", fontSize: 15 }}>Loading notifications...</p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    padding: "60px 20px",
                    borderRadius: 8,
                    textAlign: "center",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  }}
                >
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: "50%",
                      backgroundColor: "#f1f3f5",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 32,
                      color: "var(--gray)",
                      marginBottom: 16,
                    }}
                  >
                    <i className="fas fa-bell-slash" />
                  </div>
                  <h3 style={{ fontSize: "1.3rem", color: "var(--secondary)", marginBottom: 8 }}>
                    {filterType === "unread" ? "No unread notifications" : "No notifications found"}
                  </h3>
                  <p style={{ color: "var(--gray)", maxWidth: 420, margin: "0 auto", fontSize: 14 }}>
                    {filterType === "unread"
                      ? "You are completely caught up! Check back later for new updates."
                      : "You do not have any notifications matching this filter."}
                  </p>
                </div>
              ) : (
                <div key={filterType} className="tab-animated" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {filteredNotifications.map((item) => {
                    const badge = getTypeBadge(item.type);
                    const isLoading = actionLoadingId === item._id;

                    return (
                      <div
                        key={item._id}
                        style={{
                          backgroundColor: "#ffffff",
                          borderRadius: 8,
                          padding: "18px 22px",
                          boxShadow: item.isRead
                            ? "0 1px 4px rgba(0,0,0,0.04)"
                            : "0 3px 10px rgba(230, 57, 70, 0.08)",
                          borderLeft: item.isRead ? "4px solid #dee2e6" : "4px solid var(--primary)",
                          transition: "all 0.2s ease",
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                            gap: 12,
                            marginBottom: 8,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            {/* Type badge */}
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "3px 10px",
                                borderRadius: 12,
                                fontSize: "11px",
                                fontWeight: 700,
                                backgroundColor: badge.bgColor,
                                color: badge.color,
                                border: `1px solid ${badge.borderColor}`,
                              }}
                            >
                              <i className={`fas ${badge.icon}`} />
                              {badge.label}
                            </span>

                            {/* Unread indicator */}
                            {!item.isRead && (
                              <span
                                style={{
                                  backgroundColor: "#e63946",
                                  color: "#ffffff",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.5px",
                                }}
                              >
                                New
                              </span>
                            )}

                            {/* Timestamp */}
                            <span style={{ color: "var(--gray)", fontSize: "12px" }}>
                              <i className="far fa-clock" style={{ marginRight: 4 }} />
                              {formatTimestamp(item.createdAt)}
                            </span>
                          </div>

                          {/* Quick action buttons */}
                          <div style={{ display: "flex", gap: 6 }}>
                            {!item.isRead && (
                              <button
                                onClick={() => handleMarkAsRead(item._id)}
                                title="Mark as read"
                                disabled={isLoading}
                                style={{
                                  background: "none",
                                  border: "1px solid #ced4da",
                                  borderRadius: 4,
                                  padding: "4px 8px",
                                  fontSize: 12,
                                  color: "var(--secondary)",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <i className="fas fa-check" />
                                <span style={{ fontSize: 11 }}>Read</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleDeleteNotification(item._id)}
                              title="Delete notification"
                              disabled={isLoading}
                              style={{
                                background: "none",
                                border: "1px solid #ced4da",
                                borderRadius: 4,
                                padding: "4px 8px",
                                fontSize: 12,
                                color: "#dc3545",
                                cursor: "pointer",
                              }}
                            >
                              <i className="far fa-trash-can" />
                            </button>
                          </div>
                        </div>

                        {/* Title & Message */}
                        <h4
                          style={{
                            fontSize: "1.05rem",
                            margin: "0 0 6px 0",
                            color: "var(--secondary)",
                            fontWeight: item.isRead ? 600 : 700,
                          }}
                        >
                          {item.title}
                        </h4>
                        <p
                          style={{
                            color: item.isRead ? "#495057" : "#212529",
                            fontSize: "14px",
                            margin: "0 0 10px 0",
                            lineHeight: 1.5,
                          }}
                        >
                          {item.message}
                        </p>

                        {/* Metadata action link if campId present */}
                        {item.metadata?.campId && (
                          <div style={{ marginTop: 8 }}>
                            <Link
                              to="/camps/$campId"
                              params={{ campId: String(item.metadata.campId) }}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: "12px",
                                fontWeight: 600,
                                color: "var(--primary)",
                                textDecoration: "none",
                              }}
                            >
                              <span>View Camp Details</span>
                              <i className="fas fa-arrow-right" />
                            </Link>
                          </div>
                        )}

                        {/* Blood match contextual link */}
                        {item.type === "blood_match" && (
                          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            {item.metadata?.bloodGroup && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  backgroundColor: "#ffebee",
                                  color: "#c62828",
                                  padding: "2px 8px",
                                  borderRadius: 4,
                                }}
                              >
                                Required: {String(item.metadata.bloodGroup)} ({Number(item.metadata.unitsNeeded) || 1} unit)
                              </span>
                            )}
                            <Link
                              to="/matching"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: "12px",
                                fontWeight: 600,
                                color: "var(--primary)",
                                textDecoration: "none",
                              }}
                            >
                              <span>Find Donors & Matching</span>
                              <i className="fas fa-arrow-right" />
                            </Link>
                          </div>
                        )}

                        {/* System eligibility reminder contextual link */}
                        {item.type === "system" && item.title.includes("Eligible") && (
                          <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
                            <Link
                              to="/eligibility"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: "12px",
                                fontWeight: 600,
                                color: "var(--primary)",
                                textDecoration: "none",
                              }}
                            >
                              <span>Check Eligibility Details</span>
                              <i className="fas fa-arrow-right" />
                            </Link>
                            <Link
                              to="/camps"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: "12px",
                                fontWeight: 600,
                                color: "var(--secondary)",
                                textDecoration: "none",
                              }}
                            >
                              <span>Find Camps</span>
                              <i className="fas fa-arrow-right" />
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination controls */}
              {pagination.totalPages > 1 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 24,
                    padding: "16px 20px",
                    backgroundColor: "#ffffff",
                    borderRadius: 8,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  }}
                >
                  <span style={{ fontSize: 13, color: "var(--gray)" }}>
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} notifications)
                  </span>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1 || loadingList}
                      className="btn btn-outline"
                      style={{
                        padding: "6px 14px",
                        fontSize: 13,
                        cursor: pagination.page <= 1 ? "not-allowed" : "pointer",
                        opacity: pagination.page <= 1 ? 0.5 : 1,
                      }}
                    >
                      <i className="fas fa-chevron-left" style={{ marginRight: 4 }} />
                      Previous
                    </button>

                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages || loadingList}
                      className="btn btn-outline"
                      style={{
                        padding: "6px 14px",
                        fontSize: 13,
                        cursor: pagination.page >= pagination.totalPages ? "not-allowed" : "pointer",
                        opacity: pagination.page >= pagination.totalPages ? 0.5 : 1,
                      }}
                    >
                      Next
                      <i className="fas fa-chevron-right" style={{ marginLeft: 4 }} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}

