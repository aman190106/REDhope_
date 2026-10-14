import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { useAuth } from "../lib/auth";
import { toast } from "../components/AppToaster";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Register as Donor — REDhope" },
      {
        name: "description",
        content: "Join India's blood donor network. Register as a verified blood donor on REDhope.",
      },
      { property: "og:title", content: "Register as Donor — REDhope" },
      { property: "og:description", content: "Sign up as a blood donor on REDhope." },
    ],
  }),
  component: RegisterPage,
});

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function RegisterPage() {
  const { register, login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [accountType, setAccountType] = useState<"donor" | "organizer" | "recipient">("donor");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    bloodGroup: "O+",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const { name, email, password, confirmPassword, phone, bloodGroup } = formData;

    if (!name.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (!email.trim()) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (!phone || !/^[6-9]\d{9}$/.test(phone.trim())) {
      setErrorMsg("Please enter a valid 10-digit mobile number (starting with 6, 7, 8, or 9).");
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }
    if (!BLOOD_GROUPS.includes(bloodGroup)) {
      setErrorMsg("Please select a valid blood group.");
      return;
    }

    try {
      setIsSubmitting(true);
      const isOrganizer = accountType === "organizer";
      const isDonor = accountType === "donor";

      const registeredUser = await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim(),
        bloodGroup,
        role: isOrganizer ? "organizer" : "user",
        isDonorAvailable: isDonor,
      });

      // Seamlessly log the newly registered user in
      try {
        await login(email.trim().toLowerCase(), password);
        toast.success(`Account created! Welcome to REDhope, ${registeredUser.name}!`);
        if (isOrganizer) {
          navigate({ to: "/organizer" });
        } else {
          navigate({ to: "/dashboard" });
        }
      } catch {
        toast.success("Account created successfully! Please sign in.");
        navigate({ to: "/login" });
      }
    } catch (err: any) {
      const msg = err.message || "Registration failed. Please check your details.";
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
              <h2 style={{ marginBottom: 8 }}>Already Registered</h2>
              <p style={{ color: "var(--gray)", marginBottom: 24 }}>
                You are currently signed in as <strong>{user.name}</strong> ({user.bloodGroup}).
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <Link
                  to={user.role === "organizer" || user.role === "admin" ? "/organizer" : "/dashboard"}
                  className="btn"
                >
                  Go to Dashboard
                </Link>
                <Link to="/profile" className="btn btn-outline">
                  View Profile
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

      <section className="hero hero-compact" style={{ minHeight: "26vh", padding: "50px 0 30px" }}>
        <div className="hero-inner">
          <h1 style={{ fontSize: "2.4rem", marginBottom: 8 }}>Create Your Account</h1>
          <p style={{ fontSize: "1.05rem", opacity: 0.9 }}>Join REDhope and be part of a stronger, healthier India.</p>
        </div>
      </section>

      <section className="features" style={{ padding: "30px 0 80px" }}>
        <div className="container">
          <div className="form-section" style={{ maxWidth: 580, margin: "0 auto", padding: "32px 28px" }}>
            {/* Register As Role Selector */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ textAlign: "center", marginBottom: 14 }}>
                <h3 style={{ fontSize: "1.25rem", margin: 0, fontWeight: 700 }}>Register As</h3>
                <p style={{ color: "var(--gray)", fontSize: 13, margin: "4px 0 0" }}>
                  Choose how you want to be part of REDhope
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: 12,
                }}
              >
                {/* 1. Blood Donor */}
                <button
                  type="button"
                  onClick={() => setAccountType("donor")}
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    padding: "16px 14px",
                    borderRadius: 10,
                    border: accountType === "donor" ? "2px solid #e63946" : "1.5px solid #e2e8f0",
                    background: accountType === "donor" ? "#fef2f2" : "#ffffff",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s ease",
                  }}
                >
                  {accountType === "donor" && (
                    <span
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        backgroundColor: "#e63946",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                      }}
                    >
                      <i className="fas fa-check" />
                    </span>
                  )}
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      backgroundColor: accountType === "donor" ? "rgba(230, 57, 70, 0.15)" : "#f1f5f9",
                      color: accountType === "donor" ? "#e63946" : "#64748b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      marginBottom: 10,
                    }}
                  >
                    <i className="fas fa-heart" />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 2 }}>
                    Blood Donor
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.3 }}>
                    Donate blood and save lives
                  </div>
                </button>

                {/* 2. Camp Organizer */}
                <button
                  type="button"
                  onClick={() => setAccountType("organizer")}
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    padding: "16px 14px",
                    borderRadius: 10,
                    border: accountType === "organizer" ? "2px solid #e63946" : "1.5px solid #e2e8f0",
                    background: accountType === "organizer" ? "#fef2f2" : "#ffffff",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s ease",
                  }}
                >
                  {accountType === "organizer" && (
                    <span
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        backgroundColor: "#e63946",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                      }}
                    >
                      <i className="fas fa-check" />
                    </span>
                  )}
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      backgroundColor: accountType === "organizer" ? "rgba(230, 57, 70, 0.15)" : "#f1f5f9",
                      color: accountType === "organizer" ? "#e63946" : "#64748b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      marginBottom: 10,
                    }}
                  >
                    <i className="fas fa-hospital" />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 2 }}>
                    Camp Organizer
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.3 }}>
                    Host blood donation camps
                  </div>
                </button>

                {/* 3. Need Blood */}
                <button
                  type="button"
                  onClick={() => setAccountType("recipient")}
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    padding: "16px 14px",
                    borderRadius: 10,
                    border: accountType === "recipient" ? "2px solid #e63946" : "1.5px solid #e2e8f0",
                    background: accountType === "recipient" ? "#fef2f2" : "#ffffff",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s ease",
                  }}
                >
                  {accountType === "recipient" && (
                    <span
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        backgroundColor: "#e63946",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                      }}
                    >
                      <i className="fas fa-check" />
                    </span>
                  )}
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      backgroundColor: accountType === "recipient" ? "rgba(230, 57, 70, 0.15)" : "#f1f5f9",
                      color: accountType === "recipient" ? "#e63946" : "#64748b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      marginBottom: 10,
                    }}
                  >
                    <i className="fas fa-users" />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 2 }}>
                    Need Blood
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.3 }}>
                    Find donors and available blood
                  </div>
                </button>
              </div>
            </div>

            {/* Form Header */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: "rgba(230, 57, 70, 0.1)",
                  color: "var(--primary)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  marginBottom: 10,
                }}
              >
                {accountType === "organizer" ? (
                  <i className="fas fa-hospital" />
                ) : accountType === "recipient" ? (
                  <i className="fas fa-users" />
                ) : (
                  <i className="fas fa-heart" />
                )}
              </div>
              <h3 style={{ fontSize: "1.35rem", margin: 0, fontWeight: 700 }}>
                {accountType === "organizer"
                  ? "Organizer Registration"
                  : accountType === "recipient"
                  ? "Recipient Registration"
                  : "Donor Registration"}
              </h3>
              <p style={{ color: "var(--gray)", fontSize: 14, margin: "6px 0 0" }}>
                {accountType === "organizer"
                  ? "Register your organization to host blood donation drives"
                  : accountType === "recipient"
                  ? "Quick registration to connect with matching donors in urgent need"
                  : "Quick registration to join India's blood hero network"}
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
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                  <i className="fas fa-user" style={{ marginRight: 6, color: "var(--primary)" }} />
                  Full Name *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Aman Sharma"
                  value={formData.name}
                  onChange={handleChange}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    fontSize: 15,
                  }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                  <i className="fas fa-envelope" style={{ marginRight: 6, color: "var(--primary)" }} />
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    fontSize: 15,
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                <div className="form-group">
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                    <i className="fas fa-phone" style={{ marginRight: 6, color: "var(--primary)" }} />
                    Phone (10 digits) *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, phone: e.target.value.replace(/\D/g, "") }))
                    }
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      fontSize: 15,
                    }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                    <i className="fas fa-tint" style={{ marginRight: 6, color: "var(--primary)" }} />
                    {accountType === "recipient" ? "Blood Group Needed *" : "Blood Group *"}
                  </label>
                  <select
                    name="bloodGroup"
                    value={formData.bloodGroup}
                    onChange={handleChange}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      fontSize: 15,
                      backgroundColor: "white",
                    }}
                  >
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
                <div className="form-group">
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                    <i className="fas fa-lock" style={{ marginRight: 6, color: "var(--primary)" }} />
                    Password *
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      required
                      placeholder="Min 6 characters"
                      value={formData.password}
                      onChange={handleChange}
                      style={{
                        width: "100%",
                        padding: "10px 36px 10px 14px",
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
                        right: 10,
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

                <div className="form-group">
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
                    <i className="fas fa-check-double" style={{ marginRight: 6, color: "var(--primary)" }} />
                    Confirm *
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="confirmPassword"
                    required
                    placeholder="Re-type password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      fontSize: 15,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: "10px 14px",
                  background: "#eff6ff",
                  borderRadius: 6,
                  border: "1px solid #bfdbfe",
                  fontSize: 12,
                  color: "#1e40af",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <i className="fas fa-shield-alt" style={{ color: "#2563eb", fontSize: 14 }} />
                <span>Your information is secure and will only be used to support blood donation activities.</span>
              </div>

              <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#475569" }}>
                <input type="checkbox" id="termsCheck" required defaultChecked style={{ accentColor: "var(--primary)" }} />
                <label htmlFor="termsCheck">
                  I agree to the <Link to="/about" style={{ color: "var(--primary)", fontWeight: 600 }}>Terms of Service</Link> and <Link to="/about" style={{ color: "var(--primary)", fontWeight: 600 }}>Privacy Policy</Link>
                </label>
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
                    Creating Account...
                  </>
                ) : (
                  <>
                    <span>
                      {accountType === "organizer"
                        ? "Create Organizer Account"
                        : accountType === "recipient"
                        ? "Create Recipient Account"
                        : "Create Donor Account"}
                    </span>
                    <i className="fas fa-arrow-right" style={{ fontSize: 13 }} />
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
              Already have an account?{" "}
              <Link to="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}

