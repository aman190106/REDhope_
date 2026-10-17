import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "../../../components/Navbar";
import { Footer } from "../../../components/Footer";
import { toast } from "../../../components/AppToaster";

export const Route = createFileRoute("/organizer/camps/$campId/screening/$registrationId")({
  head: () => ({
    meta: [
      { title: "Donor Health Screening — REDhope Camp Organizer" },
      { name: "description", content: "Perform manual donor health screening, inspect documents, and record decisions." },
    ],
  }),
  component: CampScreeningPage,
});

import { API_BASE_URL } from "../../../lib/api";
const API_BASE = API_BASE_URL;

interface DonorInfo {
  _id: string;
  name: string;
  email: string;
  phone: string;
  bloodGroup: string;
  gender: string;
  dateOfBirth?: string;
  age?: number | null;
  location?: {
    city?: string;
    state?: string;
    pincode?: string;
  };
}

interface MedicalDoc {
  _id: string;
  documentType: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  status: string;
  createdAt: string;
}

interface DonorHealthScreeningData {
  status: string;
  submittedAt?: string;
  consentGiven?: boolean;
  consentTimestamp?: string;
  preliminaryFlags?: Array<{
    code: string;
    category: string;
    questionKey: string;
    severity: "info" | "warning" | "critical";
    message: string;
  }>;
  questionnaire?: {
    generalHealth?: {
      feelWell?: boolean;
      hasFeverOrIllness?: boolean;
      recoveredRecently?: boolean;
      recentIllnessDetails?: string;
    };
    medicalHistory?: {
      chronicCondition?: boolean;
      chronicConditionDetails?: string;
      recentSurgery?: boolean;
      recentSurgeryDetails?: string;
      underTreatment?: boolean;
      underTreatmentDetails?: string;
    };
    medication?: {
      takingMedication?: boolean;
      medicationDetails?: string;
    };
    recentProcedures?: {
      tattooOrPiercingPast6Months?: boolean;
      dentalExtractionPast72Hours?: boolean;
      majorSurgeryPast12Months?: boolean;
    };
    vitals?: {
      weightKg?: number;
      heightCm?: number;
      systolicBp?: number;
      diastolicBp?: number;
      pulse?: number;
      hemoglobinGdl?: number;
    };
  };
}

interface CampScreeningForm {
  appearsWell: boolean | null;
  currentIllnessFever: boolean | null;
  recentMedicationTreatment: boolean | null;
  recentSurgeryProcedure: boolean | null;
  previousAdverseReaction: boolean | null;
  relevantMedicalCondition: boolean | null;
  basicMeasurementsChecked: boolean | null;
  hemoglobin: number | string;
  bloodPressureSystolic: number | string;
  bloodPressureDiastolic: number | string;
  pulse: number | string;
}

function CampScreeningPage() {
  const { campId, registrationId } = useParams({ from: "/organizer/camps/$campId/screening/$registrationId" });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [campName, setCampName] = useState("");
  const [donor, setDonor] = useState<DonorInfo | null>(null);
  const [regStatus, setRegStatus] = useState("registered");
  const [registeredAt, setRegisteredAt] = useState<string | null>(null);
  const [donorHealthScreening, setDonorHealthScreening] = useState<DonorHealthScreeningData | null>(null);
  const [documents, setDocuments] = useState<MedicalDoc[]>([]);

  // Screener state
  const [manualForm, setManualForm] = useState<CampScreeningForm>({
    appearsWell: null,
    currentIllnessFever: null,
    recentMedicationTreatment: null,
    recentSurgeryProcedure: null,
    previousAdverseReaction: null,
    relevantMedicalCondition: null,
    basicMeasurementsChecked: null,
    hemoglobin: "",
    bloodPressureSystolic: "",
    bloodPressureDiastolic: "",
    pulse: "",
  });

  const [observations, setObservations] = useState("");
  const [decision, setDecision] = useState<"pending" | "approved" | "temporarily_deferred" | "needs_medical_review" | "rejected">("pending");
  const [decisionReason, setDecisionReason] = useState("");
  const [screenedBy, setScreenedBy] = useState<{ name?: string } | null>(null);
  const [screenedAt, setScreenedAt] = useState<string | null>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  useEffect(() => {
    fetchWorkspace();
  }, [campId, registrationId]);

  async function fetchWorkspace() {
    if (!token) {
      setError("Please sign in as an organizer or administrator to access donor screening.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/camps/${campId}/screenings/${registrationId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Failed to fetch screening (HTTP ${res.status})`);
      }

      const w = data.data;
      setCampName(w.camp?.name || "Blood Donation Camp");
      setDonor(w.donor);
      setRegStatus(w.registration?.status || "registered");
      setRegisteredAt(w.registration?.registeredAt || null);
      setDonorHealthScreening(w.donorHealthScreening || null);
      setDocuments(w.medicalDocuments || []);

      if (w.campScreening) {
        const cs = w.campScreening;
        setDecision(cs.decision || "pending");
        setDecisionReason(cs.decisionReason || "");
        setObservations(cs.observations || "");
        setScreenedBy(cs.screenedBy || null);
        setScreenedAt(cs.screenedAt || null);

        if (cs.questionnaire) {
          setManualForm({
            appearsWell: cs.questionnaire.appearsWell ?? null,
            currentIllnessFever: cs.questionnaire.currentIllnessFever ?? null,
            recentMedicationTreatment: cs.questionnaire.recentMedicationTreatment ?? null,
            recentSurgeryProcedure: cs.questionnaire.recentSurgeryProcedure ?? null,
            previousAdverseReaction: cs.questionnaire.previousAdverseReaction ?? null,
            relevantMedicalCondition: cs.questionnaire.relevantMedicalCondition ?? null,
            basicMeasurementsChecked: cs.questionnaire.basicMeasurementsChecked ?? null,
            hemoglobin: cs.questionnaire.hemoglobin ?? "",
            bloodPressureSystolic: cs.questionnaire.bloodPressureSystolic ?? "",
            bloodPressureDiastolic: cs.questionnaire.bloodPressureDiastolic ?? "",
            pulse: cs.questionnaire.pulse ?? "",
          });
        }
      }
    } catch (err: any) {
      console.error("fetchWorkspace error:", err);
      setError(err.message || "An unexpected error occurred while loading donor records.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadDoc(docId: string, originalName: string) {
    if (!token) return;
    setDownloadingDocId(docId);
    try {
      const res = await fetch(`${API_BASE}/camps/${campId}/screenings/${registrationId}/documents/${docId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to stream document (HTTP ${res.status})`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = originalName || "medical-document";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Document downloaded securely.");
    } catch (err: any) {
      toast.error(err.message || "Could not download document.");
    } finally {
      setDownloadingDocId(null);
    }
  }

  async function handleSaveScreening(e: React.FormEvent) {
    e.preventDefault();

    if (["temporarily_deferred", "needs_medical_review", "rejected"].includes(decision)) {
      if (!decisionReason.trim()) {
        toast.error(`Please provide a clinical/screening reason when setting decision to '${decision.replace("_", " ")}'.`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        questionnaire: {
          appearsWell: manualForm.appearsWell,
          currentIllnessFever: manualForm.currentIllnessFever,
          recentMedicationTreatment: manualForm.recentMedicationTreatment,
          recentSurgeryProcedure: manualForm.recentSurgeryProcedure,
          previousAdverseReaction: manualForm.previousAdverseReaction,
          relevantMedicalCondition: manualForm.relevantMedicalCondition,
          basicMeasurementsChecked: manualForm.basicMeasurementsChecked,
          hemoglobin: manualForm.hemoglobin !== "" ? Number(manualForm.hemoglobin) : null,
          bloodPressureSystolic: manualForm.bloodPressureSystolic !== "" ? Number(manualForm.bloodPressureSystolic) : null,
          bloodPressureDiastolic: manualForm.bloodPressureDiastolic !== "" ? Number(manualForm.bloodPressureDiastolic) : null,
          pulse: manualForm.pulse !== "" ? Number(manualForm.pulse) : null,
        },
        observations,
        decision,
        decisionReason: decisionReason.trim() || null,
        reviewedDocuments: documents.map((d) => d._id),
      };

      const res = await fetch(`${API_BASE}/camps/${campId}/screenings/${registrationId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.message || `Failed to save screening (HTTP ${res.status})`);
      }

      toast.success(`Screening decision saved as '${decision.replace("_", " ")}' successfully.`);
      fetchWorkspace();
    } catch (err: any) {
      toast.error(err.message || "Failed to save screening.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Navbar solid />

      <section className="hero hero-compact" style={{ minHeight: "24vh", backgroundColor: "var(--primary)" }}>
        <div className="hero-inner">
          <Link
            to="/organizer/camps/$campId"
            params={{ campId }}
            style={{
              color: "rgba(255, 255, 255, 0.85)",
              fontSize: 14,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 10,
              textDecoration: "none",
            }}
          >
            <i className="fas fa-arrow-left" /> Back to Camp Management
          </Link>
          <h1 style={{ color: "#fff", margin: 0 }}>Donor Manual Screening Station</h1>
          <p style={{ color: "rgba(255, 255, 255, 0.9)", margin: "4px 0 0" }}>
            Camp: {campName} • Physical Examination & Document Verification
          </p>
        </div>
      </section>

      <div style={{ backgroundColor: "#f8f9fa", minHeight: "75vh", padding: "30px 20px 60px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "80px 0" }}>
              <i className="fas fa-spinner fa-spin fa-3x" style={{ color: "var(--primary)" }} />
              <p style={{ marginTop: 16, color: "var(--gray)" }}>Loading donor records and screening workspace...</p>
            </div>
          ) : error || !donor ? (
            <div className="form-section" style={{ textAlign: "center", padding: "50px 30px", maxWidth: 500, margin: "40px auto" }}>
              <i className="fas fa-triangle-exclamation fa-3x" style={{ color: "var(--primary)", marginBottom: 16 }} />
              <h3>Access Denied or Not Found</h3>
              <p style={{ color: "var(--gray)", marginBottom: 20 }}>{error || "Donor registration record not found."}</p>
              <Link to="/organizer/camps/$campId" params={{ campId }} className="btn">
                Back to Camp
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* 1. Donor Information Card */}
              <div
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 10,
                  padding: "24px 28px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                  border: "1px solid #eaeaea",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                  <div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        backgroundColor: "rgba(227, 6, 19, 0.1)",
                        color: "var(--primary)",
                        padding: "3px 8px",
                        borderRadius: 4,
                        display: "inline-block",
                        marginBottom: 6,
                      }}
                    >
                      Registered Donor
                    </span>
                    <h2 style={{ margin: "4px 0 8px", color: "var(--secondary)" }}>{donor.name}</h2>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 14, color: "var(--gray)" }}>
                      <span>
                        <i className="fas fa-envelope" style={{ marginRight: 6, color: "var(--primary)" }} />
                        {donor.email}
                      </span>
                      <span>
                        <i className="fas fa-phone" style={{ marginRight: 6, color: "var(--primary)" }} />
                        {donor.phone}
                      </span>
                      {donor.location?.city && (
                        <span>
                          <i className="fas fa-location-dot" style={{ marginRight: 6, color: "var(--primary)" }} />
                          {donor.location.city}, {donor.location.state || ""}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div
                      style={{
                        textAlign: "center",
                        padding: "8px 16px",
                        backgroundColor: "#fdf2f2",
                        borderRadius: 8,
                        border: "1px solid rgba(227, 6, 19, 0.2)",
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gray)", textTransform: "uppercase" }}>Blood Group</div>
                      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--primary)" }}>{donor.bloodGroup || "—"}</div>
                    </div>

                    <div
                      style={{
                        textAlign: "center",
                        padding: "8px 16px",
                        backgroundColor: "#f8f9fa",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gray)", textTransform: "uppercase" }}>Age / Gender</div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--secondary)" }}>
                        {donor.age ? `${donor.age} yrs` : "—"} / {donor.gender ? donor.gender.charAt(0).toUpperCase() : "—"}
                      </div>
                    </div>

                    <div
                      style={{
                        textAlign: "center",
                        padding: "8px 16px",
                        backgroundColor: regStatus === "registered" ? "rgba(40, 167, 69, 0.1)" : "rgba(220, 53, 69, 0.1)",
                        borderRadius: 8,
                        border: regStatus === "registered" ? "1px solid #28a745" : "1px solid #dc3545",
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gray)", textTransform: "uppercase" }}>Reg Status</div>
                      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: regStatus === "registered" ? "#28a745" : "#dc3545", textTransform: "capitalize" }}>
                        {regStatus}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Donor Health History (Submitted by Donor - Read-Only) */}
              <div
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 10,
                  padding: "24px 28px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                  border: "1px solid #eaeaea",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, color: "var(--secondary)", fontSize: "1.2rem" }}>
                      <i className="fas fa-file-waveform" style={{ color: "var(--primary)", marginRight: 8 }} />
                      Donor Health History
                    </h3>
                    <span style={{ fontSize: 12, color: "var(--gray)", fontWeight: 600 }}>
                      [Submitted by donor • Read-only reference]
                    </span>
                  </div>
                  {donorHealthScreening && (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "4px 10px",
                        borderRadius: 4,
                        backgroundColor: "#edf2f7",
                        color: "#4a5568",
                        textTransform: "uppercase",
                      }}
                    >
                      Global Screening: {donorHealthScreening.status.replace("_", " ")}
                    </span>
                  )}
                </div>

                {!donorHealthScreening ? (
                  <div style={{ padding: "16px", backgroundColor: "#f8f9fa", borderRadius: 8, color: "var(--gray)", fontSize: 14 }}>
                    <i className="fas fa-info-circle" style={{ marginRight: 6 }} />
                    The donor has not submitted an online preliminary health questionnaire. Please complete physical screening below.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Preliminary flags alert if any */}
                    {donorHealthScreening.preliminaryFlags && donorHealthScreening.preliminaryFlags.length > 0 && (
                      <div
                        style={{
                          backgroundColor: "#fff8e6",
                          border: "1px solid #ffeeba",
                          borderRadius: 8,
                          padding: "14px 18px",
                        }}
                      >
                        <div style={{ fontWeight: 700, color: "#856404", fontSize: 13, marginBottom: 6 }}>
                          <i className="fas fa-flag" style={{ marginRight: 6 }} />
                          Preliminary Screening Flags ({donorHealthScreening.preliminaryFlags.length})
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#856404" }}>
                          {donorHealthScreening.preliminaryFlags.map((flag, idx) => (
                            <li key={idx}>
                              <strong>{flag.category}:</strong> {flag.message}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, fontSize: 13 }}>
                      <div style={{ backgroundColor: "#f8f9fa", padding: "12px 16px", borderRadius: 8 }}>
                        <div style={{ fontWeight: 700, color: "var(--secondary)", marginBottom: 4 }}>General Health</div>
                        <div>Feeling well today: {donorHealthScreening.questionnaire?.generalHealth?.feelWell ? "Yes" : "No"}</div>
                        <div>Fever / Acute illness: {donorHealthScreening.questionnaire?.generalHealth?.hasFeverOrIllness ? "Yes" : "No"}</div>
                        {donorHealthScreening.questionnaire?.generalHealth?.recentIllnessDetails && (
                          <div style={{ color: "var(--gray)", marginTop: 4 }}>
                            Details: {donorHealthScreening.questionnaire.generalHealth.recentIllnessDetails}
                          </div>
                        )}
                      </div>

                      <div style={{ backgroundColor: "#f8f9fa", padding: "12px 16px", borderRadius: 8 }}>
                        <div style={{ fontWeight: 700, color: "var(--secondary)", marginBottom: 4 }}>Medical Conditions</div>
                        <div>Chronic condition: {donorHealthScreening.questionnaire?.medicalHistory?.chronicCondition ? "Yes" : "No"}</div>
                        <div>Recent surgery: {donorHealthScreening.questionnaire?.medicalHistory?.recentSurgery ? "Yes" : "No"}</div>
                        {donorHealthScreening.questionnaire?.medicalHistory?.chronicConditionDetails && (
                          <div style={{ color: "var(--gray)", marginTop: 4 }}>
                            Details: {donorHealthScreening.questionnaire.medicalHistory.chronicConditionDetails}
                          </div>
                        )}
                      </div>

                      <div style={{ backgroundColor: "#f8f9fa", padding: "12px 16px", borderRadius: 8 }}>
                        <div style={{ fontWeight: 700, color: "var(--secondary)", marginBottom: 4 }}>Medications & Procedures</div>
                        <div>Taking medication: {donorHealthScreening.questionnaire?.medication?.takingMedication ? "Yes" : "No"}</div>
                        <div>Recent tattoo / piercing: {donorHealthScreening.questionnaire?.recentProcedures?.tattooOrPiercingPast6Months ? "Yes" : "No"}</div>
                        {donorHealthScreening.questionnaire?.medication?.medicationDetails && (
                          <div style={{ color: "var(--gray)", marginTop: 4 }}>
                            Details: {donorHealthScreening.questionnaire.medication.medicationDetails}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Medical Documents Card */}
              <div
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 10,
                  padding: "24px 28px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                  border: "1px solid #eaeaea",
                }}
              >
                <h3 style={{ margin: "0 0 16px", color: "var(--secondary)", fontSize: "1.2rem" }}>
                  <i className="fas fa-file-medical" style={{ color: "var(--primary)", marginRight: 8 }} />
                  Uploaded Medical Records & Documents ({documents.length})
                </h3>

                {documents.length === 0 ? (
                  <div style={{ padding: "16px", backgroundColor: "#f8f9fa", borderRadius: 8, color: "var(--gray)", fontSize: 14 }}>
                    <i className="fas fa-file-slash" style={{ marginRight: 6 }} />
                    No medical documents uploaded by donor.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {documents.map((doc) => (
                      <div
                        key={doc._id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "12px 16px",
                          backgroundColor: "#f8f9fa",
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <i
                            className={
                              doc.mimeType === "application/pdf"
                                ? "fas fa-file-pdf fa-2x"
                                : "fas fa-file-image fa-2x"
                            }
                            style={{ color: "var(--primary)" }}
                          />
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--secondary)", fontSize: 14 }}>
                              {doc.originalFileName}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--gray)" }}>
                              {doc.documentType.replace("_", " ")} • {(doc.fileSize / 1024).toFixed(1)} KB • Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDownloadDoc(doc._id, doc.originalFileName)}
                          disabled={downloadingDocId === doc._id}
                          className="btn btn-outline"
                          style={{ padding: "6px 14px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          {downloadingDocId === doc._id ? (
                            <>
                              <i className="fas fa-spinner fa-spin" /> Downloading...
                            </>
                          ) : (
                            <>
                              <i className="fas fa-download" /> View / Download
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Manual Camp Screening & Decision Form */}
              <form
                onSubmit={handleSaveScreening}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 10,
                  padding: "28px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                  border: "1px solid #eaeaea",
                }}
              >
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ margin: 0, color: "var(--secondary)", fontSize: "1.3rem" }}>
                    <i className="fas fa-stethoscope" style={{ color: "var(--primary)", marginRight: 8 }} />
                    Manual Camp Screening Questionnaire
                  </h3>
                  <span style={{ fontSize: 12, color: "var(--primary)", fontWeight: 700 }}>
                    [Completed by Camp Screener during physical verification]
                  </span>
                </div>

                {/* Yes/No Screening Questions */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
                  {[
                    { key: "appearsWell", text: "1. Does the donor currently appear well enough to proceed with screening?" },
                    { key: "currentIllnessFever", text: "2. Has the donor reported any current illness or fever?" },
                    { key: "recentMedicationTreatment", text: "3. Has the donor reported any recent medication or treatment that requires review?" },
                    { key: "recentSurgeryProcedure", text: "4. Has the donor reported any recent surgery or dental procedure?" },
                    { key: "previousAdverseReaction", text: "5. Has the donor reported a previous adverse reaction to blood donation?" },
                    { key: "relevantMedicalCondition", text: "6. Has the donor disclosed any relevant medical condition requiring review?" },
                    { key: "basicMeasurementsChecked", text: "7. Have required basic screening measurements been checked?" },
                  ].map((q) => {
                    const currentVal = (manualForm as any)[q.key];
                    return (
                      <div
                        key={q.key}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 14px",
                          backgroundColor: "#f8f9fa",
                          borderRadius: 8,
                          flexWrap: "wrap",
                          gap: 10,
                        }}
                      >
                        <span style={{ fontSize: 14, color: "var(--secondary)", fontWeight: 500, flex: 1 }}>{q.text}</span>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button
                            type="button"
                            onClick={() => setManualForm({ ...manualForm, [q.key]: true })}
                            style={{
                              padding: "4px 14px",
                              fontSize: 12,
                              fontWeight: 700,
                              borderRadius: 4,
                              border: currentVal === true ? "2px solid #28a745" : "1px solid #ced4da",
                              backgroundColor: currentVal === true ? "#28a745" : "#fff",
                              color: currentVal === true ? "#fff" : "var(--secondary)",
                              cursor: "pointer",
                            }}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setManualForm({ ...manualForm, [q.key]: false })}
                            style={{
                              padding: "4px 14px",
                              fontSize: 12,
                              fontWeight: 700,
                              borderRadius: 4,
                              border: currentVal === false ? "2px solid #dc3545" : "1px solid #ced4da",
                              backgroundColor: currentVal === false ? "#dc3545" : "#fff",
                              color: currentVal === false ? "#fff" : "var(--secondary)",
                              cursor: "pointer",
                            }}
                          >
                            No
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Vitals & Measurements */}
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ margin: "0 0 12px", color: "var(--secondary)", fontSize: "1rem" }}>
                    Physical Measurements (Optional / On-Site)
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--gray)", display: "block", marginBottom: 4 }}>
                        Hemoglobin (g/dL)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 13.5"
                        value={manualForm.hemoglobin}
                        onChange={(e) => setManualForm({ ...manualForm, hemoglobin: e.target.value })}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #ced4da" }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--gray)", display: "block", marginBottom: 4 }}>
                        BP Systolic (mmHg)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 120"
                        value={manualForm.bloodPressureSystolic}
                        onChange={(e) => setManualForm({ ...manualForm, bloodPressureSystolic: e.target.value })}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #ced4da" }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--gray)", display: "block", marginBottom: 4 }}>
                        BP Diastolic (mmHg)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 80"
                        value={manualForm.bloodPressureDiastolic}
                        onChange={(e) => setManualForm({ ...manualForm, bloodPressureDiastolic: e.target.value })}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #ced4da" }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--gray)", display: "block", marginBottom: 4 }}>
                        Pulse (bpm)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 72"
                        value={manualForm.pulse}
                        onChange={(e) => setManualForm({ ...manualForm, pulse: e.target.value })}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #ced4da" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Organizer Observations */}
                <div style={{ marginBottom: 24 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "var(--secondary)", display: "block", marginBottom: 6 }}>
                    Screener Clinical Observations
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter physical observations, vein assessment, notes on general appearance..."
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 6, border: "1px solid #ced4da", fontSize: 14 }}
                  />
                </div>

                {/* Screening Decision */}
                <div style={{ marginBottom: 24, padding: "20px", backgroundColor: "#f8f9fa", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <label style={{ fontSize: 14, fontWeight: 800, color: "var(--secondary)", display: "block", marginBottom: 12 }}>
                    Screening Decision for Camp
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 16 }}>
                    {[
                      { key: "pending", label: "Pending", color: "#6c757d" },
                      { key: "approved", label: "Approved", color: "#28a745" },
                      { key: "temporarily_deferred", label: "Temporarily Deferred", color: "#e67e22" },
                      { key: "needs_medical_review", label: "Needs Medical Review", color: "#17a2b8" },
                      { key: "rejected", label: "Rejected", color: "#dc3545" },
                    ].map((d) => (
                      <label
                        key={d.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "10px 14px",
                          borderRadius: 6,
                          backgroundColor: decision === d.key ? "#fff" : "transparent",
                          border: decision === d.key ? `2px solid ${d.color}` : "1px solid #ced4da",
                          cursor: "pointer",
                          fontWeight: decision === d.key ? 700 : 500,
                          color: decision === d.key ? d.color : "var(--secondary)",
                        }}
                      >
                        <input
                          type="radio"
                          name="screeningDecision"
                          value={d.key}
                          checked={decision === d.key}
                          onChange={() => setDecision(d.key as any)}
                        />
                        {d.label}
                      </label>
                    ))}
                  </div>

                  {["temporarily_deferred", "needs_medical_review", "rejected"].includes(decision) && (
                    <div style={{ marginTop: 12 }}>
                      <label style={{ fontSize: 13, fontWeight: 700, color: "#dc3545", display: "block", marginBottom: 4 }}>
                        Reason for Deferral / Medical Review / Rejection (Required) *
                      </label>
                      <textarea
                        rows={2}
                        required
                        placeholder="Provide the clinical/procedural reason for this decision..."
                        value={decisionReason}
                        onChange={(e) => setDecisionReason(e.target.value)}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #dc3545", fontSize: 13 }}
                      />
                    </div>
                  )}

                  {screenedAt && (
                    <div style={{ marginTop: 14, fontSize: 12, color: "var(--gray)" }}>
                      <i className="fas fa-clock" style={{ marginRight: 4 }} />
                      Last screened on {new Date(screenedAt).toLocaleString()}
                      {screenedBy?.name ? ` by ${screenedBy.name}` : ""}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                  <Link to="/organizer/camps/$campId" params={{ campId }} className="btn btn-outline" style={{ padding: "10px 20px" }}>
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn"
                    style={{ padding: "10px 28px", display: "inline-flex", alignItems: "center", gap: 8 }}
                  >
                    {saving ? (
                      <>
                        <i className="fas fa-spinner fa-spin" /> Saving Decision...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-check-circle" /> Save Screening Decision
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </>
  );
}

