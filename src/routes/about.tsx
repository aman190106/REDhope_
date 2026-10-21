import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { useAuth } from "../lib/auth";
import missionImg from "../assets/mission.jpg";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About REDhope — Every Drop Counts" },
      {
        name: "description",
        content:
          "REDhope bridges the gap between life-saving donors and critical medical needs across India. Learn about our mission, impact and community.",
      },
      { property: "og:title", content: "About REDhope — Every Drop Counts" },
      {
        property: "og:description",
        content: "Our mission, impact, and lifesaving community.",
      },
    ],
  }),
  component: AboutPage,
});

const stats = [
  { icon: "fa-tint", num: "1", text: "Donation Can Save Up To 3 Lives" },
  { icon: "fa-users", num: "1%", text: "Of India's Population Donates Annually" },
  { icon: "fa-heartbeat", num: "15%", text: "Blood Supply Deficit in India" },
  { icon: "fa-clock", num: "2s", text: "Someone in India Needs Blood" },
];

const impact = [
  {
    icon: "fa-hospital",
    title: "For Hospitals",
    body: "Real-time inventory access to connect directly with camps and receive life-saving units faster.",
  },
  {
    icon: "fa-calendar-check",
    title: "For Organizers",
    body: "Streamlined planning to schedule camps, track sign-ups, manage resources, and send automated reminders.",
  },
  {
    icon: "fa-hand-holding-heart",
    title: "For Donors",
    body: "Easy discovery of camps near you with real-time location and eligibility tools.",
  },
];

const community = [
  {
    icon: "fa-hand-holding-water",
    title: "Be a Donor",
    body: "Register once, get notified about local camps, and earn digital badges for your contributions.",
    cta: "Register Now",
    to: "/donate" as const,
  },
  {
    icon: "fa-users",
    title: "Host a Camp",
    body: "From colleges to corporations—we provide free toolkits, certification, and volunteer support.",
    cta: "Get Started",
    to: "/organize" as const,
  },
  {
    icon: "fa-handshake",
    title: "Partner With Us",
    body: "Hospitals, NGOs, and brands: collaborate to scale your impact and save more lives.",
    cta: "Partner Now",
    to: "/contact" as const,
  },
];

function AboutPage() {
  const { user, isAuthenticated } = useAuth();

  return (
    <>
      <Navbar solid />

      <section className="hero hero-compact">
        <div className="hero-inner">
          <h1>Every Drop Counts. Every Life Matters.</h1>
          <p>
            Join India's largest youth-run blood donation organization. Together, we can
            save millions of lives by ensuring no one dies due to lack of blood.
          </p>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <div className="section-title">
            <h2>Our Mission</h2>
            <p>Bridging the gap between life-saving donors and critical medical needs</p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
              gap: "clamp(20px, 4vw, 40px)",
              alignItems: "center",
            }}
          >
            <div>
              <h3 style={{ color: "var(--secondary)", marginBottom: 16 }}>
                Creating a Blood-Secure India
              </h3>
              <p style={{ marginBottom: 14 }}>
                At REDhope, we bridge the gap between life-saving donors and critical
                medical needs. Our mission is to simplify blood donation camp
                organization, amplify community impact, and ensure no patient suffers due
                to blood shortages.
              </p>
              <p style={{ marginBottom: 14 }}>
                We believe that access to safe blood is a fundamental right, and we're
                committed to creating a robust network of voluntary blood donors who can
                be mobilized in times of need.
              </p>
              <p>
                Through innovative technology and community engagement, we're transforming
                the blood donation ecosystem in India.
              </p>
            </div>
            <div
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: 16,
                boxShadow: "0 16px 36px rgba(27, 54, 93, 0.16)",
              }}
            >
              <img
                src={missionImg}
                alt="Blood donation camp volunteers and donor"
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  borderRadius: 16,
                  transition: "transform 0.4s ease",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="features" style={{ background: "var(--light)" }}>
        <div className="container">
          <div className="section-title">
            <h2>Why Blood Donation?</h2>
            <p>Your single donation can save up to three lives</p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
              gap: 20,
            }}
          >
            {stats.map((s) => (
              <div
                key={s.text}
                className="feature-card"
                style={{ textAlign: "center", padding: 28 }}
              >
                <i
                  className={`fas ${s.icon}`}
                  style={{ fontSize: 38, color: "var(--primary)", marginBottom: 14 }}
                />
                <div
                  style={{
                    fontSize: "2.4rem",
                    fontWeight: 800,
                    color: "var(--secondary)",
                    fontFamily: "Montserrat",
                  }}
                >
                  {s.num}
                </div>
                <p style={{ marginTop: 8, color: "var(--gray)" }}>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <div className="section-title">
            <h2>Our Impact</h2>
            <p>Creating real change in the blood donation ecosystem</p>
          </div>
          <div className="features-grid">
            {impact.map((c) => (
              <div key={c.title} className="feature-card" style={{ padding: 30, textAlign: "center" }}>
                <i
                  className={`fas ${c.icon}`}
                  style={{ fontSize: 44, color: "var(--primary)", marginBottom: 16 }}
                />
                <h3 style={{ color: "var(--secondary)", marginBottom: 12 }}>{c.title}</h3>
                <p style={{ color: "var(--gray)" }}>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="features" style={{ background: "var(--light)" }}>
        <div className="container">
          <div className="section-title">
            <h2>Join Our Lifesaving Community</h2>
            <p>Become part of the solution to India's blood shortage</p>
          </div>
          <div className="features-grid">
            {community.map((c) => (
              <div key={c.title} className="feature-card" style={{ padding: 30, textAlign: "center" }}>
                <i
                  className={`fas ${c.icon}`}
                  style={{ fontSize: 44, color: "var(--primary)", marginBottom: 16 }}
                />
                <h3 style={{ color: "var(--secondary)", marginBottom: 12 }}>{c.title}</h3>
                <p style={{ color: "var(--gray)", marginBottom: 18 }}>{c.body}</p>
                <Link
                  to={!isAuthenticated && c.to === "/donate" ? "/register" : c.to}
                  className="btn"
                >
                  {c.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="container">
          <h2>Don't wait for a crisis to act</h2>
          <p>
            Plan a camp. Donate blood. Save lives today. Join our movement to eliminate
            blood shortages in India.
          </p>
          <div className="hero-buttons">
            <Link
              to={isAuthenticated ? "/dashboard" : "/register"}
              className="btn btn-large"
            >
              {isAuthenticated ? "My Dashboard" : "Register as Donor"}
            </Link>
            <Link
              to={isAuthenticated ? (user?.role === "organizer" ? "/organizer" : "/organize") : "/register"}
              className="btn btn-large"
              style={{ background: "var(--secondary)", color: "white" }}
            >
              Organize a Camp
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
