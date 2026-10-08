import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { toast } from "../../components/AppToaster";

export const Route = createFileRoute("/camps/")({
  head: () => ({
    meta: [
      { title: "Blood Donation Camps — REDhope" },
      {
        name: "description",
        content: "Discover and register for upcoming blood donation camps organized by REDhope and community partners.",
      },
      { property: "og:title", content: "Blood Donation Camps — REDhope" },
      { property: "og:description", content: "Discover upcoming blood donation camps and save lives." },
    ],
  }),
  component: CampsListPage,
});

const API_BASE = "http://localhost:5000";

interface CampLocation {
  address: string;
  city: string;
  state: string;
  pincode: string;
  type?: string;
  coordinates?: [number, number];
}

interface CampItem {
  _id: string;
  name: string;
  description?: string;
  location: CampLocation;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  capacity: number;
  registrationCount: number;
  status: "draft" | "published" | "completed" | "cancelled";
  distanceMeters?: number;
  organizer?: {
    _id: string;
    name: string;
  };
  createdAt?: string;
}

interface UserProfile {
  _id: string;
  name: string;
  email: string;
  location?: {
    coordinates?: [number, number]; // [longitude, latitude]
    city?: string;
    state?: string;
  };
}

function CampsListPage() {
  // Mode: "all" (standard discovery/filter) vs "nearby" (geospatial discovery)
  const [activeTab, setActiveTab] = useState<"all" | "nearby">("all");

  // Standard discovery states
  const [camps, setCamps] = useState<CampItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Standard filter inputs
  const [cityFilter, setCityFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");

  const [appliedFilters, setAppliedFilters] = useState({
    city: "",
    state: "",
    from: "",
    to: "",
  });

  // Nearby discovery states
  const [token, setToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState<number>(25);
  const [nearbyCamps, setNearbyCamps] = useState<CampItem[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);

  // Check auth and profile on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("token") || localStorage.getItem("redhope_token");
    if (savedToken) {
      setToken(savedToken);
      fetchUserProfile(savedToken);
    }
  }, []);

  const fetchUserProfile = async (authToken: string) => {
    setLoadingProfile(true);
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json();
      if (res.ok && json.success && json.user) {
        setUserProfile(json.user);
      }
    } catch (err) {
      console.error("Error loading user profile for nearby discovery:", err);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Fetch standard camps
  const fetchCamps = async (filters: { city: string; state: string; from: string; to: string }) => {
    setLoading(true);
    setErrorMsg(null);

    const queryParams = new URLSearchParams();
    if (filters.city.trim()) queryParams.append("city", filters.city.trim());
    if (filters.state.trim()) queryParams.append("state", filters.state.trim());
    if (filters.from.trim()) queryParams.append("from", filters.from.trim());
    if (filters.to.trim()) queryParams.append("to", filters.to.trim());

    const url = `${API_BASE}/camps${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

    try {
      const res = await fetch(url);
      const json = await res.json();

      if (!res.ok || !json.success) {
        setErrorMsg(json.message || "Failed to load blood donation camps.");
        setCamps([]);
        return;
      }

      setCamps(json.camps || []);
    } catch (err) {
      console.error("Error fetching camps:", err);
      setErrorMsg("Unable to connect to the server. Please verify your backend server connection.");
      setCamps([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch nearby camps using coordinates & radius
  const fetchNearbyCamps = async (lng: number, lat: number, radiusMeters: number) => {
    setLoadingNearby(true);
    setNearbyError(null);

    const url = `${API_BASE}/camps/nearby?longitude=${lng}&latitude=${lat}&radius=${radiusMeters}`;

    try {
      const res = await fetch(url);
      const json = await res.json();

      if (!res.ok || !json.success) {
        setNearbyError(json.message || "Failed to load nearby camps.");
        setNearbyCamps([]);
        return;
      }

      setNearbyCamps(json.camps || []);
    } catch (err) {
      console.error("Error fetching nearby camps:", err);
      setNearbyError("Unable to reach the server to discover nearby camps.");
      setNearbyCamps([]);
    } finally {
      setLoadingNearby(false);
    }
  };

  useEffect(() => {
    if (activeTab === "all") {
      fetchCamps(appliedFilters);
    } else if (activeTab === "nearby" && userProfile?.location?.coordinates?.length === 2) {
      const [lng, lat] = userProfile.location.coordinates;
      fetchNearbyCamps(lng, lat, nearbyRadiusKm * 1000);
    }
  }, [appliedFilters, activeTab, userProfile, nearbyRadiusKm]);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedFilters({
      city: cityFilter,
      state: stateFilter,
      from: fromFilter,
      to: toFilter,
    });
  };

  const handleResetFilters = () => {
    setCityFilter("");
    setStateFilter("");
    setFromFilter("");
    setToFilter("");
    setAppliedFilters({
      city: "",
      state: "",
      from: "",
      to: "",
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const formatDistance = (meters?: number) => {
    if (meters === undefined || meters === null) return null;
    if (meters < 1000) {
      return `${Math.round(meters)} m away`;
    }
    const km = (meters / 1000).toFixed(1);
    return `${km} km away`;
  };

  const isCampEnded = (endDateStr: string, endTimeStr: string) => {
    try {
      const end = new Date(endDateStr);
      if (endTimeStr && endTimeStr.includes(":")) {
        const [h, m] = endTimeStr.split(":").map(Number);
        end.setHours(h, m, 0, 0);
      } else {
        end.setHours(23, 59, 59, 999);
      }
      return new Date() > end;
    } catch {
      return false;
    }
  };

  const hasActiveFilters = Boolean(
    appliedFilters.city || appliedFilters.state || appliedFilters.from || appliedFilters.to
  );

  const hasProfileCoordinates = Boolean(
    userProfile?.location?.coordinates &&
    Array.isArray(userProfile.location.coordinates) &&
    userProfile.location.coordinates.length === 2 &&
    typeof userProfile.location.coordinates[0] === "number" &&
    typeof userProfile.location.coordinates[1] === "number"
  );

  return (
    <>
      <Navbar solid />

      {/* Hero section */}
      <section className="hero hero-compact" style={{ minHeight: "35vh" }}>
        <div className="hero-inner">
          <h1>Blood Donation Camps</h1>
          <p>Find verified donation drives in your city, register to donate, and help save lives.</p>
        </div>
      </section>

      {/* Main content */}
      <section className="features" style={{ backgroundColor: "var(--background)", minHeight: "65vh", paddingTop: 40, paddingBottom: 60 }}>
        <div className="container">
          {/* Discovery View Switcher Tabs */}
          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 30,
              borderBottom: "2px solid var(--light-gray)",
              paddingBottom: 12,
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "8px 18px",
                fontSize: 16,
                fontWeight: 700,
                color: activeTab === "all" ? "var(--primary)" : "var(--gray)",
                borderBottom: activeTab === "all" ? "3px solid var(--primary)" : "3px solid transparent",
                marginBottom: -14,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <i className="fas fa-list" /> All Camps
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("nearby")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "8px 18px",
                fontSize: 16,
                fontWeight: 700,
                color: activeTab === "nearby" ? "var(--primary)" : "var(--gray)",
                borderBottom: activeTab === "nearby" ? "3px solid var(--primary)" : "3px solid transparent",
                marginBottom: -14,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <i className="fas fa-location-crosshairs" /> Nearby Camps (Radius Search)
            </button>
          </div>

          {/* TAB 1: ALL CAMPS (STANDARD DISCOVERY) */}
          {activeTab === "all" && (
            <>
              {/* Filter Bar */}
              <div className="form-section" style={{ marginBottom: 35, padding: "24px 28px" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: 16 }}>
                  <i className="fas fa-filter" style={{ color: "var(--primary)" }} /> Filter Camps
                </h3>

                <form onSubmit={handleApplyFilters}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: 16,
                      alignItems: "flex-end",
                    }}
                  >
                    <div className="form-group">
                      <label htmlFor="filter-city">
                        <i className="fas fa-city" style={{ marginRight: 6, color: "var(--gray)" }} />
                        City
                      </label>
                      <input
                        id="filter-city"
                        type="text"
                        placeholder="e.g. Vadodara"
                        value={cityFilter}
                        onChange={(e) => setCityFilter(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="filter-state">
                        <i className="fas fa-map" style={{ marginRight: 6, color: "var(--gray)" }} />
                        State
                      </label>
                      <input
                        id="filter-state"
                        type="text"
                        placeholder="e.g. Gujarat"
                        value={stateFilter}
                        onChange={(e) => setStateFilter(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="filter-from">
                        <i className="fas fa-calendar-alt" style={{ marginRight: 6, color: "var(--gray)" }} />
                        From Date
                      </label>
                      <input
                        id="filter-from"
                        type="date"
                        value={fromFilter}
                        onChange={(e) => setFromFilter(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="filter-to">
                        <i className="fas fa-calendar-check" style={{ marginRight: 6, color: "var(--gray)" }} />
                        To Date
                      </label>
                      <input
                        id="filter-to"
                        type="date"
                        value={toFilter}
                        onChange={(e) => setToFilter(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 12, marginTop: 18, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="btn btn-outline"
                        style={{ padding: "10px 20px", fontSize: 13 }}
                      >
                        <i className="fas fa-undo" style={{ marginRight: 6 }} /> Reset Filters
                      </button>
                    )}
                    <button
                      type="submit"
                      className="btn"
                      style={{ padding: "10px 24px", fontSize: 13 }}
                    >
                      <i className="fas fa-search" style={{ marginRight: 6 }} /> Search Camps
                    </button>
                  </div>
                </form>
              </div>

              {/* Active filter summary pill */}
              {hasActiveFilters && (
                <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, color: "var(--gray)", fontWeight: 600 }}>Active Filters:</span>
                  {appliedFilters.city && (
                    <span
                      style={{
                        backgroundColor: "white",
                        padding: "4px 12px",
                        borderRadius: 20,
                        fontSize: 13,
                        border: "1px solid var(--light-gray)",
                      }}
                    >
                      City: <strong>{appliedFilters.city}</strong>
                    </span>
                  )}
                  {appliedFilters.state && (
                    <span
                      style={{
                        backgroundColor: "white",
                        padding: "4px 12px",
                        borderRadius: 20,
                        fontSize: 13,
                        border: "1px solid var(--light-gray)",
                      }}
                    >
                      State: <strong>{appliedFilters.state}</strong>
                    </span>
                  )}
                  {appliedFilters.from && (
                    <span
                      style={{
                        backgroundColor: "white",
                        padding: "4px 12px",
                        borderRadius: 20,
                        fontSize: 13,
                        border: "1px solid var(--light-gray)",
                      }}
                    >
                      From: <strong>{formatDate(appliedFilters.from)}</strong>
                    </span>
                  )}
                  {appliedFilters.to && (
                    <span
                      style={{
                        backgroundColor: "white",
                        padding: "4px 12px",
                        borderRadius: 20,
                        fontSize: 13,
                        border: "1px solid var(--light-gray)",
                      }}
                    >
                      To: <strong>{formatDate(appliedFilters.to)}</strong>
                    </span>
                  )}
                </div>
              )}

              {/* Results section */}
              {loading ? (
                <div style={{ textAlign: "center", padding: "80px 0" }}>
                  <i className="fas fa-spinner fa-spin fa-3x" style={{ color: "var(--primary)" }} />
                  <p style={{ marginTop: 16, color: "var(--gray)", fontSize: 16 }}>
                    Searching blood donation camps...
                  </p>
                </div>
              ) : errorMsg ? (
                <div
                  className="form-section"
                  style={{
                    textAlign: "center",
                    padding: "50px 30px",
                    borderColor: "rgba(227, 6, 19, 0.2)",
                  }}
                >
                  <i className="fas fa-exclamation-triangle fa-3x" style={{ color: "var(--primary)", marginBottom: 16 }} />
                  <h3 style={{ justifyContent: "center", color: "var(--primary)" }}>Could Not Load Camps</h3>
                  <p style={{ color: "var(--gray)", maxWidth: 500, margin: "0 auto 20px" }}>
                    {errorMsg}
                  </p>
                  <button
                    type="button"
                    onClick={() => fetchCamps(appliedFilters)}
                    className="btn"
                    style={{ padding: "10px 22px" }}
                  >
                    <i className="fas fa-redo" style={{ marginRight: 8 }} /> Retry
                  </button>
                </div>
              ) : camps.length === 0 ? (
                <div
                  className="form-section"
                  style={{
                    textAlign: "center",
                    padding: "60px 30px",
                  }}
                >
                  <i className="fas fa-calendar-times fa-3x" style={{ color: "var(--gray)", marginBottom: 16 }} />
                  <h3 style={{ justifyContent: "center", color: "var(--secondary)" }}>No Upcoming Camps Found</h3>
                  <p style={{ color: "var(--gray)", maxWidth: 520, margin: "0 auto 24px" }}>
                    {hasActiveFilters
                      ? "We couldn't find any blood donation drives matching your selected filters. Try clearing or expanding your search criteria."
                      : "There are currently no active public blood donation camps scheduled. Please check back later or consider organizing a camp in your locality."}
                  </p>
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="btn btn-outline"
                    >
                      <i className="fas fa-undo" style={{ marginRight: 8 }} /> Clear Filters
                    </button>
                  ) : (
                    <Link to="/organize" className="btn">
                      Organize a Camp
                    </Link>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ color: "var(--gray)", margin: 0, fontSize: 14 }}>
                      Showing <strong>{camps.length}</strong> upcoming {camps.length === 1 ? "camp" : "camps"}
                    </p>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                      gap: 25,
                    }}
                  >
                    {camps.map((camp) => {
                      const remainingSlots = Math.max(0, camp.capacity - camp.registrationCount);
                      const isFull = camp.registrationCount >= camp.capacity;
                      const ended = isCampEnded(camp.endDate, camp.endTime);

                      return (
                        <article
                          key={camp._id}
                          className="feature-card"
                          style={{
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            border: isFull ? "1.5px solid #ffc107" : "1px solid var(--light-gray)",
                          }}
                        >
                          <div className="feature-content" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                            {/* Status badge row */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  padding: "4px 10px",
                                  borderRadius: 4,
                                  backgroundColor: ended
                                    ? "#6c757d"
                                    : isFull
                                    ? "#ffc107"
                                    : "rgba(40, 167, 69, 0.15)",
                                  color: ended ? "#fff" : isFull ? "#856404" : "#28a745",
                                }}
                              >
                                {ended ? "Ended" : isFull ? "Camp Full" : "Open for Registration"}
                              </span>

                              <span style={{ fontSize: 13, color: "var(--gray)" }}>
                                <i className="fas fa-map-marker-alt" style={{ marginRight: 4, color: "var(--primary)" }} />
                                {camp.location.city}
                              </span>
                            </div>

                            {/* Camp title */}
                            <h3 style={{ fontSize: "1.25rem", marginBottom: 10, lineHeight: 1.3 }}>
                              {camp.name}
                            </h3>

                            {/* Description snippet */}
                            {camp.description && (
                              <p
                                style={{
                                  fontSize: 14,
                                  color: "var(--gray)",
                                  marginBottom: 16,
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                }}
                              >
                                {camp.description}
                              </p>
                            )}

                            {/* Details meta grid */}
                            <div
                              style={{
                                marginTop: "auto",
                                paddingTop: 14,
                                borderTop: "1px solid var(--light-gray)",
                                fontSize: 13,
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                              }}
                            >
                              <div>
                                <i className="fas fa-calendar-alt" style={{ width: 18, color: "var(--primary)" }} />
                                <strong style={{ color: "var(--secondary)" }}>Date: </strong>
                                <span>
                                  {formatDate(camp.startDate)}
                                  {camp.startDate !== camp.endDate ? ` – ${formatDate(camp.endDate)}` : ""}
                                </span>
                              </div>

                              <div>
                                <i className="fas fa-clock" style={{ width: 18, color: "var(--primary)" }} />
                                <strong style={{ color: "var(--secondary)" }}>Time: </strong>
                                <span>
                                  {camp.startTime} – {camp.endTime}
                                </span>
                              </div>

                              <div>
                                <i className="fas fa-location-dot" style={{ width: 18, color: "var(--primary)" }} />
                                <strong style={{ color: "var(--secondary)" }}>Location: </strong>
                                <span>
                                  {camp.location.address}, {camp.location.city}, {camp.location.state}
                                </span>
                              </div>

                              {/* Capacity / Slots badge */}
                              <div
                                style={{
                                  marginTop: 6,
                                  padding: "8px 12px",
                                  backgroundColor: "var(--background)",
                                  borderRadius: 6,
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }}
                              >
                                <span style={{ color: "var(--secondary)", fontWeight: 600 }}>
                                  <i className="fas fa-users" style={{ marginRight: 6 }} />
                                  {camp.registrationCount} / {camp.capacity} registered
                                </span>
                                <span
                                  style={{
                                    color: isFull ? "#b00000" : "#28a745",
                                    fontWeight: 700,
                                  }}
                                >
                                  {isFull ? "0 slots left" : `${remainingSlots} slots left`}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Card Action footer */}
                          <div
                            style={{
                              padding: "16px 25px",
                              borderTop: "1px solid var(--light-gray)",
                              backgroundColor: "#fafbfc",
                              display: "flex",
                              justifyContent: "flex-end",
                            }}
                          >
                            <Link
                              to={`/camps/${camp._id}`}
                              className="btn"
                              style={{
                                width: "100%",
                                textAlign: "center",
                                padding: "10px 18px",
                                fontSize: 13,
                              }}
                            >
                              View Details & Register
                            </Link>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 2: NEARBY CAMPS (GEOSPATIAL DISCOVERY) */}
          {activeTab === "nearby" && (
            <div>
              {!token ? (
                /* Unauthenticated Notice */
                <div
                  className="form-section"
                  style={{
                    textAlign: "center",
                    padding: "60px 30px",
                    maxWidth: 550,
                    margin: "0 auto",
                  }}
                >
                  <i className="fas fa-location-dot fa-3x" style={{ color: "var(--primary)", marginBottom: 16 }} />
                  <h3 style={{ justifyContent: "center", color: "var(--secondary)" }}>Saved Location Required</h3>
                  <p style={{ color: "var(--gray)", marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
                    Nearby camp discovery uses the geographic coordinates saved in your REDhope donor profile. Please sign in to search camps near you.
                  </p>
                  <Link to="/profile" className="btn">
                    Sign In to Profile
                  </Link>
                </div>
              ) : loadingProfile ? (
                <div style={{ textAlign: "center", padding: "60px 0" }}>
                  <i className="fas fa-spinner fa-spin fa-3x" style={{ color: "var(--primary)" }} />
                  <p style={{ marginTop: 16, color: "var(--gray)" }}>Loading your profile location...</p>
                </div>
              ) : !hasProfileCoordinates ? (
                /* Authenticated, but no coordinates in profile */
                <div
                  className="form-section"
                  style={{
                    textAlign: "center",
                    padding: "50px 30px",
                    maxWidth: 600,
                    margin: "0 auto",
                  }}
                >
                  <i className="fas fa-map-location-dot fa-3x" style={{ color: "#ffc107", marginBottom: 16 }} />
                  <h3 style={{ justifyContent: "center", color: "var(--secondary)" }}>No Coordinates Saved in Profile</h3>
                  <p style={{ color: "var(--gray)", marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
                    Your profile doesn't have geographic coordinates (longitude & latitude) configured yet. Please add your coordinates or city location in your profile to discover blood donation drives near you.
                  </p>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                    <Link to="/profile" className="btn">
                      <i className="fas fa-user-gear" style={{ marginRight: 6 }} /> Update Profile Location
                    </Link>
                    <button
                      type="button"
                      onClick={() => setActiveTab("all")}
                      className="btn btn-outline"
                    >
                      Browse All Camps
                    </button>
                  </div>
                </div>
              ) : (
                /* Profile has coordinates: Show radius controls & results */
                <div>
                  {/* Radius Control Bar */}
                  <div
                    className="form-section"
                    style={{
                      marginBottom: 30,
                      padding: "20px 25px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 16,
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: "1.15rem", margin: 0 }}>
                        <i className="fas fa-compass" style={{ color: "var(--primary)" }} /> Camps Near Your Location
                      </h3>
                      <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--gray)" }}>
                        Searching from {userProfile?.location?.city || "your saved profile coordinates"} ([
                        {userProfile?.location?.coordinates?.[0]?.toFixed(4)}, {userProfile?.location?.coordinates?.[1]?.toFixed(4)}])
                      </p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <label htmlFor="radius-select" style={{ fontSize: 13, fontWeight: 600, color: "var(--secondary)" }}>
                        Search Radius:
                      </label>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[5, 10, 25, 50].map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setNearbyRadiusKm(r)}
                            className={nearbyRadiusKm === r ? "btn" : "btn btn-outline"}
                            style={{
                              padding: "6px 14px",
                              fontSize: 12,
                              fontWeight: 700,
                            }}
                          >
                            {r} km
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Nearby Results */}
                  {loadingNearby ? (
                    <div style={{ textAlign: "center", padding: "80px 0" }}>
                      <i className="fas fa-spinner fa-spin fa-3x" style={{ color: "var(--primary)" }} />
                      <p style={{ marginTop: 16, color: "var(--gray)", fontSize: 16 }}>
                        Discovering camps within {nearbyRadiusKm} km...
                      </p>
                    </div>
                  ) : nearbyError ? (
                    <div
                      className="form-section"
                      style={{
                        textAlign: "center",
                        padding: "50px 30px",
                        borderColor: "rgba(227, 6, 19, 0.2)",
                      }}
                    >
                      <i className="fas fa-triangle-exclamation fa-3x" style={{ color: "var(--primary)", marginBottom: 16 }} />
                      <h3 style={{ justifyContent: "center", color: "var(--primary)" }}>Could Not Complete Nearby Search</h3>
                      <p style={{ color: "var(--gray)", marginBottom: 20 }}>{nearbyError}</p>
                      <button
                        type="button"
                        onClick={() => {
                          if (userProfile?.location?.coordinates) {
                            fetchNearbyCamps(
                              userProfile.location.coordinates[0],
                              userProfile.location.coordinates[1],
                              nearbyRadiusKm * 1000
                            );
                          }
                        }}
                        className="btn"
                      >
                        Retry Search
                      </button>
                    </div>
                  ) : nearbyCamps.length === 0 ? (
                    <div
                      className="form-section"
                      style={{
                        textAlign: "center",
                        padding: "60px 30px",
                      }}
                    >
                      <i className="fas fa-street-view fa-3x" style={{ color: "var(--gray)", marginBottom: 16 }} />
                      <h3 style={{ justifyContent: "center", color: "var(--secondary)" }}>
                        No Camps Found Within {nearbyRadiusKm} km
                      </h3>
                      <p style={{ color: "var(--gray)", maxWidth: 520, margin: "0 auto 24px", fontSize: 14, lineHeight: 1.6 }}>
                        No published blood donation camps were found within {nearbyRadiusKm} km of your saved coordinates. You can try expanding your search radius to 50 km or browse all camps across the state.
                      </p>
                      <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                        {nearbyRadiusKm < 50 && (
                          <button
                            type="button"
                            onClick={() => setNearbyRadiusKm(50)}
                            className="btn"
                          >
                            Expand to 50 km
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveTab("all")}
                          className="btn btn-outline"
                        >
                          Browse All Camps
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <p style={{ color: "var(--gray)", margin: 0, fontSize: 14 }}>
                          Found <strong>{nearbyCamps.length}</strong> {nearbyCamps.length === 1 ? "camp" : "camps"} within <strong>{nearbyRadiusKm} km</strong>, sorted nearest first.
                        </p>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                          gap: 25,
                        }}
                      >
                        {nearbyCamps.map((camp) => {
                          const remainingSlots = Math.max(0, camp.capacity - camp.registrationCount);
                          const isFull = camp.registrationCount >= camp.capacity;
                          const ended = isCampEnded(camp.endDate, camp.endTime);
                          const distanceLabel = formatDistance(camp.distanceMeters);

                          return (
                            <article
                              key={camp._id}
                              className="feature-card"
                              style={{
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "space-between",
                                border: isFull ? "1.5px solid #ffc107" : "1px solid var(--light-gray)",
                              }}
                            >
                              <div className="feature-content" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                                {/* Status badge and distance row */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 700,
                                      textTransform: "uppercase",
                                      padding: "4px 10px",
                                      borderRadius: 4,
                                      backgroundColor: ended
                                        ? "#6c757d"
                                        : isFull
                                        ? "#ffc107"
                                        : "rgba(40, 167, 69, 0.15)",
                                      color: ended ? "#fff" : isFull ? "#856404" : "#28a745",
                                    }}
                                  >
                                    {ended ? "Ended" : isFull ? "Camp Full" : "Open for Registration"}
                                  </span>

                                  {distanceLabel && (
                                    <span
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: "var(--primary)",
                                        backgroundColor: "rgba(227, 6, 19, 0.08)",
                                        padding: "3px 8px",
                                        borderRadius: 4,
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 4,
                                      }}
                                    >
                                      <i className="fas fa-location-arrow" /> {distanceLabel}
                                    </span>
                                  )}
                                </div>

                                <h3 style={{ fontSize: "1.25rem", marginBottom: 10, lineHeight: 1.3 }}>
                                  {camp.name}
                                </h3>

                                {camp.description && (
                                  <p
                                    style={{
                                      fontSize: 14,
                                      color: "var(--gray)",
                                      marginBottom: 16,
                                      display: "-webkit-box",
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: "vertical",
                                      overflow: "hidden",
                                    }}
                                  >
                                    {camp.description}
                                  </p>
                                )}

                                <div
                                  style={{
                                    marginTop: "auto",
                                    paddingTop: 14,
                                    borderTop: "1px solid var(--light-gray)",
                                    fontSize: 13,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 8,
                                  }}
                                >
                                  <div>
                                    <i className="fas fa-calendar-alt" style={{ width: 18, color: "var(--primary)" }} />
                                    <strong style={{ color: "var(--secondary)" }}>Date: </strong>
                                    <span>
                                      {formatDate(camp.startDate)}
                                      {camp.startDate !== camp.endDate ? ` – ${formatDate(camp.endDate)}` : ""}
                                    </span>
                                  </div>

                                  <div>
                                    <i className="fas fa-clock" style={{ width: 18, color: "var(--primary)" }} />
                                    <strong style={{ color: "var(--secondary)" }}>Time: </strong>
                                    <span>
                                      {camp.startTime} – {camp.endTime}
                                    </span>
                                  </div>

                                  <div>
                                    <i className="fas fa-location-dot" style={{ width: 18, color: "var(--primary)" }} />
                                    <strong style={{ color: "var(--secondary)" }}>Location: </strong>
                                    <span>
                                      {camp.location.address}, {camp.location.city}
                                    </span>
                                  </div>

                                  <div
                                    style={{
                                      marginTop: 6,
                                      padding: "8px 12px",
                                      backgroundColor: "var(--background)",
                                      borderRadius: 6,
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                    }}
                                  >
                                    <span style={{ color: "var(--secondary)", fontWeight: 600 }}>
                                      <i className="fas fa-users" style={{ marginRight: 6 }} />
                                      {camp.registrationCount} / {camp.capacity} registered
                                    </span>
                                    <span
                                      style={{
                                        color: isFull ? "#b00000" : "#28a745",
                                        fontWeight: 700,
                                      }}
                                    >
                                      {isFull ? "0 slots left" : `${remainingSlots} slots left`}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div
                                style={{
                                  padding: "16px 25px",
                                  borderTop: "1px solid var(--light-gray)",
                                  backgroundColor: "#fafbfc",
                                  display: "flex",
                                  justifyContent: "flex-end",
                                }}
                              >
                                <Link
                                  to={`/camps/${camp._id}`}
                                  className="btn"
                                  style={{
                                    width: "100%",
                                    textAlign: "center",
                                    padding: "10px 18px",
                                    fontSize: 13,
                                  }}
                                >
                                  View Details & Register
                                </Link>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}
