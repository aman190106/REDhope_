import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";

interface NavbarProps {
  /** When true, navbar always renders with the solid dark background. Defaults to true. */
  solid?: boolean;
}

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/camps", label: "Camps" },
  { to: "/organize", label: "Host a Camp" },
  { to: "/donations", label: "Donations" },
  { to: "/about", label: "About Us" },
  { to: "/stories", label: "Stories" },
  { to: "/eligibility", label: "Eligibility" },
  { to: "/matching", label: "Find Donors" },
  { to: "/contact", label: "Contact Us" },
];

export function Navbar({ solid = true }: NavbarProps) {
  const { user, isAuthenticated, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (solid) return;
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [solid]);

  // Fetch unread notification count when user is authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    api
      .get<{ success: boolean; count?: number; data?: { count: number } }>("/notifications/unread-count")
      .then((nCount) => {
        const cnt = typeof nCount?.count === "number" ? nCount.count : nCount?.data?.count;
        if (typeof cnt === "number") {
          setUnreadCount(cnt);
        }
      })
      .catch(() => {
        setUnreadCount(0);
      });
  }, [isAuthenticated, pathname]);

  // Close mobile menu on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const classes = ["site-nav"];
  if (solid) classes.push("solid");
  else if (scrolled) classes.push("scrolled");

  const isOrganizer = user?.role === "organizer";
  const isAdmin = user?.role === "admin";
  const isRecipient = !isOrganizer && !isAdmin && user?.isDonorAvailable === false;
  const isDonor = !isOrganizer && !isAdmin && user?.isDonorAvailable !== false;

  const getNavLinks = () => {
    if (!isAuthenticated) {
      return [
        { to: "/", label: "Home" },
        { to: "/camps", label: "Camps" },
        { to: "/matching", label: "Find Donors" },
        { to: "/eligibility", label: "Eligibility" },
        { to: "/about", label: "About Us" },
        { to: "/stories", label: "Stories" },
        { to: "/contact", label: "Contact Us" },
      ];
    }

    if (isAdmin) {
      return [
        { to: "/admin", label: "Admin Dashboard" },
        { to: "/admin/health-screenings", label: "Review Queue" },
        { to: "/camps", label: "Camps" },
      ];
    }

    if (isOrganizer) {
      return [
        { to: "/", label: "Home" },
        { to: "/organize", label: "Host a Camp" },
        { to: "/camps", label: "Camps" },
        { to: "/organizer/analytics", label: "Analytics" },
        { to: "/about", label: "About Us" },
        { to: "/stories", label: "Stories" },
        { to: "/contact", label: "Contact Us" },
      ];
    }

    if (isRecipient) {
      return [
        { to: "/", label: "Home" },
        { to: "/matching", label: "Find Donors" },
        { to: "/camps", label: "Nearby Camps" },
        { to: "/about", label: "About Us" },
        { to: "/stories", label: "Stories" },
        { to: "/contact", label: "Contact Us" },
      ];
    }

    // Default Donor Experience
    return [
      { to: "/", label: "Home" },
      { to: "/camps", label: "Camps" },
      { to: "/donations", label: "Donations" },
      { to: "/eligibility", label: "Eligibility" },
      { to: "/about", label: "About Us" },
      { to: "/stories", label: "Stories" },
      { to: "/contact", label: "Contact Us" },
    ];
  };

  const navLinks = getNavLinks();

  return (
    <nav className={classes.join(" ")}>
      <div className="nav-container">
        <Link to="/" className="logo-text" aria-label="REDhope home">
          RED<span>hope</span>
        </Link>
        <button
          className="mobile-toggle"
          aria-label="Toggle navigation menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <i className={`fas ${open ? "fa-times" : "fa-bars"}`} />
        </button>
        <ul className={`nav-menu${open ? " active" : ""}`}>
          {navLinks.map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                className={pathname === l.to ? "active" : ""}
              >
                {l.label}
              </Link>
            </li>
          ))}


          {isAuthenticated ? (
            <>
              {/* Profile — non-admin only */}
              {!isAdmin && (
                <li>
                  <Link
                    to="/profile"
                    className={pathname === "/profile" ? "active" : ""}
                  >
                    Profile
                  </Link>
                </li>
              )}

              {/* Notifications bell */}
              <li>
                <Link
                  to="/notifications"
                  className={pathname === "/notifications" ? "active" : ""}
                    aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
                    title="Notifications"
                    style={{
                      position: "relative",
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "4px 8px",
                    }}
                  >
                    <i className="fas fa-bell" style={{ fontSize: "1.15rem" }} />
                    {open && <span style={{ marginLeft: 8 }}>Notifications</span>}
                    {unreadCount > 0 && (
                      <span
                        style={{
                          position: open ? "static" : "absolute",
                          marginLeft: open ? 8 : 0,
                          top: open ? "auto" : "-4px",
                          right: open ? "auto" : "-4px",
                          backgroundColor: "#e63946",
                          color: "#ffffff",
                          fontSize: "10px",
                          fontWeight: 700,
                          lineHeight: "14px",
                          minWidth: "16px",
                          height: "16px",
                          borderRadius: "8px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "0 4px",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                        }}
                      >
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Link>
                </li>

              {/* Role badge — non-admin only */}
              {!isAdmin && (
                <li style={{ display: "inline-flex", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      padding: "2px 8px",
                      borderRadius: 10,
                      backgroundColor: isOrganizer ? "rgba(245, 158, 11, 0.2)" : isRecipient ? "rgba(59, 130, 246, 0.2)" : "rgba(239, 68, 68, 0.2)",
                      color: isOrganizer ? "#fbbf24" : isRecipient ? "#93c5fd" : "#fca5a5",
                      letterSpacing: 0.5,
                    }}
                  >
                    {isOrganizer ? "Organizer" : isRecipient ? "Recipient" : "Donor"}
                  </span>
                </li>
              )}

              {/* Dashboard button — non-admin only */}
              {!isAdmin && (
                <li>
                  <Link
                    to={isOrganizer ? "/organizer" : "/dashboard"}
                    className="nav-btn nav-btn-primary"
                  >
                    <i className="fas fa-th-large" style={{ marginRight: 6 }} />
                    Dashboard
                  </Link>
                </li>
              )}

              <li>
                <button
                  type="button"
                  onClick={logout}
                  className="nav-btn nav-btn-logout"
                >
                  <i className="fas fa-sign-out-alt" style={{ marginRight: 6 }} />
                  <span>Logout</span>
                </button>
              </li>
            </>
          ) : (
            <>
              <li>
                <Link
                  to="/login"
                  className={pathname === "/login" ? "active" : ""}
                  style={{ fontWeight: 600 }}
                >
                  Sign In
                </Link>
              </li>
              <li>
                <Link to="/register" className="btn" style={{ padding: "8px 18px", fontSize: 14 }}>
                  Register
                </Link>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
}
