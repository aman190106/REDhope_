import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { toast } from "../components/AppToaster";
import { LocationPickerMap } from "../components/LocationPickerMap";

export const Route = createFileRoute("/matching")({
  head: () => ({
    meta: [
      { title: "Find Matching Donors — REDhope" },
      {
        name: "description",
        content: "Search compatible, medically eligible, and available blood donors ranked by suitability and proximity.",
      },
      { property: "og:title", content: "Find Matching Donors — REDhope" },
      {
        property: "og:description",
        content: "Discover eligible blood donors matching your recipient blood group requirement.",
      },
    ],
  }),
  component: BloodMatchingPage,
});

import { API_BASE_URL } from "../lib/api";
const API_BASE = API_BASE_URL;
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

interface MatchedDonor {
  userId: string;
  name: string;
  bloodGroup: string;
  city?: string;
  state?: string;
  distanceMeters?: number;
  score: number;
  matchReason: string[];
}

interface MatchingResponseData {
  bloodGroup: string;
  count: number;
  totalCompatibleFound: number;
  matches: MatchedDonor[];
  searchLocation?: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
  };
}

function BloodMatchingPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Form search state
  const [selectedBloodGroup, setSelectedBloodGroup] = useState("A+");
  const [enableLocation, setEnableLocation] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radiusKm, setRadiusKm] = useState("25");

  // Query state
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MatchingResponseData | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem("token") || localStorage.getItem("redhope_token");
    setToken(savedToken);
    setLoadingAuth(false);
  }, []);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(4));
        setLongitude(pos.coords.longitude.toFixed(4));
        setEnableLocation(true);
        toast.success("Location acquired successfully.");
      },
      (err) => {
        console.warn("Geolocation error:", err);
        toast.error("Could not retrieve current location. Please enter coordinates manually.");
      }
    );
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error("Please sign in to search for donor candidates.");
      return;
    }

    if (!selectedBloodGroup) {
      toast.error("Please select a recipient blood group.");
      return;
    }

    const payload: {
      bloodGroup: string;
      latitude?: number;
      longitude?: number;
      radius?: number;
    } = {
      bloodGroup: selectedBloodGroup,
    };

    if (enableLocation) {
      if (!latitude || !longitude) {
        toast.error("Both latitude and longitude must be provided for proximity search.");
        return;
      }
      const latNum = parseFloat(latitude);
      const lngNum = parseFloat(longitude);
      if (isNaN(latNum) || latNum < -90 || latNum > 90) {
        toast.error("Latitude must be a valid number between -90 and 90.");
        return;
      }
      if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
        toast.error("Longitude must be a valid number between -180 and 180.");
        return;
      }

      payload.latitude = latNum;
      payload.longitude = lngNum;
      payload.radius = parseInt(radiusKm, 10) * 1000;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const res = await fetch(`${API_BASE}/matching/donors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || "Failed to search donor matches.");
        setResults(null);
        return;
      }

      setResults(data.data);
    } catch (err) {
      console.error("Donor matching request error:", err);
      toast.error("Could not connect to the blood matching server.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "#198754"; // Excellent: green
    if (score >= 75) return "#0d6efd"; // Good: blue
    if (score >= 60) return "#ffc107"; // Moderate: yellow
    return "#6c757d";
  };

  return (
    <>
      <Navbar solid />

      {/* Hero */}
      <section className="hero hero-compact" style={{ minHeight: "26vh" }}>
        <div className="hero-inner">
          <h1>Blood Donor Matching</h1>
          <p>
            Find compatible, eligible, and available blood donor candidates ranked by suitability and proximity
          </p>
        </div>
      </section>

      <section
        className="features"
        style={{
          backgroundColor: "var(--background)",
          minHeight: "70vh",
          paddingTop: 36,
          paddingBottom: 60,
        }}
      >
        <div className="container">
          {loadingAuth ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <i className="fas fa-spinner fa-spin fa-2x" style={{ color: "var(--primary)" }} />
              <p style={{ marginTop: 12, color: "var(--gray)" }}>Loading matching interface...</p>
            </div>
          ) : !token ? (
            /* Unauthenticated Prompt */
            <div
              className="form-section"
              style={{
                textAlign: "center",
                padding: "60px 30px",
                maxWidth: 520,
                margin: "0 auto",
              }}
            >
              <i className="fas fa-lock fa-3x" style={{ color: "var(--primary)", marginBottom: 16 }} />
              <h3 style={{ justifyContent: "center" }}>Authentication Required</h3>
              <p style={{ color: "var(--gray)", marginBottom: 24, fontSize: 14 }}>
                Please sign in to your REDhope account to access the blood donor matching engine.
              </p>
              <Link to="/profile" className="btn">
                Sign In to REDhope
              </Link>
            </div>
          ) : (
            /* Search Interface */
            <div style={{ maxWidth: 880, margin: "0 auto" }}>
              {/* Criteria Card */}
              <div
                className="form-section"
                style={{
                  margin: "0 0 32px 0",
                  padding: "26px 28px",
                  borderRadius: 8,
                }}
              >
                <h3 style={{ fontSize: 18, margin: "0 0 20px 0", color: "var(--secondary)" }}>
                  <i className="fas fa-search" style={{ color: "var(--primary)", marginRight: 8 }} />
                  Blood Requirement Criteria
                </h3>

                <form onSubmit={handleSearch}>
                  {/* Recipient Blood Group */}
                  <div style={{ marginBottom: 20 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--text)",
                        marginBottom: 8,
                      }}
                    >
                      Recipient Blood Group (Required):
                    </label>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {BLOOD_GROUPS.map((bg) => (
                        <button
                          key={bg}
                          type="button"
                          onClick={() => setSelectedBloodGroup(bg)}
                          className={selectedBloodGroup === bg ? "btn" : "btn btn-outline"}
                          style={{
                            padding: "8px 18px",
                            fontSize: 14,
                            fontWeight: 700,
                            borderRadius: 6,
                          }}
                        >
                          {bg}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Proximity Toggle */}
                  <div style={{ marginBottom: 20 }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={enableLocation}
                        onChange={(e) => setEnableLocation(e.target.checked)}
                        style={{ width: 16, height: 16 }}
                      />
                      <span>Filter by Geographic Proximity (Optional)</span>
                    </label>
                  </div>

                  {/* Location Inputs (conditional) */}
                  {enableLocation && (
                    <div
                      style={{
                        padding: 16,
                        backgroundColor: "var(--surface)",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        marginBottom: 20,
                      }}
                    >
                      <LocationPickerMap
                        latitude={latitude ? parseFloat(latitude) : null}
                        longitude={longitude ? parseFloat(longitude) : null}
                        height={240}
                        label="Pin Search Location on Map"
                        helperText="Click on the target location or use current location to find nearby donors within radius."
                        onChange={({ latitude: lat, longitude: lng }) => {
                          setLatitude(String(lat));
                          setLongitude(String(lng));
                        }}
                      />

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr",
                          gap: 14,
                          marginBottom: 12,
                        }}
                      >

                        <div>
                          <label style={{ display: "block", fontSize: 12, color: "var(--gray)", marginBottom: 4 }}>
                            Search Radius:
                          </label>
                          <select
                            value={radiusKm}
                            onChange={(e) => setRadiusKm(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "8px 10px",
                              fontSize: 13,
                              borderRadius: 4,
                              border: "1px solid var(--border)",
                              backgroundColor: "var(--background)",
                              color: "var(--text)",
                            }}
                          >
                            <option value="5">5 km</option>
                            <option value="10">10 km</option>
                            <option value="25">25 km (Default)</option>
                            <option value="50">50 km</option>
                            <option value="100">100 km</option>
                          </select>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleUseCurrentLocation}
                        className="btn btn-outline"
                        style={{ padding: "6px 14px", fontSize: 12 }}
                      >
                        <i className="fas fa-location-crosshairs" style={{ marginRight: 6 }} />
                        Use My Current Location
                      </button>
                    </div>
                  )}

                  {/* Submit Button */}
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <button
                      type="submit"
                      className="btn"
                      style={{ padding: "10px 28px", fontSize: 14 }}
                      disabled={loading}
                    >
                      <i className={`fas fa-${loading ? "spinner fa-spin" : "magnifying-glass"}`} style={{ marginRight: 8 }} />
                      {loading ? "Matching Candidates..." : "Find Matching Donors"}
                    </button>
                    <span style={{ fontSize: 12, color: "var(--gray)" }}>
                      Read-only discovery. Evaluates red blood cell compatibility & medical eligibility.
                    </span>
                  </div>
                </form>
              </div>

              {/* Results View */}
              {loading ? (
                <div style={{ textAlign: "center", padding: "60px 0" }}>
                  <i className="fas fa-spinner fa-spin fa-2x" style={{ color: "var(--primary)" }} />
                  <p style={{ marginTop: 12, color: "var(--gray)" }}>Evaluating donor compatibility and ranking candidates...</p>
                </div>
              ) : hasSearched && results ? (
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 16,
                      flexWrap: "wrap",
                      gap: 10,
                    }}
                  >
                    <h3 style={{ fontSize: 18, margin: 0, color: "var(--secondary)" }}>
                      Matching Results for Recipient {results.bloodGroup}
                    </h3>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "4px 10px",
                        borderRadius: 4,
                        backgroundColor: "var(--surface)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                      }}
                    >
                      {results.count} compatible candidate{results.count === 1 ? "" : "s"} found
                    </span>
                  </div>

                  {results.matches && results.matches.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {results.matches.map((donor, idx) => {
                        const isExact = donor.bloodGroup === results.bloodGroup;
                        return (
                          <div
                            key={donor.userId}
                            className="form-section"
                            style={{
                              margin: 0,
                              padding: "18px 22px",
                              borderRadius: 8,
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: 16,
                            }}
                          >
                            {/* Left: Donor Identity & Reasons */}
                            <div style={{ flex: "1 1 320px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 800, color: "#888" }}>
                                  #{idx + 1}
                                </span>
                                <h4 style={{ fontSize: 16, margin: 0, color: "var(--secondary)" }}>
                                  {donor.name}
                                </h4>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                    backgroundColor: isExact ? "#198754" : "var(--primary)",
                                    color: "white",
                                  }}
                                >
                                  {donor.bloodGroup} ({isExact ? "Exact Match" : "Compatible"})
                                </span>
                              </div>

                              {(donor.city || donor.state) && (
                                <div style={{ fontSize: 12, color: "var(--gray)", marginBottom: 8 }}>
                                  <i className="fas fa-location-dot" style={{ marginRight: 5 }} />
                                  {[donor.city, donor.state].filter(Boolean).join(", ")}
                                </div>
                              )}

                              {/* Reasons Badges */}
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                                {donor.matchReason.map((reason, rIdx) => (
                                  <span
                                    key={rIdx}
                                    style={{
                                      fontSize: 11,
                                      padding: "2px 8px",
                                      borderRadius: 4,
                                      backgroundColor: "var(--surface)",
                                      border: "1px solid var(--border)",
                                      color: "var(--text)",
                                    }}
                                  >
                                    ✓ {reason}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Right: Score & Distance */}
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div
                                style={{
                                  fontSize: 26,
                                  fontWeight: 800,
                                  color: getScoreColor(donor.score),
                                }}
                              >
                                {donor.score}
                                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--gray)" }}>/100</span>
                              </div>
                              <div style={{ fontSize: 11, color: "var(--gray)", fontWeight: 600 }}>
                                Match Score
                              </div>

                              {donor.distanceMeters !== undefined && (
                                <div
                                  style={{
                                    marginTop: 6,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: "var(--primary)",
                                  }}
                                >
                                  <i className="fas fa-route" style={{ marginRight: 4 }} />
                                  {(donor.distanceMeters / 1000).toFixed(1)} km away
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* No Matches State */
                    <div
                      className="form-section"
                      style={{
                        textAlign: "center",
                        padding: "50px 30px",
                        margin: 0,
                      }}
                    >
                      <i className="fas fa-circle-info fa-3x" style={{ color: "var(--gray)", marginBottom: 14 }} />
                      <h4 style={{ fontSize: 16, color: "var(--secondary)", marginBottom: 8 }}>
                        No Matching Donors Found
                      </h4>
                      <p style={{ color: "var(--gray)", fontSize: 14, maxWidth: 440, margin: "0 auto" }}>
                        There are currently no available and eligible donors compatible with blood group {results.bloodGroup} within the specified search criteria.
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}

