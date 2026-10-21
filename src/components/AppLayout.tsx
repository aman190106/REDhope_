import { Link, useRouterState } from "@tanstack/react-router";
import { useState, useEffect, type ReactNode } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";

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
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const role = user?.role || "user";
  const isAdmin = role === "admin";

  useEffect(() => {
    api
      .get<{ success: boolean; count?: number; data?: { count: number } }>("/notifications/unread-count")
      .then((res) => {
        const cnt = typeof res?.count === "number" ? res.count : res?.data?.count;
        if (typeof cnt === "number") {
          setUnreadCount(cnt);
        }
      })
      .catch(() => {
        setUnreadCount(0);
      });
  }, [pathname]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Close mobile sidebar on Escape key and lock background scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    if (sidebarOpen) {
      window.addEventListener("keydown", handleKeyDown);
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = origOverflow;
      };
    }
  }, [sidebarOpen]);

  const isRecipient = role === "user" && user?.isDonorAvailable === false;

  const donorNav: NavItem[] = [
    { to: "/dashboard", label: "Dashboard", icon: "fas fa-th-large", key: "dashboard" },
    { to: "/camps", label: "Find Camps", icon: "fas fa-tent", key: "camps" },
    { to: "/donations", label: "My Donations", icon: "fas fa-hand-holding-heart", key: "donations" },
    { to: "/health-screening", label: "Health Screening", icon: "fas fa-heartbeat", key: "health-screening" },
    { to: "/eligibility", label: "Eligibility", icon: "fas fa-stethoscope", key: "eligibility" },
    { to: "/notifications", label: "Notifications", icon: "fas fa-bell", key: "notifications", badge: unreadCount },
    { to: "/profile", label: "Profile", icon: "fas fa-user", key: "profile" },
  ];

  const organizerNav: NavItem[] = [
    { to: "/organizer", label: "Dashboard", icon: "fas fa-th-large", key: "organizer-dashboard" },
    { to: "/organize", label: "Host a Camp", icon: "fas fa-plus-circle", key: "host-camp" },
    { to: "/organizer", label: "My Camps", icon: "fas fa-tent", key: "my-camps" },
    { to: "/organizer/analytics", label: "Analytics", icon: "fas fa-chart-line", key: "analytics" },
    { to: "/notifications", label: "Notifications", icon: "fas fa-bell", key: "notifications", badge: unreadCount },
    { to: "/profile", label: "Profile", icon: "fas fa-user", key: "profile" },
  ];

  const recipientNav: NavItem[] = [
    { to: "/dashboard", label: "Dashboard", icon: "fas fa-th-large", key: "dashboard" },
    { to: "/matching", label: "Find Donors", icon: "fas fa-search", key: "matching" },
    { to: "/camps", label: "Nearby Camps", icon: "fas fa-tent", key: "camps" },
    { to: "/notifications", label: "Notifications", icon: "fas fa-bell", key: "notifications", badge: unreadCount },
    { to: "/profile", label: "Profile", icon: "fas fa-user", key: "profile" },
  ];

  const adminNav: NavItem[] = [
    { to: "/admin", label: "Command Center", icon: "fas fa-shield-halved", key: "admin-dashboard" },
    { to: "/admin/health-screenings", label: "Medical Review Queue", icon: "fas fa-stethoscope", key: "medical-review" },
    { to: "/admin?tab=donors", label: "Users", icon: "fas fa-users", key: "users" },
    { to: "/organizer", label: "Camps", icon: "far fa-calendar-alt", key: "admin-camps" },
    { to: "/donations", label: "Donations", icon: "fas fa-droplet", key: "admin-donations" },
    { to: "/organizer/analytics", label: "Camp Analytics", icon: "fas fa-chart-line", key: "admin-analytics" },
    { to: "/notifications", label: "Notifications", icon: "fas fa-bell", key: "notifications", badge: unreadCount },
  ];

  const currentNav =
    isAdmin
      ? adminNav
      : role === "organizer"
      ? organizerNav
      : isRecipient
      ? recipientNav
      : donorNav;

  return (
    <div className="min-h-screen flex bg-[#f8fafc] text-slate-800 antialiased font-sans">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Deep Navy Left Sidebar matching screenshots */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-60 min-w-[15rem] bg-[#0e2439] text-white flex flex-col shrink-0 shadow-xl transition-transform duration-200 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Logo matching exact REDhope brand */}
        <div className="h-16 px-5 flex items-center justify-between shrink-0">
          <Link to="/" className="text-2xl font-black tracking-tight flex items-center">
            <span className="text-[#e60023]">RED</span>
            <span className="text-white">hope</span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-2 cursor-pointer"
            aria-label="Close sidebar"
          >
            <i className="fas fa-times text-lg" />
          </button>
        </div>

        {/* User Identity Banner matching screenshot */}
        <div className="px-5 py-3 border-t border-b border-white/5 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#e60023] text-white flex items-center justify-center text-sm shadow-sm shrink-0">
            <i className="fas fa-shield-halved" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-xs text-white truncate leading-tight">
              {isAdmin ? "Admin Dashboard" : user?.name || "User Dashboard"}
            </div>
            <div className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
              {isAdmin ? "System Administrator" : role === "organizer" ? "Camp Organizer" : isRecipient ? "Person Seeking Blood" : "Blood Donor"}
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {currentNav.map((item) => {
            const isActive = activeNav
              ? activeNav === item.key
              : (item.to === "/"
                ? pathname === "/"
                : pathname === item.to || pathname.startsWith(item.to + "/"));
            return (
              <Link
                key={item.label + item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-[#e60023] text-white shadow-sm font-bold"
                    : "text-slate-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <i className={`${item.icon} w-4 text-center text-xs opacity-90`} />
                <span className="flex-1 truncate">{item.label}</span>
                {typeof item.badge === "number" && item.badge > 0 && (
                  <span className="bg-[#e60023] text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Sign-Out Button matching screenshots */}
        <div className="p-4 border-t border-white/5 shrink-0">
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-3 text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer w-full group py-1 px-1"
          >
            <i className="fas fa-right-from-bracket rotate-180 text-sm text-slate-400 group-hover:text-white transition-colors" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header Bar */}
        <header className="h-16 px-3 sm:px-6 bg-white border-b border-slate-200/80 flex items-center justify-between sticky top-0 z-30 shadow-2xs shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
              aria-label="Open sidebar"
              aria-expanded={sidebarOpen}
            >
              <i className="fas fa-bars text-lg" />
            </button>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400 hidden sm:inline">
              REDHOPE HEALTH PLATFORM
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Notification bell with red badge dot */}
            <Link
              to="/notifications"
              className="relative p-2 rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
              title="Notifications"
            >
              <i className="fas fa-bell text-base" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-600 rounded-full ring-2 ring-white" />
            </Link>

            {/* User Profile Pill with Avatar */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                  {user?.name?.charAt(0).toUpperCase() || (isAdmin ? "A" : "U")}
                </div>
                <span className="text-xs font-bold text-slate-800 hidden sm:inline">
                  {isAdmin ? "Admin" : user?.name?.split(" ")[0] || "User"}
                </span>
                <i className="fas fa-chevron-down text-[10px] text-slate-400" />
              </button>

              {/* Click-outside backdrop */}
              {adminMenuOpen && (
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setAdminMenuOpen(false)}
                  aria-hidden="true"
                />
              )}

              {/* Quick Dropdown Menu */}
              {adminMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900 truncate">{user?.name || "User"}</p>
                    <p className="text-[11px] text-slate-400 truncate">{user?.email || ""}</p>
                  </div>
                  {isAdmin ? (
                    <>
                      <Link
                        to="/admin"
                        onClick={() => setAdminMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <i className="fas fa-gauge w-4 text-slate-400" /> Command Center
                      </Link>
                      <Link
                        to="/admin/health-screenings"
                        onClick={() => setAdminMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <i className="fas fa-stethoscope w-4 text-slate-400" /> Review Queue
                      </Link>
                    </>
                  ) : role === "organizer" ? (
                    <>
                      <Link
                        to="/organizer"
                        onClick={() => setAdminMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <i className="fas fa-th-large w-4 text-slate-400" /> Camp Console
                      </Link>
                      <Link
                        to="/organizer/analytics"
                        onClick={() => setAdminMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <i className="fas fa-chart-line w-4 text-slate-400" /> Analytics
                      </Link>
                      <Link
                        to="/profile"
                        onClick={() => setAdminMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <i className="fas fa-user w-4 text-slate-400" /> Profile
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        to="/dashboard"
                        onClick={() => setAdminMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <i className="fas fa-th-large w-4 text-slate-400" /> Dashboard
                      </Link>
                      <Link
                        to="/profile"
                        onClick={() => setAdminMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <i className="fas fa-user w-4 text-slate-400" /> Profile
                      </Link>
                    </>
                  )}
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setAdminMenuOpen(false);
                      logout();
                    }}
                    className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    <i className="fas fa-sign-out-alt w-4 text-red-500" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Viewport Content */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-x-hidden min-w-0">{children}</main>
      </div>
    </div>
  );
}
