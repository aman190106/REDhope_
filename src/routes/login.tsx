import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { useAuth } from "../lib/auth";
import { toast } from "../components/AppToaster";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — REDhope" },
      {
        name: "description",
        content: "Sign in to your REDhope account to manage blood donations and camps.",
      },
      { property: "og:title", content: "Sign In — REDhope" },
      { property: "og:description", content: "Access your REDhope donor account." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    try {
      setIsSubmitting(true);
      const loggedUser = await login(trimmedEmail, password);
      toast.success(`Welcome back, ${loggedUser.name}!`);

      if (loggedUser.role === "admin" || loggedUser.role === "organizer") {
        navigate({ to: "/organizer" });
      } else {
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      const msg = err.message || "Failed to log in. Please check your credentials.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthenticated && user) {
    return (
      <>
        <Navbar solid />
        <section className="features" style={{ minHeight: "70vh", display: "flex", alignItems: "center" }}>
          <div className="container" style={{ maxWidth: 500, margin: "40px auto", textAlign: "center" }}>
            <div className="form-section">
              <div style={{ fontSize: "3rem", color: "var(--success)", marginBottom: 16 }}>
                <i className="fas fa-check-circle" />
              </div>
              <h2 style={{ marginBottom: 8 }}>Already Signed In</h2>
              <p style={{ color: "var(--gray)", marginBottom: 24 }}>
                You are currently signed in as <strong>{user.name}</strong> ({user.email}).
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <Link to="/dashboard" className="btn">
                  Go to Dashboard
                </Link>
                <Link to="/profile" className="btn btn-outline">
                  My Profile
                </Link>
              </div>
            </div>
          </div>
        </section>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar solid />

      <section className="hero hero-compact" style={{ minHeight: "30vh", padding: "60px 0 40px" }}>
        <div className="hero-inner">
          <h1>Sign In to REDhope</h1>
          <p>Access your donor history, registered camps, and eligibility status.</p>
        </div>
      </section>

      <section className="features" style={{ padding: "40px 0 80px" }}>
        <div className="container">
          <div className="form-section" style={{ maxWidth: 460, margin: "0 auto", padding: "32px 28px" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(230, 57, 70, 0.1)",
                  color: "var(--primary)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  marginBottom: 12,
                }}
              >
                <i className="fas fa-user-lock" />
              </div>
              <h3 style={{ fontSize: "1.4rem", margin: 0 }}>Welcome Back</h3>
              <p style={{ color: "var(--gray)", fontSize: 14, margin: "6px 0 0" }}>
                Enter your credentials to continue
              </p>
            </div>

            {errorMsg && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 6,
                  backgroundColor: "#fee2e2",
                  color: "#991b1b",
                  marginBottom: 20,
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <i className="fas fa-exclamation-circle" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: 18 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                  <i className="fas fa-envelope" style={{ marginRight: 6, color: "var(--primary)" }} />
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    fontSize: 15,
                  }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 24 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                  <i className="fas fa-lock" style={{ marginRight: 6, color: "var(--primary)" }} />
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 40px 10px 14px",
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      fontSize: 15,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#6b7280",
                      cursor: "pointer",
                    }}
                  >
                    <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn"
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: 16,
                  fontWeight: 600,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 8,
                  opacity: isSubmitting ? 0.7 : 1,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {isSubmitting ? (
                  <>
                    <i className="fas fa-circle-notch fa-spin" />
                    Signing In...
                  </>
                ) : (
                  <>
                    <i className="fas fa-arrow-right" />
                    Sign In
                  </>
                )}
              </button>
            </form>

            <div
              style={{
                marginTop: 24,
                paddingTop: 20,
                borderTop: "1px solid #e5e7eb",
                textAlign: "center",
                fontSize: 14,
                color: "#4b5563",
              }}
            >
              Don't have an account yet?{" "}
              <Link to="/register" style={{ color: "var(--primary)", fontWeight: 600 }}>
                Register as Donor
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}

