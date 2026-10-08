import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "../../../components/Navbar";
import { Footer } from "../../../components/Footer";
import { toast } from "../../../components/AppToaster";

export const Route = createFileRoute("/organizer/camps/$campId")({
  head: () => ({
    meta: [
      { title: "Manage Camp & Registered Donors — REDhope Organizer" },
      {
        name: "description",
        content: "View registered donors, review contact details, edit camp details, and update camp lifecycle status.",
      },
      { property: "og:title", content: "Manage Camp & Registered Donors — REDhope" },
      { property: "og:description", content: "View registered donors and update camp information." },
    ],
  }),
  component: OrganizerCampDetailPage,
});

const API_BASE = "http://localhost:5000";

interface CampLocation {
  address: string;
  city: string;
  state: string;
  pincode: string;
  coordinates?: [number, number];
}

interface CampDetail {
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
  organizer?: {
    _id: string;
    name: string;
  };
}

interface RegisteredDonorUser {
  _id: string;
  name: string;
  bloodGroup: string;
  gender: string;
  phone: string;
  location?: {
    city?: string;
    state?: string;
    pincode?: string;
  };
}

interface CampDonationItem {
  _id: string;
  donor?: {
    _id: string;
    name: string;
    bloodGroup: string;
  };
  registration?: {
    _id: string;
    status: string;
  } | string;
  donationDate: string;
  units: number;
  bloodGroup: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  notes?: string;
  verifiedAt?: string;
}

interface CampDonationStats {
  scheduled: number;
  completed: number;
  cancelled: number;
  noShow: number;
  totalCompletedUnits: number;
}

interface RegistrationItem {
  _id: string;
  camp: string;
  status: "registered" | "cancelled";
  registeredAt: string;
  cancelledAt?: string;
  user: RegisteredDonorUser;
}

interface UserProfile {
  _id: string;
  name: string;
  role: "user" | "organizer" | "admin";
}

function OrganizerCampDetailPage() {
  const { campId } = Route.useParams();
  const navigate = useNavigate();

  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Camp details state
  const [camp, setCamp] = useState<CampDetail | null>(null);
  const [loadingCamp, setLoadingCamp] = useState(true);
  const [campError, setCampError] = useState<string | null>(null);

  // Registered donors state
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [regsError, setRegsError] = useState<string | null>(null);
  const [donorStatusFilter, setDonorStatusFilter] = useState<"registered" | "cancelled" | "all">("registered");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRegCount, setTotalRegCount] = useState(0);

  // Donation tracking state
  const [campDonations, setCampDonations] = useState<CampDonationItem[]>([]);
  const [donationStats, setDonationStats] = useState<CampDonationStats>({
    scheduled: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
    totalCompletedUnits: 0,
  });
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [targetRegistration, setTargetRegistration] = useState<RegistrationItem | null>(null);
  const [recordUnits, setRecordUnits] = useState(1);
  const [recordStatus, setRecordStatus] = useState<"scheduled" | "completed">("completed");
  const [recordNotes, setRecordNotes] = useState("");
  const [recordingDonation, setRecordingDonation] = useState(false);

  // Edit Camp Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [updatingCamp, setUpdatingCamp] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editPincode, setEditPincode] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editCapacity, setEditCapacity] = useState("");

  useEffect(() => {
    const savedToken = localStorage.getItem("token") || localStorage.getItem("redhope_token");
    if (!savedToken) {
      setLoadingAuth(false);
      return;
    }

    setToken(savedToken);
    checkAuth(savedToken);
  }, []);

  const checkAuth = async (authToken: string) => {
    setLoadingAuth(true);
    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (res.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("redhope_token");
        setToken(null);
        setCurrentUser(null);
        return;
      }

      const json = await res.json();
      if (res.ok && json.success && json.user) {
        setCurrentUser(json.user);
        if (json.user.role === "organizer" || json.user.role === "admin") {
          fetchCampDetails(authToken);
          fetchRegistrations(authToken, donorStatusFilter, currentPage);
          fetchCampDonations(authToken);
        }
      }
    } catch (err) {
      console.error("Auth check error:", err);
    } finally {
      setLoadingAuth(false);
    }
  };

  const fetchCampDonations = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/camps/${campId}/donations?limit=100`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setCampDonations(json.data.donations || []);
        if (json.data.stats) {
          setDonationStats(json.data.stats);
        }
      }
    } catch (err) {
      console.error("Error fetching camp donations:", err);
    }
  };

  const handleOpenRecordModal = (reg: RegistrationItem) => {
    setTargetRegistration(reg);
    setRecordUnits(1);
    setRecordStatus("completed");
    setRecordNotes("");
    setRecordModalOpen(true);
  };

  const handleRecordDonationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !targetRegistration) return;

    setRecordingDonation(true);
    try {
      const res = await fetch(`${API_BASE}/donations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registrationId: targetRegistration._id,
          units: recordUnits,
          status: recordStatus,
          notes: recordNotes.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to record donation.");
        return;
      }

      toast.success(
        recordStatus === "completed"
          ? "Donation completed & verified! Donor eligibility updated."
          : "Donation record scheduled successfully!"
      );
      setRecordModalOpen(false);
      setTargetRegistration(null);
      fetchCampDonations(token);
    } catch (err) {
      console.error("Donation recording error:", err);
      toast.error("Network error while recording donation.");
    } finally {
      setRecordingDonation(false);
    }
  };

  const handleUpdateDonationStatus = async (
    donationId: string,
    newStatus: "completed" | "cancelled" | "no_show"
  ) => {
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/donations/${donationId}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || `Failed to update status to ${newStatus}.`);
        return;
      }

      toast.success(
        newStatus === "completed"
          ? "Donation marked as completed! Donor eligibility updated."
          : `Donation marked as ${newStatus}!`
      );
      fetchCampDonations(token);
    } catch (err) {
      console.error("Donation status update error:", err);
      toast.error("Network error while updating donation status.");
    }
  };

  const fetchCampDetails = async (authToken: string) => {
    setLoadingCamp(true);
    setCampError(null);
    try {
      const res = await fetch(`${API_BASE}/camps/${campId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setCampError(json.message || "Failed to load camp details.");
        setCamp(null);
        return;
      }

      setCamp(json.camp);

      // Prepopulate edit modal state
      setEditName(json.camp.name || "");
      setEditDescription(json.camp.description || "");
      setEditAddress(json.camp.location?.address || "");
      setEditCity(json.camp.location?.city || "");
      setEditState(json.camp.location?.state || "");
      setEditPincode(json.camp.location?.pincode || "");
      setEditStartDate(json.camp.startDate ? json.camp.startDate.split("T")[0] : "");
      setEditEndDate(json.camp.endDate ? json.camp.endDate.split("T")[0] : "");
      setEditStartTime(json.camp.startTime || "09:00");
      setEditEndTime(json.camp.endTime || "17:00");
      setEditCapacity(String(json.camp.capacity || 50));
    } catch (err) {
      console.error("Error fetching camp:", err);
      setCampError("Could not reach server to load camp.");
    } finally {
      setLoadingCamp(false);
    }
  };

  const fetchRegistrations = async (
    authToken: string,
    statusParam: "registered" | "cancelled" | "all",
    page: number
  ) => {
    setLoadingRegs(true);
    setRegsError(null);
    try {
      const url = `${API_BASE}/camps/${campId}/registrations?status=${statusParam}&page=${page}&limit=10`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (res.status === 403) {
        setRegsError("You do not have permission to view registrations for this camp.");
        setRegistrations([]);
        return;
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        setRegsError(json.message || "Failed to load registered donors.");
        setRegistrations([]);
        return;
      }

      setRegistrations(json.data.registrations || []);
      setTotalPages(json.data.totalPages || 1);
      setTotalRegCount(json.data.total || 0);
    } catch (err) {
      console.error("Error fetching registrations:", err);
      setRegsError("Could not connect to server to load donor registrations.");
    } finally {
      setLoadingRegs(false);
    }
  };

  const handleStatusFilterChange = (newStatus: "registered" | "cancelled" | "all") => {
    setDonorStatusFilter(newStatus);
    setCurrentPage(1);
    if (token) {
      fetchRegistrations(token, newStatus, 1);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    if (token) {
      fetchRegistrations(token, donorStatusFilter, newPage);
    }
  };

  // Lifecycle updates (Publish / Cancel / Complete)
  const handleUpdateCampStatus = async (newStatus: string) => {
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/camps/${campId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || `Failed to update status to ${newStatus}.`);
        return;
      }

      toast.success(`Camp status updated to ${newStatus}!`);
      fetchCampDetails(token);
    } catch (err) {
      console.error("Status update error:", err);
      toast.error("Network error while updating camp status.");
    }
  };

  // Edit camp submission
  const handleEditCampSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setUpdatingCamp(true);
    try {
      const payload = {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        location: {
          address: editAddress.trim(),
          city: editCity.trim(),
          state: editState.trim(),
          pincode: editPincode.trim(),
        },
        startDate: editStartDate,
        endDate: editEndDate,
        startTime: editStartTime,
        endTime: editEndTime,
        capacity: Number(editCapacity) || 50,
      };

      const res = await fetch(`${API_BASE}/camps/${campId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.message || "Failed to update camp details.");
        return;
      }

      toast.success("Camp details updated successfully!");
      setShowEditModal(false);
      fetchCampDetails(token);
    } catch (err) {
      console.error("Edit camp error:", err);
      toast.error("Failed to connect to the server.");
    } finally {
      setUpdatingCamp(false);
    }
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

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <>
      <Navbar solid />

      <section className="hero hero-compact" style={{ minHeight: "30vh" }}>
        <div className="hero-inner">
          <Link
            to="/organizer"
            style={{
              color: "rgba(255, 255, 255, 0.8)",
              fontSize: 14,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 10,
            }}
          >
            <i className="fas fa-arrow-left" /> Back to Dashboard
          </Link>
          <h1>{camp ? camp.name : "Camp Management"}</h1>
          <p>Review registered donors, track slots, and update camp status</p>
        </div>
      </section>

      <section className="features" style={{ backgroundColor: "var(--background)", minHeight: "65vh", paddingTop: 40, paddingBottom: 60 }}>
        <div className="container">
          {loadingAuth || loadingCamp ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <i className="fas fa-spinner fa-spin fa-3x" style={{ color: "var(--primary)" }} />
              <p style={{ marginTop: 16, color: "var(--gray)" }}>Loading camp and donor records...</p>
            </div>
          ) : !token ? (
            <div className="form-section" style={{ textAlign: "center", padding: "60px 30px", maxWidth: 500, margin: "0 auto" }}>
              <i className="fas fa-lock fa-3x" style={{ color: "var(--primary)", marginBottom: 16 }} />
              <h3>Authentication Required</h3>
              <p style={{ color: "var(--gray)", marginBottom: 20 }}>Please sign in to manage this blood donation camp.</p>
              <Link to="/profile" className="btn">Sign In</Link>
            </div>
          ) : currentUser?.role !== "organizer" && currentUser?.role !== "admin" ? (
            <div className="form-section" style={{ textAlign: "center", padding: "60px 30px", maxWidth: 500, margin: "0 auto" }}>
              <i className="fas fa-ban fa-3x" style={{ color: "var(--primary)", marginBottom: 16 }} />
              <h3 style={{ color: "var(--primary)" }}>Access Denied</h3>
              <p style={{ color: "var(--gray)", marginBottom: 20 }}>Only organizers and administrators can manage camp registrations.</p>
              <Link to="/camps" className="btn">Browse Camps</Link>
            </div>
          ) : campError || !camp ? (
            <div className="form-section" style={{ textAlign: "center", padding: "60px 30px", maxWidth: 500, margin: "0 auto" }}>
              <i className="fas fa-circle-exclamation fa-3x" style={{ color: "var(--primary)", marginBottom: 16 }} />
              <h3>Camp Not Found</h3>
              <p style={{ color: "var(--gray)", marginBottom: 20 }}>{campError || "Camp record not found."}</p>
              <Link to="/organizer" className="btn">Back to Dashboard</Link>
            </div>
          ) : (
            (() => {
              const remainingSlots = Math.max(0, camp.capacity - camp.registrationCount);
              const isFull = camp.registrationCount >= camp.capacity;

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
                  {/* Camp Overview Header Card */}
                  <div
                    className="form-section"
                    style={{
                      margin: 0,
                      padding: "26px 30px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: 20,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            padding: "4px 10px",
                            borderRadius: 4,
                            backgroundColor:
                              camp.status === "published"
                                ? "rgba(40, 167, 69, 0.15)"
                                : camp.status === "draft"
                                ? "#e2e3e5"
                                : camp.status === "completed"
                                ? "rgba(26, 54, 93, 0.12)"
                                : "rgba(220, 53, 69, 0.12)",
                            color:
                              camp.status === "published"
                                ? "#28a745"
                                : camp.status === "draft"
                                ? "#383d41"
                                : camp.status === "completed"
                                ? "var(--secondary)"
                                : "#dc3545",
                          }}
                        >
                          Status: {camp.status}
                        </span>

                        <span style={{ fontSize: 13, color: "var(--gray)" }}>
                          <i className="fas fa-location-dot" style={{ marginRight: 4, color: "var(--primary)" }} />
                          {camp.location.city}, {camp.location.state}
                        </span>
                      </div>

                      <h2 style={{ fontSize: "1.75rem", margin: "0 0 10px 0", color: "var(--secondary)" }}>
                        {camp.name}
                      </h2>

                      {camp.description && (
                        <p style={{ color: "var(--gray)", fontSize: 14, margin: "0 0 14px 0", maxWidth: 650 }}>
                          {camp.description}
                        </p>
                      )}

                      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13, color: "var(--gray)" }}>
                        <span>
                          <strong style={{ color: "var(--secondary)" }}>Dates: </strong>
                          {formatDate(camp.startDate)}
                          {camp.startDate !== camp.endDate ? ` – ${formatDate(camp.endDate)}` : ""}
                        </span>
                        <span>
                          <strong style={{ color: "var(--secondary)" }}>Time: </strong>
                          {camp.startTime} – {camp.endTime}
                        </span>
                        <span>
                          <strong style={{ color: "var(--secondary)" }}>Venue: </strong>
                          {camp.location.address}, {camp.location.city} ({camp.location.pincode})
                        </span>
                      </div>
                    </div>

                    {/* Actions and Capacity */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 200, alignItems: "flex-end" }}>
                      <div
                        style={{
                          padding: "12px 20px",
                          backgroundColor: "var(--background)",
                          borderRadius: 8,
                          textAlign: "center",
                          width: "100%",
                        }}
                      >
                        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--secondary)" }}>
                          {camp.registrationCount} / {camp.capacity}
                        </div>
                        <div style={{ fontSize: 12, color: isFull ? "#b00000" : "#28a745", fontWeight: 600 }}>
                          {isFull ? "Camp Full" : `${remainingSlots} slots remaining`}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {/* Edit button: allowed for draft and published */}
                        {(camp.status === "draft" || camp.status === "published") && (
                          <button
                            type="button"
                            onClick={() => setShowEditModal(true)}
                            className="btn btn-outline"
                            style={{ padding: "8px 14px", fontSize: 13 }}
                          >
                            <i className="fas fa-pen-to-square" style={{ marginRight: 6 }} /> Edit Camp
                          </button>
                        )}

                        {/* Publish button: for draft only */}
                        {camp.status === "draft" && (
                          <button
                            type="button"
                            onClick={() => handleUpdateCampStatus("published")}
                            className="btn"
                            style={{ padding: "8px 16px", fontSize: 13, backgroundColor: "#28a745" }}
                          >
                            <i className="fas fa-paper-plane" style={{ marginRight: 6 }} /> Publish
                          </button>
                        )}

                        {/* Cancel button: for draft and published */}
                        {(camp.status === "draft" || camp.status === "published") && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm("Are you sure you want to cancel this camp? This cannot be undone.")) {
                                handleUpdateCampStatus("cancelled");
                              }
                            }}
                            className="btn btn-outline"
                            style={{ padding: "8px 14px", fontSize: 13, borderColor: "#dc3545", color: "#dc3545" }}
                          >
                            Cancel Camp
                          </button>
                        )}

                        {/* Complete button: for published only */}
                        {camp.status === "published" && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm("Mark this camp as completed? Completed camps cannot be modified.")) {
                                handleUpdateCampStatus("completed");
                              }
                            }}
                            className="btn btn-outline"
                            style={{ padding: "8px 14px", fontSize: 13 }}
                          >
                            Mark Completed
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Registered Donors & Donation Tracking Section */}
                  <div className="form-section" style={{ margin: 0, padding: "26px 30px" }}>
                    {/* Donation Summary Cards */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: 12,
                        marginBottom: 24,
                      }}
                    >
                      <div
                        style={{
                          backgroundColor: "#f8f9fa",
                          border: "1px solid var(--light-gray)",
                          borderRadius: 8,
                          padding: "12px 16px",
                          borderLeft: "4px solid #007bff",
                        }}
                      >
                        <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "var(--gray)" }}>
                          Scheduled
                        </div>
                        <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#007bff", marginTop: 2 }}>
                          {donationStats.scheduled}
                        </div>
                      </div>

                      <div
                        style={{
                          backgroundColor: "#f8f9fa",
                          border: "1px solid var(--light-gray)",
                          borderRadius: 8,
                          padding: "12px 16px",
                          borderLeft: "4px solid #28a745",
                        }}
                      >
                        <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "var(--gray)" }}>
                          Completed
                        </div>
                        <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#28a745", marginTop: 2 }}>
                          {donationStats.completed}{" "}
                          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--gray)" }}>
                            ({donationStats.totalCompletedUnits} {donationStats.totalCompletedUnits === 1 ? "unit" : "units"})
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          backgroundColor: "#f8f9fa",
                          border: "1px solid var(--light-gray)",
                          borderRadius: 8,
                          padding: "12px 16px",
                          borderLeft: "4px solid #6c757d",
                        }}
                      >
                        <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "var(--gray)" }}>
                          No-Show
                        </div>
                        <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#6c757d", marginTop: 2 }}>
                          {donationStats.noShow}
                        </div>
                      </div>

                      <div
                        style={{
                          backgroundColor: "#f8f9fa",
                          border: "1px solid var(--light-gray)",
                          borderRadius: 8,
                          padding: "12px 16px",
                          borderLeft: "4px solid #dc3545",
                        }}
                      >
                        <div style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "var(--gray)" }}>
                          Cancelled
                        </div>
                        <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#dc3545", marginTop: 2 }}>
                          {donationStats.cancelled}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 16,
                        marginBottom: 20,
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: "1.3rem" }}>
                        <i className="fas fa-users-viewfinder" style={{ color: "var(--primary)" }} /> Registered Donors (
                        {totalRegCount})
                      </h3>

                      {/* Filter Controls */}
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 13, color: "var(--gray)", fontWeight: 600 }}>Filter:</span>
                        {(["registered", "cancelled", "all"] as const).map((sf) => (
                          <button
                            key={sf}
                            type="button"
                            onClick={() => handleStatusFilterChange(sf)}
                            className={donorStatusFilter === sf ? "btn" : "btn btn-outline"}
                            style={{ padding: "6px 14px", fontSize: 12, textTransform: "capitalize" }}
                          >
                            {sf}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Registrations List / Table */}
                    {loadingRegs ? (
                      <div style={{ textAlign: "center", padding: "60px 0" }}>
                        <i className="fas fa-spinner fa-spin fa-2x" style={{ color: "var(--primary)" }} />
                        <p style={{ marginTop: 12, color: "var(--gray)" }}>Loading registered donors...</p>
                      </div>
                    ) : regsError ? (
                      <div style={{ textAlign: "center", padding: "40px 20px" }}>
                        <i className="fas fa-triangle-exclamation fa-2x" style={{ color: "var(--primary)", marginBottom: 10 }} />
                        <p style={{ color: "var(--gray)" }}>{regsError}</p>
                        <button
                          type="button"
                          onClick={() => token && fetchRegistrations(token, donorStatusFilter, currentPage)}
                          className="btn"
                          style={{ marginTop: 10 }}
                        >
                          Retry
                        </button>
                      </div>
                    ) : registrations.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "50px 20px" }}>
                        <i className="fas fa-user-slash fa-3x" style={{ color: "var(--gray)", marginBottom: 14 }} />
                        <h4 style={{ color: "var(--secondary)", margin: 0 }}>No Registered Donors Found</h4>
                        <p style={{ color: "var(--gray)", fontSize: 14, marginTop: 8 }}>
                          {donorStatusFilter === "all"
                            ? "No donors have registered for this camp yet."
                            : `No donors found with status '${donorStatusFilter}'.`}
                        </p>
                      </div>
                    ) : (
                      <div>
                        {/* Responsive Donor Cards List (Accessible on Desktop & Mobile) */}
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, textAlign: "left" }}>
                            <thead>
                              <tr style={{ borderBottom: "2px solid var(--light-gray)", color: "var(--secondary)" }}>
                                <th style={{ padding: "12px 14px" }}>Donor Name</th>
                                <th style={{ padding: "12px 14px" }}>Blood Group</th>
                                <th style={{ padding: "12px 14px" }}>Gender</th>
                                <th style={{ padding: "12px 14px" }}>Phone</th>
                                <th style={{ padding: "12px 14px" }}>Location</th>
                                <th style={{ padding: "12px 14px" }}>Reg Status</th>
                                <th style={{ padding: "12px 14px" }}>Donation Status & Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {registrations.map((reg) => {
                                const regDonation = campDonations.find(
                                  (d) =>
                                    (typeof d.registration === "object" && d.registration !== null
                                      ? d.registration._id
                                      : d.registration) === reg._id
                                );

                                return (
                                  <tr
                                    key={reg._id}
                                    style={{
                                      borderBottom: "1px solid var(--light-gray)",
                                      backgroundColor: reg.status === "cancelled" ? "rgba(220, 53, 69, 0.03)" : "transparent",
                                    }}
                                  >
                                    <td style={{ padding: "14px", fontWeight: 600, color: "var(--secondary)" }}>
                                      {reg.user?.name || "Anonymous Donor"}
                                    </td>
                                    <td style={{ padding: "14px" }}>
                                      <span
                                        style={{
                                          fontWeight: 700,
                                          color: "var(--primary)",
                                          backgroundColor: "rgba(227, 6, 19, 0.08)",
                                          padding: "3px 8px",
                                          borderRadius: 4,
                                          fontSize: 13,
                                        }}
                                      >
                                        {reg.user?.bloodGroup || "—"}
                                      </span>
                                    </td>
                                    <td style={{ padding: "14px", textTransform: "capitalize", color: "var(--gray)" }}>
                                      {reg.user?.gender || "—"}
                                    </td>
                                    <td style={{ padding: "14px", color: "var(--secondary)" }}>
                                      <a
                                        href={`tel:${reg.user?.phone}`}
                                        style={{ color: "inherit", textDecoration: "none" }}
                                      >
                                        <i className="fas fa-phone" style={{ marginRight: 6, color: "var(--primary)", fontSize: 12 }} />
                                        {reg.user?.phone || "—"}
                                      </a>
                                    </td>
                                    <td style={{ padding: "14px", color: "var(--gray)", fontSize: 13 }}>
                                      {reg.user?.location?.city
                                        ? `${reg.user.location.city}, ${reg.user.location.state || ""}`
                                        : "—"}
                                    </td>
                                    <td style={{ padding: "14px" }}>
                                      <span
                                        style={{
                                          fontSize: 11,
                                          fontWeight: 700,
                                          textTransform: "uppercase",
                                          padding: "3px 8px",
                                          borderRadius: 4,
                                          backgroundColor:
                                            reg.status === "registered" ? "rgba(40, 167, 69, 0.15)" : "rgba(220, 53, 69, 0.15)",
                                          color: reg.status === "registered" ? "#28a745" : "#dc3545",
                                        }}
                                      >
                                        {reg.status}
                                      </span>
                                    </td>
                                    <td style={{ padding: "14px" }}>
                                      {regDonation ? (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                          <span
                                            style={{
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: 6,
                                              fontSize: 11,
                                              fontWeight: 700,
                                              textTransform: "uppercase",
                                              padding: "3px 8px",
                                              borderRadius: 4,
                                              width: "fit-content",
                                              backgroundColor:
                                                regDonation.status === "completed"
                                                  ? "rgba(40, 167, 69, 0.15)"
                                                  : regDonation.status === "scheduled"
                                                  ? "rgba(0, 123, 255, 0.15)"
                                                  : regDonation.status === "no_show"
                                                  ? "rgba(108, 117, 125, 0.15)"
                                                  : "rgba(220, 53, 69, 0.15)",
                                              color:
                                                regDonation.status === "completed"
                                                  ? "#28a745"
                                                  : regDonation.status === "scheduled"
                                                  ? "#007bff"
                                                  : regDonation.status === "no_show"
                                                  ? "#6c757d"
                                                  : "#dc3545",
                                            }}
                                          >
                                            {regDonation.status === "completed" && <i className="fas fa-circle-check" />}
                                            {regDonation.status === "scheduled" && <i className="fas fa-clock" />}
                                            {regDonation.status} ({regDonation.units}{" "}
                                            {regDonation.units === 1 ? "unit" : "units"})
                                          </span>

                                          {regDonation.status === "scheduled" && (
                                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                                              <button
                                                type="button"
                                                onClick={() => handleUpdateDonationStatus(regDonation._id, "completed")}
                                                className="btn"
                                                style={{ padding: "3px 8px", fontSize: 11, backgroundColor: "#28a745" }}
                                                title="Mark donation completed"
                                              >
                                                <i className="fas fa-check" style={{ marginRight: 2 }} /> Complete
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleUpdateDonationStatus(regDonation._id, "no_show")}
                                                className="btn btn-outline"
                                                style={{ padding: "3px 8px", fontSize: 11, borderColor: "#6c757d", color: "#6c757d" }}
                                                title="Mark as no-show"
                                              >
                                                No-Show
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleUpdateDonationStatus(regDonation._id, "cancelled")}
                                                className="btn btn-outline"
                                                style={{ padding: "3px 8px", fontSize: 11, borderColor: "#dc3545", color: "#dc3545" }}
                                                title="Cancel donation"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      ) : reg.status === "registered" ? (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenRecordModal(reg)}
                                          className="btn btn-outline"
                                          style={{
                                            padding: "4px 10px",
                                            fontSize: 12,
                                            borderColor: "var(--primary)",
                                            color: "var(--primary)",
                                          }}
                                        >
                                          <i className="fas fa-hand-holding-droplet" style={{ marginRight: 4 }} /> Record Donation
                                        </button>
                                      ) : (
                                        <span style={{ fontSize: 12, color: "var(--gray)" }}>—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination Bar */}
                        {totalPages > 1 && (
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginTop: 22,
                              paddingTop: 16,
                              borderTop: "1px solid var(--light-gray)",
                            }}
                          >
                            <span style={{ fontSize: 13, color: "var(--gray)" }}>
                              Page {currentPage} of {totalPages} ({totalRegCount} total records)
                            </span>

                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage <= 1}
                                className="btn btn-outline"
                                style={{ padding: "6px 14px", fontSize: 12 }}
                              >
                                Previous
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage >= totalPages}
                                className="btn btn-outline"
                                style={{ padding: "6px 14px", fontSize: 12 }}
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </section>

      {/* EDIT CAMP MODAL */}
      {showEditModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
            overflowY: "auto",
          }}
        >
          <div
            className="form-section"
            style={{
              maxWidth: 700,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              margin: "auto",
              padding: 30,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: "var(--secondary)" }}>
                <i className="fas fa-pen-to-square" style={{ color: "var(--primary)" }} /> Edit Blood Donation Camp
              </h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--gray)" }}
              >
                <i className="fas fa-times" />
              </button>
            </div>

            <form onSubmit={handleEditCampSubmit}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="required-field">Camp Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div className="form-group">
                  <label className="required-field">Address</label>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="required-field">City</label>
                  <input
                    type="text"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div className="form-group">
                  <label className="required-field">State</label>
                  <input
                    type="text"
                    value={editState}
                    onChange={(e) => setEditState(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="required-field">Pincode</label>
                  <input
                    type="text"
                    value={editPincode}
                    onChange={(e) => setEditPincode(e.target.value)}
                    maxLength={6}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div className="form-group">
                  <label className="required-field">Start Date</label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="required-field">End Date</label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
                <div className="form-group">
                  <label className="required-field">Start Time</label>
                  <input
                    type="text"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="required-field">End Time</label>
                  <input
                    type="text"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="required-field">Capacity</label>
                  <input
                    type="number"
                    min={1}
                    value={editCapacity}
                    onChange={(e) => setEditCapacity(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingCamp}
                  className="btn"
                >
                  {updatingCamp ? (
                    <>
                      <i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} /> Saving Changes...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Donation Modal */}
      {recordModalOpen && targetRegistration && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              padding: 30,
              maxWidth: 500,
              width: "100%",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: "var(--secondary)" }}>
                <i className="fas fa-hand-holding-droplet" style={{ color: "var(--primary)", marginRight: 8 }} />
                Record Blood Donation
              </h3>
              <button
                type="button"
                onClick={() => {
                  setRecordModalOpen(false);
                  setTargetRegistration(null);
                }}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--gray)" }}
              >
                <i className="fas fa-times" />
              </button>
            </div>

            <div
              style={{
                backgroundColor: "#f8f9fa",
                borderRadius: 8,
                padding: "12px 16px",
                marginBottom: 20,
                fontSize: 14,
              }}
            >
              <div>
                <strong>Donor:</strong> {targetRegistration.user?.name || "Donor"}
              </div>
              <div style={{ marginTop: 4 }}>
                <strong>Blood Group:</strong>{" "}
                <span style={{ color: "var(--primary)", fontWeight: 700 }}>
                  {targetRegistration.user?.bloodGroup || "—"}
                </span>
              </div>
            </div>

            <form onSubmit={handleRecordDonationSubmit}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="required-field">Initial Status</label>
                <select
                  value={recordStatus}
                  onChange={(e) => setRecordStatus(e.target.value as "scheduled" | "completed")}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--light-gray)" }}
                  required
                >
                  <option value="completed">Completed (Donor donated successfully)</option>
                  <option value="scheduled">Scheduled (Plan to donate later today)</option>
                </select>
                <small style={{ color: "var(--gray)", display: "block", marginTop: 4, fontSize: 12 }}>
                  {recordStatus === "completed"
                    ? "Completing the donation will immediately update the donor's medical eligibility interval."
                    : "Scheduled donations can be marked as completed once collection is finished."}
                </small>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="required-field">Donated Units</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={recordUnits}
                  onChange={(e) => setRecordUnits(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 24 }}>
                <label>Notes (Optional)</label>
                <textarea
                  value={recordNotes}
                  onChange={(e) => setRecordNotes(e.target.value)}
                  placeholder="e.g. Standard 350ml whole blood donation, vitals normal."
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => {
                    setRecordModalOpen(false);
                    setTargetRegistration(null);
                  }}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingDonation}
                  className="btn"
                  style={{ backgroundColor: recordStatus === "completed" ? "#28a745" : undefined }}
                >
                  {recordingDonation ? (
                    <>
                      <i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} /> Recording...
                    </>
                  ) : recordStatus === "completed" ? (
                    "Save & Mark Completed"
                  ) : (
                    "Schedule Donation"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}

