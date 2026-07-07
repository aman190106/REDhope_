import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { toast } from "../components/AppToaster";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Donor Dashboard — REDhope" },
      {
        name: "description",
        content:
          "REDhope donor dashboard: log in with your mobile OTP to see your donation history, blood group, and eligibility.",
      },
      { property: "og:title", content: "Donor Dashboard — REDhope" },
      { property: "og:description", content: "Track your donations and eligibility." },
    ],
  }),
  component: DashboardPage,
});

interface HistoryEntry {
  date: string;
  location: string;
}

const donations: HistoryEntry[] = [
  { date: "12 June, 2025", location: "City Blood Bank, Bangalore" },
  { date: "15 March, 2025", location: "Red Cross Camp, MG Road" },
  { date: "10 December, 2024", location: "Government Hospital, Whitefield" },
  { date: "25 August, 2024", location: "Community Center, Koramangala" },
  { date: "5 May, 2024", location: "Corporate Camp, Tech Park" },
  { date: "12 January, 2024", location: "City Blood Bank, Bangalore" },
  { date: "15 October, 2023", location: "Red Cross Camp, MG Road" },
];

function DashboardPage() {
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!otpSent || authed) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [otpSent, authed]);

  const sendOtp = () => {
    if (!/^\d{10}$/.test(mobile)) {
      toast.error("Enter a valid 10-digit mobile number.");
      return;
    }
    setOtpSent(true);
    setTimeLeft(120);
    toast.success("OTP sent via WhatsApp (demo: use 123456).");
  };

  const verify = () => {
    if (otp === "123456") {
      setAuthed(true);
      toast.success("Welcome back, Aman!");
    } else {
      toast.error("Invalid OTP. Try 123456 for the demo.");
    }
  };

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");

  return (
    <>
      <Navbar solid />

      <section className="hero hero-compact" style={{ minHeight: "40vh" }}>
        <div className="hero-inner">
          <h1>Donor Dashboard</h1>
          <p>Track your donations, view eligibility, and stay ready to save lives.</p>
        </div>
      </section>

      <section className="features">
        <div className="container">
          {!authed ? (
            <div className="form-section" style={{ maxWidth: 460, margin: "0 auto" }}>
              <h3><i className="fas fa-user-shield" /> Donor Authentication</h3>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label><i className="fas fa-mobile-alt" /> Mobile Number</label>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                  disabled={otpSent}
                />
              </div>

              {otpSent && (
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label><i className="fas fa-lock" /> OTP</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 13, color: "var(--gray)" }}>
                    <span><i className="fas fa-clock" /> {mm}:{ss}</span>
                    {timeLeft === 0 && (
                      <button
                        type="button"
                        onClick={sendOtp}
                        style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontWeight: 600 }}
                      >
                        <i className="fas fa-redo" /> Resend OTP
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!otpSent ? (
                <button className="btn" style={{ width: "100%" }} onClick={sendOtp}>
                  <i className="fab fa-whatsapp" /> Send OTP via WhatsApp
                </button>
              ) : (
                <button className="btn" style={{ width: "100%" }} onClick={verify}>
                  Verify & Continue
                </button>
              )}

              <p style={{ marginTop: 14, fontSize: 12, color: "var(--gray)", textAlign: "center" }}>
                <i className="fas fa-shield-alt" /> Secured demo login (OTP: 123456)
              </p>
            </div>
          ) : (
            <div style={{ maxWidth: 1000, margin: "0 auto" }}>
              <div
                className="form-section"
                style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", flexWrap: "wrap", gap: 16,
                }}
              >
                <div>
                  <h2 style={{ color: "var(--secondary)" }}>Welcome back, Aman!</h2>
                  <p style={{ color: "var(--gray)" }}>
                    Thank you for being a life-saver. Your contributions make a difference.
                  </p>
                </div>
                <div
                  style={{
                    background: "var(--primary)", color: "white",
                    padding: "10px 20px", borderRadius: 30, fontWeight: 700,
                  }}
                >
                  <i className="fas fa-medal" /> Hero Donor
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
                  gap: 24,
                }}
              >
                <div className="form-section">
                  <h3><i className="fas fa-user-circle" /> Personal Information</h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
                      gap: 14,
                    }}
                  >
                    <InfoCard label="Blood Group">
                      <span style={{ fontSize: "2rem", fontWeight: 800, color: "var(--primary)" }}>B+</span>
                    </InfoCard>
                    <InfoCard label="Age">19 years</InfoCard>
                    <InfoCard label="Date of Birth">19 Jan, 2006</InfoCard>
                    <InfoCard label="Height">175 cm</InfoCard>
                    <InfoCard label="Phone"><i className="fas fa-phone" /> +91 79845 10xxx</InfoCard>
                    <InfoCard label="Location"><i className="fas fa-map-marker-alt" /> PARUL University</InfoCard>
                  </div>
                  <div style={{ marginTop: 20, padding: 20, background: "var(--light)", borderRadius: 8, textAlign: "center" }}>
                    <div style={{ fontSize: 14, color: "var(--gray)" }}>Total Donations</div>
                    <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "var(--primary)" }}>7 times</div>
                    <div style={{ color: "var(--success)", fontWeight: 600 }}>
                      <i className="fas fa-check-circle" /> Eligible to donate now
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3><i className="fas fa-history" /> Donation History</h3>
                  <div style={{ display: "grid", gap: 12 }}>
                    {donations.map((d, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex", justifyContent: "space-between",
                          alignItems: "center", padding: "12px 16px",
                          background: "var(--light)", borderRadius: 8, gap: 12,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--secondary)" }}>{d.date}</div>
                          <div style={{ fontSize: 13, color: "var(--gray)" }}>{d.location}</div>
                        </div>
                        <span
                          style={{
                            fontSize: 12, fontWeight: 700, color: "white",
                            background: "var(--success)", padding: "4px 10px",
                            borderRadius: 20,
                          }}
                        >Successful</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}

function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--light)", padding: 14, borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 12, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ color: "var(--secondary)", fontWeight: 600 }}>{children}</div>
    </div>
  );
}
