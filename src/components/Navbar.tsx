import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";

interface NavbarProps {
  /** When true, navbar always renders with the solid dark background (used on pages without a hero). */
  solid?: boolean;
}

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/camps", label: "Camps" },
  { to: "/donations", label: "Donations" },
  { to: "/about", label: "About Us" },
  { to: "/stories", label: "Stories" },
  { to: "/eligibility", label: "Eligibility" },
  { to: "/matching", label: "Find Donors" },
  { to: "/contact", label: "Contact Us" },
];

export function Navbar({ solid = false }: NavbarProps) {
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
      .get<{ success: boolean; count: number }>("/notifications/unread-count")
      .then((nCount) => {
        if (nCount?.success && typeof nCount.count === "number") {
          setUnreadCount(nCount.count);
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

  const isOrganizerOrAdmin = user?.role === "organizer" || user?.role === "admin";

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

          {isOrganizerOrAdmin && (
            <li>
              <Link
                to="/organizer"
                className={pathname.startsWith("/organizer") ? "active" : ""}
                style={{ color: "#ffc107" }}
              >
                <i className="fas fa-gauge-high" style={{ marginRight: 6 }} />
                Organizer
              </Link>
            </li>
          )}

          {user?.role === "admin" && (
            <li>
              <Link
                to="/admin/health-screenings"
                className={pathname.startsWith("/admin/health-screenings") ? "active" : ""}
                style={{ color: "#60a5fa" }}
              >
                <i className="fas fa-stethoscope" style={{ marginRight: 6 }} />
                Screenings
              </Link>
            </li>
          )}

          {isAuthenticated ? (
            <>
              <li>
                <Link
                  to="/profile"
                  className={pathname === "/profile" ? "active" : ""}
                >
                  Profile
                </Link>
              </li>

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

              <li>
                <Link to="/dashboard" className="btn" style={{ padding: "8px 18px", fontSize: 14 }}>
                  Dashboard
                </Link>
              </li>

              <li>
                <button
                  type="button"
                  onClick={logout}
                  className="btn btn-outline"
                  style={{
                    padding: "7px 14px",
                    fontSize: 13,
                    borderColor: "rgba(255,255,255,0.4)",
                    color: "inherit",
                    cursor: "pointer",
                  }}
                >
                  <i className="fas fa-sign-out-alt" style={{ marginRight: 4 }} /> Logout
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
