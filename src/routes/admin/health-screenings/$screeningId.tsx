import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "../../../components/Navbar";
import { Footer } from "../../../components/Footer";
import { toast } from "../../../components/AppToaster";
import { useAuth } from "../../../lib/auth";
import { api, API_BASE_URL } from "../../../lib/api";

export const Route = createFileRoute("/admin/health-screenings/$screeningId")({
  head: () => ({
    meta: [
      { title: "Clinical Review Detail — REDhope Admin" },
      { property: "og:title", content: "Clinical Review Detail — REDhope Admin" },
    ],
  }),
  component: AdminScreeningDetailPage,
});

function AdminScreeningDetailPage() {
  const { screeningId } = Route.useParams();
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [screening, setScreening] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Review Decision Form State
  const [decision, setDecision] = useState<string>("approved");
  const [reason, setReason] = useState<string>("");
  const [deferredUntil, setDeferredUntil] = useState<string>("");

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated || user?.role !== "admin") {
        toast.error("Unauthorized: Admin or Medical Reviewer access required.");
        navigate({ to: "/login" });
        return;
      }
      loadDetail();
    }
  }, [authLoading, isAuthenticated, user, screeningId]);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const res = await api.get<{
        success: boolean;
        data: {
          screening: any;
          documents: any[];
          auditLogs: any[];
        };
      }>(`/admin/health-screenings/${screeningId}`);

      if (res?.success && res.data) {
        setScreening(res.data.screening);
        setDocuments(res.data.documents || []);
        setAuditLogs(res.data.auditLogs || []);

        if (res.data.screening.reviewerDecision?.decision) {
          setDecision(res.data.screening.reviewerDecision.decision);
          setReason(res.data.screening.reviewerDecision.reason || "");
          if (res.data.screening.reviewerDecision.deferredUntil) {
            setDeferredUntil(
              new Date(res.data.screening.reviewerDecision.deferredUntil).toISOString().split("T")[0]
            );
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load screening detail.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDecision = async (e: React.FormEvent) => {
    e.preventDefault();

    if (decision !== "approved" && !reason.trim()) {
      toast.error(`Please provide a clinical reason for ${decision.replace("_", " ")}.`);
      return;
    }

    if (decision === "temporarily_deferred" && !deferredUntil) {
      toast.error("Please specify the date until which the donor is deferred.");
      return;
    }

    setSubmittingReview(true);
    try {
      const payload: any = {
        decision,
        reason: reason.trim(),
      };
      if (decision === "temporarily_deferred" && deferredUntil) {
        payload.deferredUntil = new Date(deferredUntil).toISOString();
      }

      const res = await api.patch<{ success: boolean; data: { screening: any } }>(
        `/admin/health-screenings/${screeningId}/review`,
        payload
      );

      if (res?.success) {
        setScreening(res.data.screening);
        toast.success(`Clinical decision '${decision.replace("_", " ")}' successfully recorded.`);
        loadDetail(); // reload audit logs
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit review decision.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDownloadDoc = async (docId: string, originalName: string) => {
    if (!token) return;
    setDownloadingDocId(docId);
    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/health-screenings/${screeningId}/documents/${docId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to download document (HTTP ${res.status})`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = originalName || "medical-document";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message || "Failed to download medical document.");
    } finally {
      setDownloadingDocId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <>
        <Navbar solid />
        <div style={{ minHeight: "60vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ textAlign: "center", color: "var(--primary)" }}>
            <i className="fas fa-spinner fa-spin fa-3x" />
            <p style={{ marginTop: 12, color: "var(--gray)" }}>Loading screening record...</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (!screening) {
    return (
      <>
        <Navbar solid />
        <div style={{ minHeight: "60vh", textAlign: "center", padding: "80px 20px" }}>
          <h2>Screening Not Found</h2>
          <Link to="/admin/health-screenings" className="btn" style={{ marginTop: 16 }}>
            &larr; Back to Reviews List
          </Link>
        </div>
        <Footer />
      </>
    );
  }

  const q = screening.questionnaire || {};
  const donor = screening.user || {};

  return (
    <>
      <Navbar solid />

      <section className="hero hero-compact" style={{ minHeight: "25vh", padding: "50px 0 25px" }}>
        <div className="hero-inner">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <Link to="/admin/health-screenings" style={{ color: "white", fontSize: 13, textDecoration: "underline" }}>
                &larr; Back to Screening Dashboard
              </Link>
              <h1 style={{ marginTop: 6, marginBottom: 4 }}>Clinical Screening Review</h1>
              <p>Reviewing submission for: {donor.name} ({donor.bloodGroup})</p>
            </div>
            <div>
              <span
                style={{
                  background: "white",
                  color: "var(--secondary)",
                  padding: "8px 18px",
                  borderRadius: 20,
                  fontWeight: 700,
                  fontSize: 14,
                  textTransform: "uppercase",
                }}
              >
                Status: {screening.status.replace("_", " ")}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="features" style={{ padding: "30px 0 80px" }}>
        <div className="container" style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
            {/* Left Column: Donor Summary, Questionnaire & Documents */}
            <div style={{ gridColumn: "span 2" }}>
              {/* Donor Summary Card */}
              <div className="form-section" style={{ marginBottom: 24 }}>
                <h3 style={{ margin: "0 0 16px", color: "var(--secondary)" }}>
                  <i className="fas fa-id-card" style={{ marginRight: 8, color: "var(--primary)" }} /> Donor Summary
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, fontSize: 14 }}>
                  <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: "var(--gray)", textTransform: "uppercase" }}>Full Name</div>
                    <div style={{ fontWeight: 600 }}>{donor.name}</div>
                  </div>
                  <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: "var(--gray)", textTransform: "uppercase" }}>Blood Group</div>
                    <div style={{ fontWeight: 700, color: "var(--primary)", fontSize: 16 }}>{donor.bloodGroup}</div>
                  </div>
                  <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: "var(--gray)", textTransform: "uppercase" }}>Email</div>
                    <div style={{ fontWeight: 600 }}>{donor.email}</div>
                  </div>
                  <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: "var(--gray)", textTransform: "uppercase" }}>Phone</div>
                    <div style={{ fontWeight: 600 }}>{donor.phone}</div>
                  </div>
                  <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: "var(--gray)", textTransform: "uppercase" }}>Date of Birth</div>
                    <div style={{ fontWeight: 600 }}>
                      {donor.dateOfBirth ? new Date(donor.dateOfBirth).toLocaleDateString() : "Not specified"}
                    </div>
                  </div>
                  <div style={{ background: "#f8fafc", padding: 12, borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: "var(--gray)", textTransform: "uppercase" }}>Last Donation</div>
                    <div style={{ fontWeight: 600 }}>
                      {donor.lastDonationDate ? new Date(donor.lastDonationDate).toLocaleDateString() : "None on record"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Preliminary Flags Checklist */}
              {screening.preliminaryFlags && screening.preliminaryFlags.length > 0 && (
                <div className="form-section" style={{ marginBottom: 24, background: "#fffbeb", border: "1px solid #fde68a" }}>
                  <h3 style={{ margin: "0 0 12px", color: "#b45309" }}>
                    <i className="fas fa-triangle-exclamation" style={{ marginRight: 8 }} /> Items Requiring Clinical Verification ({screening.preliminaryFlags.length})
                  </h3>
                  <div style={{ display: "grid", gap: 10 }}>
                    {screening.preliminaryFlags.map((flag: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          padding: 12,
                          borderRadius: 6,
                          background: "white",
                          border: "1px solid #fef3c7",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                        }}
                      >
                        <span
                          style={{
                            background: flag.severity === "warning" ? "#fee2e2" : "#fef3c7",
                            color: flag.severity === "warning" ? "#991b1b" : "#92400e",
                            padding: "2px 8px",
                            borderRadius: 10,
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "uppercase",
                          }}
                        >
                          {flag.category}
                        </span>
                        <div style={{ fontSize: 13, color: "#334155" }}>{flag.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Questionnaire Breakdown */}
              <div className="form-section" style={{ marginBottom: 24 }}>
                <h3 style={{ margin: "0 0 16px", color: "var(--secondary)" }}>
                  <i className="fas fa-clipboard-list" style={{ marginRight: 8, color: "var(--primary)" }} /> Questionnaire Responses
                </h3>

                <div style={{ display: "grid", gap: 16 }}>
                  {/* General Health */}
                  <QuestionBlock title="1. General Health">
                    <AnswerItem label="Feels healthy & well today" val={q.generalHealth?.feelWell} />
                    <AnswerItem label="Current fever or illness" val={q.generalHealth?.hasFeverOrIllness} />
                    <AnswerItem label="Recent recovery from illness" val={q.generalHealth?.recoveredRecently} />
                    {q.generalHealth?.recentIllnessDetails && (
                      <div style={{ fontSize: 13, color: "#475569" }}>Details: {q.generalHealth.recentIllnessDetails}</div>
                    )}
                  </QuestionBlock>

                  {/* Medical History */}
                  <QuestionBlock title="2. Medical History">
                    <AnswerItem label="Chronic medical condition" val={q.medicalHistory?.chronicCondition} />
                    {q.medicalHistory?.chronicConditionDetails && (
                      <div style={{ fontSize: 13, color: "#475569" }}>Condition: {q.medicalHistory.chronicConditionDetails}</div>
                    )}
                    <AnswerItem label="Recent surgery past 6 months" val={q.medicalHistory?.recentSurgery} />
                    <AnswerItem label="Currently under medical care" val={q.medicalHistory?.underTreatment} />
                  </QuestionBlock>

                  {/* Medication */}
                  <QuestionBlock title="3. Medications">
                    <AnswerItem label="Taking medication" val={q.medication?.takingMedication} />
                    {q.medication?.medicationDetails && (
                      <div style={{ fontSize: 13, color: "#475569" }}>Prescriptions: {q.medication.medicationDetails}</div>
                    )}
                  </QuestionBlock>

                  {/* Physical Measurements */}
                  <QuestionBlock title="4. Measurements & Vitals">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 13 }}>
                      <div><strong>Weight:</strong> {q.measurements?.weightKg ? `${q.measurements.weightKg} kg` : "Not provided"}</div>
                      <div><strong>Hemoglobin:</strong> {q.measurements?.recentHemoglobin ? `${q.measurements.recentHemoglobin} g/dL` : "Not provided"}</div>
                      <div><strong>Systolic BP:</strong> {q.measurements?.bloodPressureSystolic || "Not tested"}</div>
                    </div>
                  </QuestionBlock>

                  {/* Recent Procedures */}
                  <QuestionBlock title="5. Procedures & Exposures">
                    <AnswerItem label="Tattoo / Piercing in 6 months" val={q.recentProcedures?.recentTattooOrPiercing} />
                    <AnswerItem label="Prior blood transfusion" val={q.recentProcedures?.recentTransfusion} />
                    <AnswerItem label="High-risk travel exposure" val={q.travelExposure?.highRiskTravel} />
                  </QuestionBlock>

                  {/* Infection Screening */}
                  <QuestionBlock title="6. Infection Risk">
                    <AnswerItem label="Hepatitis / Jaundice history" val={q.infectionRisk?.hepatitisOrJaundiceHistory} />
                    <AnswerItem label="HIV / STD risk exposure" val={q.infectionRisk?.hivRiskExposure} />
                    <AnswerItem label="Other infectious disease risk" val={q.infectionRisk?.otherInfectionRisk} />
                  </QuestionBlock>
                </div>
              </div>

              {/* Uploaded Documents List */}
              <div className="form-section">
                <h3 style={{ margin: "0 0 16px", color: "var(--secondary)" }}>
                  <i className="fas fa-file-medical" style={{ marginRight: 8, color: "var(--primary)" }} /> Attached Medical Records ({documents.length})
                </h3>
                {documents.length === 0 ? (
                  <p style={{ color: "var(--gray)", fontSize: 14 }}>No documents attached to this screening.</p>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {documents.map((doc: any) => (
                      <div
                        key={doc._id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "12px 16px",
                          background: "#f8fafc",
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>{doc.originalFileName}</div>
                          <div style={{ fontSize: 12, color: "var(--gray)" }}>
                            {doc.documentType.replace("_", " ").toUpperCase()} &bull; {(doc.fileSize / 1024).toFixed(1)} KB &bull; Uploaded {new Date(doc.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={downloadingDocId === doc._id}
                          onClick={() => handleDownloadDoc(doc._id, doc.originalFileName)}
                          className="btn btn-outline"
                          style={{ padding: "6px 14px", fontSize: 13 }}
                        >
                          {downloadingDocId === doc._id ? (
                            <>
                              <i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} /> Downloading...
                            </>
                          ) : (
                            <>
                              <i className="fas fa-download" style={{ marginRight: 6 }} /> Open / Download
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Review Decision & Audit Trail */}
            <div>
              {/* Clinical Decision Form */}
              <div className="form-section" style={{ position: "sticky", top: 80, marginBottom: 24 }}>
                <h3 style={{ margin: "0 0 16px", color: "var(--primary)" }}>
                  <i className="fas fa-user-doctor" style={{ marginRight: 8 }} /> Clinical Review Decision
                </h3>

                <form onSubmit={handleSubmitDecision}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                      Decision *
                    </label>
                    <select
                      value={decision}
                      onChange={(e) => setDecision(e.target.value)}
                      style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #cbd5e1", backgroundColor: "white", fontSize: 14 }}
                    >
                      <option value="approved">Approved (Clear for Donation)</option>
                      <option value="temporarily_deferred">Temporarily Deferred</option>
                      <option value="permanently_deferred">Permanently Deferred</option>
                      <option value="needs_information">Needs More Information</option>
                    </select>
                  </div>

                  {decision === "temporarily_deferred" && (
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                        Deferred Until Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={deferredUntil}
                        onChange={(e) => setDeferredUntil(e.target.value)}
                        style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 }}
                      />
                    </div>
                  )}

                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 13, fontWeight: 700, display: "block", marginBottom: 6 }}>
                      Clinical Reason / Notes {decision !== "approved" ? "*" : "(Optional)"}
                    </label>
                    <textarea
                      rows={4}
                      placeholder={decision === "approved" ? "Clinical notes regarding clearance..." : "Provide clinical explanation for deferral or info request..."}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14 }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="btn"
                    style={{ width: "100%", padding: 12, fontSize: 15 }}
                  >
                    {submittingReview ? (
                      <>
                        <i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} /> Recording Decision...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-signature" style={{ marginRight: 6 }} /> Finalize Clinical Decision
                      </>
                    )}
                  </button>
                </form>

                {screening.reviewerDecision?.reviewer && (
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #e2e8f0", fontSize: 12, color: "var(--gray)" }}>
                    <div><strong>Last Reviewed by:</strong> {screening.reviewerDecision.reviewer.name}</div>
                    <div><strong>Reviewed on:</strong> {new Date(screening.reviewerDecision.reviewedAt).toLocaleString()}</div>
                  </div>
                )}
              </div>

              {/* Medical Audit Trail Card */}
              <div className="form-section">
                <h4 style={{ margin: "0 0 12px", color: "var(--secondary)" }}>
                  <i className="fas fa-shield-alt" style={{ marginRight: 6, color: "var(--primary)" }} /> Audit Log Trail
                </h4>
                {auditLogs.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--gray)" }}>No audit events logged yet.</div>
                ) : (
                  <div style={{ display: "grid", gap: 8, maxHeight: 300, overflowY: "auto", fontSize: 12 }}>
                    {auditLogs.map((log: any) => (
                      <div key={log._id} style={{ padding: 8, background: "#f8fafc", borderRadius: 6 }}>
                        <div style={{ fontWeight: 600, color: "var(--secondary)" }}>
                          {log.action.replace(/_/g, " ")}
                        </div>
                        <div style={{ color: "var(--gray)", fontSize: 11 }}>
                          by {log.actor?.name || "System"} ({log.actorRole}) &bull; {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}

function QuestionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#f8fafc", padding: 14, borderRadius: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--secondary)", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "grid", gap: 6 }}>{children}</div>
    </div>
  );
}

function AnswerItem({ label, val }: { label: string; val: any }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "#475569" }}>{label}</span>
      <span style={{ fontWeight: 600, color: val === true ? "var(--primary)" : val === false ? "var(--success)" : "var(--gray)" }}>
        {val === true ? "Yes" : val === false ? "No" : "—"}
      </span>
    </div>
  );
}

