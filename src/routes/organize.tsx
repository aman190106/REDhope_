import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { toast } from "../components/AppToaster";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/organize")({
  head: () => ({
    meta: [
      { title: "Organize a Camp — REDhope" },
      {
        name: "description",
        content:
          "Organize a blood donation camp with REDhope. Register your camp and we'll help you with toolkits, volunteers and logistics.",
      },
      { property: "og:title", content: "Organize a Camp — REDhope" },
      {
        property: "og:description",
        content: "Register your organization to host a REDhope blood donation camp.",
      },
    ],
  }),
  component: OrganizePage,
});

function OrganizePage() {
  const { user, isAuthenticated } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated && user && user.role !== "organizer" && user.role !== "admin") {
    return (
      <>
        <Navbar solid />
        <section className="features" style={{ minHeight: "70vh", display: "flex", alignItems: "center" }}>
          <div className="container" style={{ maxWidth: 540, margin: "40px auto", textAlign: "center" }}>
            <div className="form-section">
              <i className="fas fa-tent fa-3x" style={{ color: "var(--primary)", marginBottom: 16 }} />
              <h2 style={{ marginBottom: 8 }}>Organizer Access Required</h2>
              <p style={{ color: "var(--gray)", marginBottom: 24, lineHeight: 1.6 }}>
                You are currently signed in as a <strong>{user.isDonorAvailable === false ? "Blood Recipient" : "Blood Donor"}</strong>. Hosting and managing blood donation camps is reserved for verified Camp Organizers.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <Link to="/dashboard" className="btn">
                  My Dashboard
                </Link>
                <Link to="/camps" className="btn btn-outline">
                  Browse Camps
                </Link>
              </div>
            </div>
          </div>
        </section>
        <Footer />
      </>
    );
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Camp registration submitted! Our team will contact you within 24–48 hours.");
      (e.target as HTMLFormElement).reset();
    }, 700);
  };

  return (
    <>
      <Navbar solid />

      <section className="hero hero-compact" style={{ minHeight: "40vh" }}>
        <div className="hero-inner">
          <h1>Organize a Blood Donation Camp</h1>
          <p>
            Host a camp with REDhope. We provide free toolkits, certification, and
            volunteer support to make your camp a success.
          </p>
        </div>
      </section>

      <section className="features" style={{ paddingTop: 40 }}>
        <div className="container">
          <div className="section-title">
            <h2>Camp Registration Form</h2>
            <p>Fill in the details below and our team will reach out to finalize arrangements.</p>
          </div>

          <form onSubmit={onSubmit} style={{ maxWidth: 900, margin: "0 auto" }}>
            <div className="form-section">
              <h3><i className="fas fa-info-circle" /> Camp Details</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label className="required-field">Organizer's Full Name</label>
                  <input required />
                </div>
                <div className="form-group">
                  <label className="required-field">Organization Name</label>
                  <input required />
                </div>
                <div className="form-group">
                  <label className="required-field">Email Address</label>
                  <input type="email" required />
                </div>
                <div className="form-group">
                  <label className="required-field">Contact Number</label>
                  <input type="tel" required />
                </div>
                <div className="form-group">
                  <label className="required-field">Event Date</label>
                  <input type="date" required />
                </div>
                <div className="form-group">
                  <label className="required-field">Expected Donors</label>
                  <select required defaultValue="">
                    <option value="" disabled>Select number</option>
                    <option>50–100</option>
                    <option>100–200</option>
                    <option>200–300</option>
                    <option>300+</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="required-field">Start Time</label>
                  <input type="time" required />
                </div>
                <div className="form-group">
                  <label className="required-field">End Time</label>
                  <input type="time" required />
                </div>
                <div className="form-group full-width">
                  <label>Camp Name / Theme</label>
                  <input placeholder="e.g. Blood Donation Drive 2025" />
                </div>
                <div className="form-group full-width">
                  <label className="required-field">Venue Address</label>
                  <textarea required placeholder="Full address of the camp venue" />
                </div>
                <div className="form-group full-width">
                  <label>Additional Information</label>
                  <textarea placeholder="Any special requirements, parking instructions, etc." />
                </div>
              </div>
            </div>

            <div style={{ textAlign: "center", marginTop: 10 }}>
              <p style={{ color: "var(--gray)", marginBottom: 20, fontSize: 14 }}>
                By submitting this form, you agree to our terms and conditions. Our team
                will contact you within 24–48 hours.
              </p>
              <button type="submit" className="btn btn-large" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Registration"}
              </button>
            </div>
          </form>
        </div>
      </section>

      <Footer />
    </>
  );
}
