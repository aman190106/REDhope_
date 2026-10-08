import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

interface NavbarProps {
  /** When true, navbar always renders with the solid dark background (used on pages without a hero). */
  solid?: boolean;
}

const links = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About Us" },
  { to: "/stories", label: "Stories" },
  { to: "/eligibility", label: "Eligibility" },
  { to: "/contact", label: "Contact Us" },
  { to: "/profile", label: "Profile" },
];

export function Navbar({ solid = false }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (solid) return;
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [solid]);

  // Close mobile menu on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const classes = ["site-nav"];
  if (solid) classes.push("solid");
  else if (scrolled) classes.push("scrolled");

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
          {links.map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                className={pathname === l.to ? "active" : ""}
              >
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <Link to="/dashboard" className="btn" style={{ padding: "10px 22px" }}>
              Dashboard
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
