import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { toast } from "../components/AppToaster";
import { LocationPickerMap } from "../components/LocationPickerMap";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "User Profile — REDhope" },
      {
        name: "description",
        content: "View and update your REDhope profile and blood donor availability.",
      },
      { property: "og:title", content: "User Profile — REDhope" },
      { property: "og:description", content: "Manage your blood donor profile." },
    ],
  }),
  component: ProfilePage,
});

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

import { API_BASE_URL } from "../lib/api";
import { getEligibilityDisplay, type EligibilityEvaluation } from "../lib/eligibility";
const API_BASE = API_BASE_URL;

interface UserProfile {
  _id: string;
  name: string;
  email: string;
  phone: string;
  bloodGroup: string;
  role: "user" | "organizer" | "admin";
  dateOfBirth?: string;
  gender?: string;
  location?: {
    type?: string;
    coordinates?: [number, number]; // [longitude, latitude]
    city?: string;
    state?: string;
    pincode?: string;
  };
  isDonorAvailable: boolean;
  isEligible: boolean;
  lastDonationDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

function ProfilePage() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityEvaluation | null>(null);

  // Authentication form state (when unauthenticated)
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Editable form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("prefer_not_to_say");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [longitude, setLongitude] = useState("");
  const [latitude, setLatitude] = useState("");
  const [isDonorAvailable, setIsDonorAvailable] = useState(true);
  const [newPassword, setNewPassword] = useState("");

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("token") || localStorage.getItem("redhope_token");
    if (savedToken) {
      setToken(savedToken);
      fetchProfile(savedToken);
    } else {
      setLoading(false);
    }
  }, []);

  const populateForm = (data: UserProfile) => {
    setUser(data);
    setName(data.name || "");
    setPhone(data.phone || "");
    setBloodGroup(data.bloodGroup || "");
    setDateOfBirth(data.dateOfBirth ? data.dateOfBirth.slice(0, 10) : "");
    setGender(data.gender || "prefer_not_to_say");
    setCity(data.location?.city || "");
    setState(data.location?.state || "");
    setPincode(data.location?.pincode || "");
    if (data.location?.coordinates && data.location.coordinates.length === 2) {
      setLongitude(data.location.coordinates[0]?.toString() ?? "");
      setLatitude(data.location.coordinates[1]?.toString() ?? "");
    } else {
      setLongitude("");
      setLatitude("");
    }
    setIsDonorAvailable(data.isDonorAvailable ?? true);
    setNewPassword("");
  };

  const fetchProfile = async (authToken: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await res.json();

      if (res.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("redhope_token");
        setToken(null);
        setUser(null);
        toast.error("Session expired or unauthorized. Please sign in.");
        return;
      }

      if (!res.ok || !data.success) {
        toast.error(data.message || "Failed to load profile.");
        return;
      }

      populateForm(data.user);

      // Fetch unified medical eligibility evaluation
      try {
        const elRes = await fetch(`${API_BASE}/eligibility/me`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        const elJson = await elRes.json();
        if (elJson?.success && elJson.data) {
          setEligibility(elJson.data);
        }
      } catch (elErr) {
        console.warn("Failed to load medical eligibility evaluation", elErr);
      }
    } catch (err) {
      console.error(err);
      toast.error("Unable to connect to server. Please check your backend.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      toast.error("Email and password are required.");
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || "Invalid credentials.");
        return;
      }

      toast.success("Signed in successfully!");
      localStorage.setItem("token", data.token);
      setToken(data.token);
      setAuthPassword("");
      await fetchProfile(data.token);
    } catch (err) {
      console.error(err);
      toast.error("Could not reach the server.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("redhope_token");
    setToken(null);
    setUser(null);
    toast.success("Signed out successfully.");
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Please sign in first.");
      return;
    }

    // Validation
    if (name.trim().length < 2) {
      toast.error("Name must be at least 2 characters.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast.error("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    if (pincode && !/^[1-9][0-9]{5}$/.test(pincode)) {
      toast.error("Please enter a valid 6-digit Indian pincode.");
      return;
    }

    if (dateOfBirth) {
      const birth = new Date(dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      if (age < 18) {
        toast.error("Donor must be at least 18 years old.");
        return;
      }
    }

    // Build update payload
    const payload: Record<string, any> = {
      name: name.trim(),
      phone: phone.trim(),
      bloodGroup,
      gender,
      isDonorAvailable,
    };

    if (dateOfBirth) {
      payload.dateOfBirth = dateOfBirth;
    }

    const loc: Record<string, any> = {};
    if (city.trim()) loc.city = city.trim();
    if (state.trim()) loc.state = state.trim();
    if (pincode.trim()) loc.pincode = pincode.trim();

    if (longitude.trim() !== "" || latitude.trim() !== "") {
      const lng = parseFloat(longitude);
      const lat = parseFloat(latitude);
      if (isNaN(lng) || isNaN(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        toast.error("Valid coordinates must be longitude [-180, 180] and latitude [-90, 90].");
        return;
      }
      loc.coordinates = [lng, lat];
      loc.type = "Point";
    }

    if (Object.keys(loc).length > 0) {
      payload.location = loc;
    }

    if (newPassword.trim()) {
      if (newPassword.length < 6) {
        toast.error("New password must be at least 6 characters.");
        return;
      }
      payload.password = newPassword;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || "Failed to update profile.");
        return;
      }

      toast.success("Profile updated successfully!");
      populateForm(data.user);
    } catch (err) {
      console.error(err);
      toast.error("Error communicating with server.");
    } finally {
      setSaving(false);
    }
  };

  const eligibilityDisplay = getEligibilityDisplay(eligibility, user);

  return (
    <>
      <Navbar solid />

      <section className="hero hero-compact" style={{ minHeight: "35vh" }}>
        <div className="hero-inner">
          <h1>My Profile</h1>
          <p>Manage your personal details, blood donor preferences, and availability status.</p>
        </div>
      </section>

      <section className="features" style={{ backgroundColor: "var(--background)", minHeight: "60vh" }}>
        <div className="container">
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <i className="fas fa-spinner fa-spin fa-3x" style={{ color: "var(--primary)" }} />
              <p style={{ marginTop: 16, color: "var(--gray)", fontSize: 16 }}>Loading profile details...</p>
            </div>
          ) : !token || !user ? (
            /* Unauthenticated Login Form */
            <div className="form-section" style={{ maxWidth: 460, margin: "0 auto" }}>
              <h3>
                <i className="fas fa-lock" /> Sign In to Access Profile
              </h3>
              <p style={{ color: "var(--gray)", marginBottom: 20, fontSize: 14 }}>
                Enter your credentials to manage your REDhope donor account.
              </p>
              <form onSubmit={handleLogin}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="required-field">
                    <i className="fas fa-envelope" /> Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. john@example.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="required-field">
                    <i className="fas fa-key" /> Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn"
                  style={{ width: "100%" }}
                  disabled={authLoading}
                >
                  {authLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin" /> Signing In...
                    </>
                  ) : (
                    "Sign In to Profile"
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* Authenticated Profile View & Edit */
            <div style={{ maxWidth: 960, margin: "0 auto" }}>
              {/* Header Badge Card */}
              <div
                className="form-section"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 16,
                }}
              >
                <div>
                  <h2 style={{ color: "var(--secondary)", fontSize: "1.8rem" }}>
                    {user.name}
                  </h2>
                  <p style={{ color: "var(--gray)", fontSize: 14 }}>
                    <i className="fas fa-envelope" /> {user.email} &bull;{" "}
                    <i className="fas fa-shield-alt" /> Role:{" "}
                    <strong style={{ textTransform: "capitalize", color: "var(--secondary)" }}>
                      {user.role}
                    </strong>
                  </p>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  {/* Status Badges */}
                  <span
                    style={{
                      background: eligibilityDisplay.color,
                      color: "white",
                      padding: "8px 16px",
                      borderRadius: 20,
                      fontWeight: 700,
                      fontSize: 13,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <i className={eligibilityDisplay.icon} />
                    {eligibilityDisplay.badgeText}
                  </span>

                  <Link
                    to="/eligibility"
                    className="btn"
                    style={{ padding: "8px 16px", fontSize: 13 }}
                  >
                    <i className="fas fa-stethoscope" /> Check Eligibility
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="btn btn-outline"
                    style={{ padding: "8px 16px", fontSize: 13 }}
                  >
                    <i className="fas fa-sign-out-alt" /> Sign Out
                  </button>
                </div>
              </div>

              {/* Read-Only System Details Banner */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 16,
                  marginBottom: 25,
                }}
              >
                <div style={{ background: "white", padding: 18, borderRadius: 10, boxShadow: "var(--shadow)" }}>
                  <div style={{ fontSize: 12, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                    System Role
                  </div>
                  <div style={{ color: "var(--secondary)", fontWeight: 700, fontSize: 16, textTransform: "capitalize" }}>
                    <i className="fas fa-id-badge" style={{ color: "var(--primary)", marginRight: 6 }} />
                    {user.role} (System Protected)
                  </div>
                </div>

                <div style={{ background: "white", padding: 18, borderRadius: 10, boxShadow: "var(--shadow)" }}>
                  <div style={{ fontSize: 12, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                    Eligibility Status
                  </div>
                  <div style={{ color: eligibilityDisplay.color, fontWeight: 700, fontSize: 16 }}>
                    <i className={eligibilityDisplay.icon} style={{ marginRight: 6 }} />
                    {eligibilityDisplay.cardTitle}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--gray)", marginTop: 4 }}>
                    {eligibilityDisplay.linkTo ? (
                      <Link to={eligibilityDisplay.linkTo} style={{ color: "var(--primary)", fontWeight: 600 }}>
                        {eligibilityDisplay.linkText || eligibilityDisplay.cardSubtitle}
                      </Link>
                    ) : (
                      eligibilityDisplay.cardSubtitle
                    )}
                  </div>
                </div>

                <div style={{ background: "white", padding: 18, borderRadius: 10, boxShadow: "var(--shadow)" }}>
                  <div style={{ fontSize: 12, color: "var(--gray)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                    Last Donation Date
                  </div>
                  <div style={{ color: "var(--secondary)", fontWeight: 700, fontSize: 16 }}>
                    <i className="fas fa-calendar-check" style={{ color: "var(--primary)", marginRight: 6 }} />
                    {user.lastDonationDate
                      ? new Date(user.lastDonationDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "No recorded donations"}
                  </div>
                </div>
              </div>

              {/* Editable Profile Form */}
              <form onSubmit={handleUpdate}>
                <div className="form-section">
                  <h3>
                    <i className="fas fa-user-edit" /> Personal & Contact Details
                  </h3>

                  <div className="form-grid">
                    <div className="form-group">
                      <label className="required-field">Full Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Email Address</label>
                      <input
                        type="email"
                        value={user.email}
                        disabled
                        style={{ backgroundColor: "var(--light-gray)", cursor: "not-allowed" }}
                        title="Email cannot be changed directly"
                      />
                    </div>

                    <div className="form-group">
                      <label className="required-field">Phone Number</label>
                      <input
                        type="tel"
                        maxLength={10}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                        placeholder="10-digit mobile number"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="required-field">Blood Group</label>
                      <select
                        value={bloodGroup}
                        onChange={(e) => setBloodGroup(e.target.value)}
                        required
                      >
                        {BLOOD_GROUPS.map((bg) => (
                          <option key={bg} value={bg}>
                            {bg}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Date of Birth</label>
                      <input
                        type="date"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        max={new Date().toISOString().split("T")[0]}
                      />
                    </div>

                    <div className="form-group">
                      <label>Gender</label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                      >
                        {GENDERS.map((g) => (
                          <option key={g.value} value={g.value}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Location Details */}
                <div className="form-section">
                  <h3>
                    <i className="fas fa-map-marker-alt" /> Location & Interactive Map
                  </h3>

                  <LocationPickerMap
                    latitude={latitude ? parseFloat(latitude) : null}
                    longitude={longitude ? parseFloat(longitude) : null}
                    label="Pin Your Location on Real-time Map"
                    helperText="Click anywhere on the map or click 'Use My Current Location' to drop a pin. Coordinates and address details will sync automatically."
                    onChange={({ latitude: lat, longitude: lng, city: geoCity, state: geoState, pincode: geoPincode }) => {
                      setLatitude(String(lat));
                      setLongitude(String(lng));
                      if (geoCity && !city) setCity(geoCity);
                      if (geoState && !state) setState(geoState);
                      if (geoPincode && !pincode) setPincode(geoPincode);
                    }}
                  />

                  <div className="form-grid">
                    <div className="form-group">
                      <label>City</label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Vadodara"
                      />
                    </div>

                    <div className="form-group">
                      <label>State</label>
                      <input
                        type="text"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="e.g. Gujarat"
                      />
                    </div>

                    <div className="form-group">
                      <label>Pincode</label>
                      <input
                        type="text"
                        maxLength={6}
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                        placeholder="6-digit pincode"
                      />
                    </div>
                  </div>
                </div>

                {/* Donor Availability & Security */}
                <div className="form-section">
                  <h3>
                    <i className="fas fa-sliders-h" /> Donor Availability & Security
                  </h3>

                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          cursor: "pointer",
                          fontSize: 16,
                          fontWeight: 600,
                          color: "var(--secondary)",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isDonorAvailable}
                          onChange={(e) => setIsDonorAvailable(e.target.checked)}
                          style={{ width: 20, height: 20, accentColor: "var(--primary)" }}
                        />
                        Available for emergency blood donation requests
                      </label>
                      <p style={{ color: "var(--gray)", fontSize: 13, marginLeft: 32 }}>
                        When checked, you will appear in eligible donor matching searches when blood is needed in your area.
                      </p>
                    </div>

                    <div className="form-group full-width" style={{ marginTop: 10 }}>
                      <label>New Password (leave blank to keep current)</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password (optional)"
                        minLength={6}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 30, display: "flex", justifyContent: "flex-end", gap: 12 }}>
                    <button
                      type="submit"
                      className="btn btn-large"
                      disabled={saving}
                    >
                      {saving ? (
                        <>
                          <i className="fas fa-spinner fa-spin" /> Saving Changes...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-save" /> Save Profile
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}

