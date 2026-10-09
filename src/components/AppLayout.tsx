import { Link, useRouterState } from "@tanstack/react-router";
import { useState, useEffect, type ReactNode } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { RedHopeLogo } from "./RedHopeLogo";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  key: string;
  badge?: number;
}

interface AppLayoutProps {
  children: ReactNode;
  activeNav?: string;
  pageTitle?: string;
  role?: "user" | "organizer" | "admin";
}

export function AppLayout({ children, activeNav, pageTitle }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    api
      .get<{ success: boolean; count: number }>("/notifications/unread-count")
      .then((res) => {
        if (res?.success && typeof res.count === "number") {
          setUnreadCount(res.count);
        }
      })
      .catch(() => {
        setUnreadCount(0);
      });
  }, [pathname]);

  const role = user?.role || "user";

  const donorNav: NavItem[] = [
    { to: "/dashboard", label: "Dashboard", icon: "fas fa-th-large", key: "dashboard" },
    { to: "/matching", label: "Find Donors", icon: "fas fa-search", key: "matching" },
    { to: "/camps", label: "Find Camps", icon: "fas fa-tent", key: "camps" },
    { to: "/donations", label: "My Donations", icon: "fas fa-hand-holding-heart", key: "donations" },
    { to: "/health-screening", label: "Health Screening", icon: "fas fa-heartbeat", key: "health-screening" },
    { to: "/notifications", label: "Notifications", icon: "fas fa-bell", key: "notifications", badge: unreadCount },
    { to: "/profile", label: "Profile", icon: "fas fa-user", key: "profile" },
    { to: "/eligibility", label: "Eligibility", icon: "fas fa-stethoscope", key: "eligibility" },
  ];

  const organizerNav: NavItem[] = [
    { to: "/organizer", label: "Dashboard", icon: "fas fa-th-large", key: "organizer-dashboard" },
    { to: "/organizer", label: "My Camps", icon: "fas fa-tent", key: "my-camps" },
    { to: "/organizer", label: "Registrations", icon: "fas fa-users", key: "registrations" },
    { to: "/donations", label: "Donations", icon: "fas fa-hand-holding-heart", key: "donations" },
    { to: "/organizer", label: "Donor Screening", icon: "fas fa-stethoscope", key: "donor-screening" },
    { to: "/organizer/analytics", label: "Analytics", icon: "fas fa-chart-line", key: "analytics" },
    { to: "/notifications", label: "Notifications", icon: "fas fa-bell", key: "notifications", badge: unreadCount },
    { to: "/profile", label: "Profile", icon: "fas fa-user", key: "profile" },
  ];

  const adminNav: NavItem[] = [
    { to: "/admin", label: "Dashboard", icon: "fas fa-th-large", key: "admin-dashboard" },
    { to: "/admin", label: "Users", icon: "fas fa-users-cog", key: "users" },
    { to: "/organizer", label: "Camps", icon: "fas fa-tent", key: "admin-camps" },
    { to: "/donations", label: "Donations", icon: "fas fa-hand-holding-heart", key: "admin-donations" },
    { to: "/admin/health-screenings", label: "Medical Review", icon: "fas fa-stethoscope", key: "medical-review" },
    { to: "/organizer/analytics", label: "Analytics", icon: "fas fa-chart-line", key: "admin-analytics" },
    { to: "/profile", label: "Settings", icon: "fas fa-cog", key: "settings" },
  ];

  const currentNav = role === "admin" ? adminNav : role === "organizer" ? organizerNav : donorNav;

  const getRoleLabel = () => {
    if (role === "admin") return "System Administrator";
    if (role === "organizer") return "Camp Organizer";
    return "Blood Donor";
  };

  return (
    <div className="app-shell">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Authenticated Left Sidebar */}
      <aside
        className={`app-sidebar ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } fixed lg:sticky top-0 left-0 z-50`}
      >
        {/* Top Logo */}
        <div className="h-16 px-5 border-b border-slate-700/60 flex items-center justify-between">
          <RedHopeLogo size="md" variant="dark" />
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-slate-600 p-1"
            aria-label="Close sidebar"
          >
            <i className="fas fa-times text-lg" />
          </button>
        </div>

        {/* User Identity Card (Header of Sidebar) */}
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {user?.name ? user.name.slice(0, 2).toUpperCase() : "U"}
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name" title={user?.name || "User"}>
              {user?.name || "Guest User"}
            </div>
            <div className="sidebar-user-role">{getRoleLabel()}</div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="sidebar-nav">
          {currentNav.map((item) => {
            const isActive =
              activeNav === item.key ||
              (item.to === "/"
                ? pathname === "/"
                : pathname === item.to || pathname.startsWith(item.to + "/"));
            return (
              <Link
                key={item.label + item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`sidebar-link ${isActive ? "active" : ""}`}
              >
                <i className={item.icon} />
                <span className="flex-1">{item.label}</span>
                {typeof item.badge === "number" && item.badge > 0 && (
                  <span className="bg-[#DC2626] text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Sign-out Action */}
        <div className="p-3 border-t border-slate-200">
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 transition"
          >
            <i className="fas fa-sign-out-alt w-5 text-center text-slate-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="app-main">
        {/* Top App Bar */}
        <header className="app-topbar">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Open sidebar"
            >
              <i className="fas fa-bars text-lg" />
            </button>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 hidden sm:inline">
              REDhope Health Platform
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Link to Notifications */}
            <Link
              to="/notifications"
              className="relative p-2 rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
              title="Notifications"
            >
              <i className="fas fa-bell text-lg" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#DC2626] rounded-full ring-2 ring-white" />
              )}
            </Link>

            {/* Quick Profile Link */}
            <Link
              to="/profile"
              className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full hover:bg-slate-100 transition"
            >
              <div className="w-8 h-8 rounded-full bg-red-100 text-[#DC2626] font-bold text-xs flex items-center justify-center">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : "U"}
              </div>
              <span className="text-xs font-bold text-slate-700 hidden md:inline">
                {user?.bloodGroup ? `${user.bloodGroup}` : "Donor"}
              </span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}

