import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { CounterSection } from "../components/CounterSection";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const PARTNERS = [
  {
    name: "AIIMS",
    category: "Medical Institute",
    icon: "/images/partners/aiims.png",
  },
  {
    name: "Fortis Healthcare",
    category: "Hospital Partner",
    icon: "/images/partners/fortis.png",
  },
  {
    name: "Red Cross",
    category: "Blood Bank Network",
    icon: "/images/partners/red-cross.png",
  },
  {
    name: "Apollo Hospitals",
    category: "Healthcare Network",
    icon: "/images/partners/apollo.png",
  },
  {
    name: "NGO Partner",
    category: "Community Support",
    icon: "/images/partners/ngo-partner.png",
  },
];

function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <Navbar solid />

      <section className="hero">
        <div className="hero-inner">
          <h1>Connecting Blood Donors with Those in Need</h1>
          <p>
            Join India's largest youth-run blood donation organization. Together, we can
            save millions of lives by ensuring no one dies due to lack of blood.
          </p>
          <div className="hero-buttons">
            <Link to="/camps" className="btn btn-large">Find Blood Camps</Link>
            <Link
              to={isAuthenticated ? "/dashboard" : "/register"}
              className="btn btn-outline btn-large"
              style={{ color: "white", borderColor: "white" }}
            >
              {isAuthenticated ? "My Dashboard" : "Register as Donor"}
            </Link>
          </div>
        </div>
        <button
          className="scroll-down"
          aria-label="Scroll to content"
          onClick={() =>
            document
              .querySelector(".counter-section")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          <i className="fas fa-chevron-down" />
        </button>
      </section>

      <CounterSection />

      <section className="features">
        <div className="container">
          <div className="section-title">
            <h2>How We Make a Difference</h2>
            <p>
              REDhope works tirelessly to bridge the gap between blood donors and
              recipients through innovative solutions and community engagement.
            </p>
          </div>
          <div className="features-grid">
            {[
              {
                img: "https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?auto=format&fit=crop&w=1080&q=80",
                title: "Emergency Blood Requests",
                body: "Our 24/7 helpline connects patients in urgent need with verified blood donors within minutes, saving lives when every second counts.",
              },
              {
                img: "https://images.unsplash.com/photo-1593113646773-028c64a8f1b8?auto=format&fit=crop&w=1080&q=80",
                title: "Blood Donation Camps",
                body: "We organize regular blood donation camps in colleges, corporate offices, and communities to maintain a sustainable blood supply.",
              },
              {
                img: "https://images.unsplash.com/photo-1584824486539-53bb4646bdbc?auto=format&fit=crop&w=1080&q=80",
                title: "Awareness Programs",
                body: "We conduct educational workshops to dispel myths about blood donation and encourage more people to become regular donors.",
              },
            ].map((f) => (
              <article key={f.title} className="feature-card">
                <div className="feature-img">
                  <img src={f.img} alt={f.title} loading="lazy" />
                </div>
                <div className="feature-content">
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                  <Link to="/about" className="btn btn-outline" style={{ marginTop: 10 }}>
                    Learn More
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="container">
          <h2>Ready to Save a Life?</h2>
          <p>
            Join thousands of heroes who have made a commitment to donate blood regularly
            and give the gift of life.
          </p>
          <div className="hero-buttons">
            <Link
              to={isAuthenticated ? "/dashboard" : "/register"}
              className="btn btn-large"
            >
              {isAuthenticated ? "Go to Dashboard" : "Register as a Donor"}
            </Link>
          </div>
        </div>
      </section>

      <section className="partners" aria-labelledby="partners-heading">
        <div className="container">
          <div className="section-title">
            <h2 id="partners-heading">Our Trusted Partners</h2>
            <p>We collaborate with leading healthcare organizations to maximize our impact and reach.</p>
          </div>
          <ul className="partners-grid" role="list">
            {PARTNERS.map((partner) => (
              <li key={partner.name} className="partner-card" role="listitem">
                <div className="partner-icon-wrapper">
                  <img
                    src={partner.icon}
                    alt={`${partner.name} — ${partner.category}`}
                    className="partner-icon"
                    width={76}
                    height={76}
                    loading="lazy"
                  />
                </div>
                <div className="partner-info">
                  <h3 className="partner-name">{partner.name}</h3>
                  <span className="partner-category">{partner.category}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Footer />
    </>
  );
}
