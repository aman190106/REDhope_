import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { toast } from "../components/AppToaster";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — REDhope" },
      {
        name: "description",
        content:
          "Get in touch with REDhope. Reach our helpline, email, or send us a message.",
      },
      { property: "og:title", content: "Contact REDhope" },
      { property: "og:description", content: "Helpline, email and message form." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Message sent! We'll respond within 24 hours.");
      (e.target as HTMLFormElement).reset();
    }, 700);
  };

  const infos = [
    { icon: "fa-map-marker-alt", title: "Visit Us", body: "PARUL University, Vadodara, Gujarat, India" },
    { icon: "fa-phone", title: "Helpline", body: "+91 79845 10xxx" },
    { icon: "fa-envelope", title: "Email", body: "info.redhope@gmail.com" },
    { icon: "fa-clock", title: "Hours", body: "Mon–Fri, 9 AM – 6 PM" },
  ];

  return (
    <>
      <Navbar solid />

      <section className="hero hero-compact" style={{ minHeight: "40vh" }}>
        <div className="hero-inner">
          <h1>Get in Touch</h1>
          <p>
            Questions, partnership ideas, or need urgent help? Reach out — we're here 24/7
            for life-saving requests.
          </p>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
              gap: 20,
              marginBottom: 40,
            }}
          >
            {infos.map((info) => (
              <div key={info.title} className="feature-card" style={{ padding: 26, textAlign: "center" }}>
                <i className={`fas ${info.icon}`} style={{ fontSize: 32, color: "var(--primary)", marginBottom: 12 }} />
                <h3 style={{ color: "var(--secondary)", fontSize: "1.2rem", marginBottom: 8 }}>{info.title}</h3>
                <p style={{ color: "var(--gray)" }}>{info.body}</p>
              </div>
            ))}
          </div>

          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <div className="section-title">
              <h2>Send us a Message</h2>
              <p>We'll get back to you within 24 hours.</p>
            </div>
            <form onSubmit={onSubmit} className="form-section">
              <div className="form-grid">
                <div className="form-group">
                  <label className="required-field">Your Name</label>
                  <input required />
                </div>
                <div className="form-group">
                  <label className="required-field">Email Address</label>
                  <input type="email" required />
                </div>
                <div className="form-group full-width">
                  <label className="required-field">Subject</label>
                  <input required />
                </div>
                <div className="form-group full-width">
                  <label className="required-field">Message</label>
                  <textarea required placeholder="How can we help?" />
                </div>
              </div>
              <div style={{ textAlign: "center", marginTop: 20 }}>
                <button type="submit" className="btn btn-large" disabled={submitting}>
                  {submitting ? "Sending..." : "Send Message"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
