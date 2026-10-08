import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { toast } from "../components/AppToaster";
import { useAuth } from "../lib/auth";
import { api, API_BASE_URL } from "../lib/api";

export const Route = createFileRoute("/health-screening")({
  head: () => ({
    meta: [
      { title: "Donor Health Screening & Medical Review — REDhope" },
      {
        name: "description",
        content: "Submit your donor health questionnaire and medical reports for clinical review.",
      },
      { property: "og:title", content: "Donor Health Screening — REDhope" },
      { property: "og:description", content: "Clinical pre-screening and medical document review for blood donors." },
    ],
  }),
  component: HealthScreeningPage,
});

interface MedicalDocumentMeta {
  _id: string;
  documentType: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  status: string;
  createdAt: string;
}

interface PreliminaryFlag {
  code: string;
  severity: "info" | "review" | "warning";
  message: string;
  category: string;
}

interface ReviewerDecision {
  decision: string;
  reason?: string | null;
  reviewedAt?: string | null;
  deferredUntil?: string | null;
}

interface HealthScreeningData {
  _id: string;
  status: "draft" | "submitted" | "under_review" | "needs_information" | "approved" | "temporarily_deferred" | "permanently_deferred" | "rejected";
  questionnaire: Record<string, any>;
  preliminaryFlags: PreliminaryFlag[];
  reviewerDecision?: ReviewerDecision | null;
  consentGiven: boolean;
  consentTimestamp?: string | null;
  submittedAt?: string | null;
}

function HealthScreeningPage() {
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [screening, setScreening] = useState<HealthScreeningData | null>(null);
  const [documents, setDocuments] = useState<MedicalDocumentMeta[]>([]);
  const [activeStep, setActiveStep] = useState<number>(1);

  // Form State
  const [consentChecked, setConsentChecked] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({
    generalHealth: { feelWell: true, hasFeverOrIllness: false, recoveredRecently: false, recentIllnessDetails: "" },
    medicalHistory: { chronicCondition: false, chronicConditionDetails: "", recentSurgery: false, recentSurgeryDetails: "", underTreatment: false, underTreatmentDetails: "" },
    medication: { takingMedication: false, medicationDetails: "" },
    donationHistory: { donatedBefore: false, lastDonationDate: "", adverseReactionHistory: false, reactionDetails: "" },
    recentProcedures: { recentTattooOrPiercing: false, recentTransfusion: false, procedureDetails: "" },
    travelExposure: { highRiskTravel: false, travelDetails: "" },
    pregnancyRelated: { isApplicable: false, currentlyPregnant: false, breastfeeding: false, recentDelivery: false },
    measurements: { weightKg: "", recentHemoglobin: "", bloodPressureSystolic: "", bloodPressureDiastolic: "", pulseRate: "" },
    infectionRisk: { hepatitisOrJaundiceHistory: false, hivRiskExposure: false, otherInfectionRisk: false, infectionRiskDetails: "" }
  });

  // Selected file for upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>("blood_report");

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      loadScreening();
    } else if (!authLoading && !isAuthenticated) {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated]);

  const loadScreening = async () => {
    setLoading(true);
    try {
      const res = await api.get<{
        success: boolean;
        data: { screening: HealthScreeningData; documents: MedicalDocumentMeta[] };
      }>("/health-screening/me");

      if (res?.success && res.data) {
        setScreening(res.data.screening);
        setDocuments(res.data.documents || []);

        if (res.data.screening.questionnaire && Object.keys(res.data.screening.questionnaire).length > 0) {
          setFormData((prev) => ({
            ...prev,
            ...res.data.screening.questionnaire
          }));
        }

        if (res.data.screening.consentGiven) {
          setConsentChecked(true);
        }

        // Set initial step based on status
        if (res.data.screening.status !== "draft") {
          setActiveStep(5); // Show status card directly if already submitted or reviewed
        } else if (res.data.screening.consentGiven) {
          setActiveStep(2);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load health screening data.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      const res = await api.put<{
        success: boolean;
        data: { screening: HealthScreeningData; documents: MedicalDocumentMeta[] };
      }>("/health-screening/me", {
        questionnaire: formData,
        consentGiven: consentChecked
      });

      if (res?.success) {
        setScreening(res.data.screening);
        toast.success("Health questionnaire draft saved.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save draft.");
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select a file to upload.");
      return;
    }

    if (documents.length >= 5) {
      toast.error("Maximum 5 documents allowed per screening.");
      return;
    }

    const allowed = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowed.includes(selectedFile.type)) {
      toast.error("Only PDF, JPG, and PNG files are accepted.");
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      toast.error("File size cannot exceed 5MB.");
      return;
    }

    setUploading(true);
    try {
      const uploadData = new FormData();
      uploadData.append("file", selectedFile);
      uploadData.append("documentType", docType);

      const res = await fetch(`${API_BASE_URL}/health-screening/me/documents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: uploadData
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Upload failed");
      }

      toast.success("Medical document uploaded securely.");
      setSelectedFile(null);
      // Reload documents
      const docsRes = await api.get<{ success: boolean; data: { documents: MedicalDocumentMeta[] } }>("/health-screening/me/documents");
      if (docsRes?.success) {
        setDocuments(docsRes.data.documents);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to upload document.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this medical report?")) return;
    try {
      await api.delete(`/health-screening/me/documents/${docId}`);
      toast.success("Document deleted.");
      setDocuments((prev) => prev.filter((d) => d._id !== docId));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete document.");
    }
  };

  const handleSubmitScreening = async () => {
    if (!consentChecked) {
      toast.error("You must provide informed consent before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Save latest questionnaire
      await api.put("/health-screening/me", {
        questionnaire: formData,
        consentGiven: true
      });

      // 2. Submit for review
      const res = await api.post<{ success: boolean; data: { screening: HealthScreeningData } }>("/health-screening/me/submit", {
        consentGiven: true
      });

      if (res?.success) {
        setScreening(res.data.screening);
        setActiveStep(5);
        toast.success("Screening submitted successfully for medical review!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit health screening.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <>
        <Navbar solid />
        <div style={{ minHeight: "60vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ textAlign: "center", color: "var(--primary)" }}>
            <i className="fas fa-spinner fa-spin fa-3x" />
            <p style={{ marginTop: 16, color: "var(--gray)" }}>Loading Health Screening System...</p>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <>
        <Navbar solid />
        <section className="features" style={{ minHeight: "70vh", display: "flex", alignItems: "center" }}>
          <div className="container" style={{ maxWidth: 520, margin: "40px auto", textAlign: "center" }}>
            <div className="form-section">
              <i className="fas fa-user-shield fa-3x" style={{ color: "var(--primary)", marginBottom: 16 }} />
              <h2>Sign In Required</h2>
              <p style={{ color: "var(--gray)", marginBottom: 24 }}>
                Health screening and medical document submissions require a verified donor account to ensure privacy and clinical confidentiality.
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <Link to="/login" className="btn">Sign In</Link>
                <Link to="/register" className="btn btn-outline">Register as Donor</Link>
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

      <section className="hero hero-compact" style={{ minHeight: "35vh", padding: "60px 0 30px" }}>
        <div className="hero-inner">
          <h1>Donor Health Screening & Medical Review</h1>
          <p>Confidential clinical pre-screening and medical record verification for voluntary blood donors.</p>
        </div>
      </section>

      <section className="features" style={{ padding: "30px 0 80px" }}>
        <div className="container" style={{ maxWidth: 960, margin: "0 auto" }}>
          {/* Step Progress Navigation */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 32,
              background: "white",
              padding: "16px 24px",
              borderRadius: 12,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              overflowX: "auto",
              gap: 8,
            }}
          >
            {[
              { num: 1, label: "1. Consent & Disclaimer", icon: "fa-shield-halved" },
              { num: 2, label: "2. Health Questionnaire", icon: "fa-file-medical" },
              { num: 3, label: "3. Medical Documents", icon: "fa-file-arrow-up" },
              { num: 4, label: "4. Review & Submit", icon: "fa-clipboard-check" },
              { num: 5, label: "5. Clinical Status", icon: "fa-stethoscope" },
            ].map((step) => {
              const isCurrent = activeStep === step.num;
              const isDone = activeStep > step.num;
              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => setActiveStep(step.num)}
                  disabled={step.num === 5 && (!screening || screening.status === "draft")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 14px",
                    borderRadius: 20,
                    border: "none",
                    background: isCurrent ? "var(--primary)" : isDone ? "#f0fdf4" : "transparent",
                    color: isCurrent ? "white" : isDone ? "var(--success)" : "var(--gray)",
                    fontWeight: isCurrent ? 700 : 500,
                    fontSize: 13,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  <i className={`fas ${step.icon}`} />
                  <span>{step.label}</span>
                </button>
              );
            })}
          </div>

          {/* STEP 1: CONSENT & DISCLAIMER */}
          {activeStep === 1 && (
            <div className="form-section">
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <i className="fas fa-shield-alt fa-2x" style={{ color: "var(--primary)" }} />
                <h2 style={{ margin: 0, color: "var(--secondary)" }}>Medical Disclaimer & Informed Consent</h2>
              </div>
              <p style={{ color: "var(--gray)", fontSize: 15, lineHeight: 1.6 }}>
                Please review and acknowledge the following medical guidelines and data processing declarations prior to completing your screening.
              </p>

              <div
                style={{
                  background: "#f8fafc",
                  padding: 24,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  marginBottom: 24,
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: "#334155",
                }}
              >
                <h4 style={{ color: "var(--secondary)", marginTop: 0 }}>Important Declarations:</h4>
                <ul style={{ paddingLeft: 20, margin: "12px 0" }}>
                  <li><strong>Self-Declaration Accuracy:</strong> All information provided in this questionnaire must be accurate and truthful to the best of your knowledge.</li>
                  <li><strong>Document Ownership:</strong> Any uploaded lab reports, certificates, or blood records belong to you or you have explicit authorization to submit them.</li>
                  <li><strong>Not a Medical Diagnosis:</strong> This pre-screening is an administrative tool to evaluate blood donor safety. It does NOT constitute medical diagnosis or individual clinical advice.</li>
                  <li><strong>Human Clinical Authority:</strong> Final donor suitability and whole blood collection clearance is solely determined by authorized medical personnel and blood centre officers.</li>
                  <li><strong>Strict Data Privacy:</strong> Your sensitive medical information will only be processed for blood donation evaluation and will NEVER be shared with organizers or public users.</li>
                </ul>
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  cursor: "pointer",
                  padding: 16,
                  borderRadius: 8,
                  background: consentChecked ? "#f0fdf4" : "white",
                  border: `2px solid ${consentChecked ? "var(--success)" : "#cbd5e1"}`,
                  marginBottom: 24,
                }}
              >
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  style={{ width: 20, height: 20, marginTop: 2, accentColor: "var(--primary)" }}
                />
                <span style={{ fontSize: 14, color: "#1e293b", fontWeight: 600 }}>
                  I confirm that I have read, understood, and agree to the declarations above, and consent to authorized REDhope medical personnel reviewing my responses.
                </span>
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button
                  type="button"
                  disabled={!consentChecked}
                  onClick={() => setActiveStep(2)}
                  className="btn"
                  style={{ opacity: consentChecked ? 1 : 0.5 }}
                >
                  Proceed to Health Questionnaire &rarr;
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: STRUCTURED QUESTIONNAIRE */}
          {activeStep === 2 && (
            <div className="form-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div>
                  <h2 style={{ margin: 0, color: "var(--secondary)" }}>Health Screening Questionnaire</h2>
                  <p style={{ color: "var(--gray)", margin: "4px 0 0", fontSize: 14 }}>
                    Answer each section carefully to help medical staff review your donor suitability.
                  </p>
                </div>
                <button type="button" onClick={handleSaveDraft} className="btn btn-outline" style={{ fontSize: 13 }}>
                  <i className="fas fa-save" style={{ marginRight: 6 }} /> Save Draft
                </button>
              </div>

              {/* 1. General Health */}
              <div style={{ marginBottom: 28, padding: 18, background: "#f8fafc", borderRadius: 8 }}>
                <h3 style={{ fontSize: 16, color: "var(--primary)", marginTop: 0 }}>
                  <i className="fas fa-heart-pulse" style={{ marginRight: 8 }} /> 1. General Health
                </h3>
                <div style={{ display: "grid", gap: 14 }}>
                  <RadioRow
                    label="Do you currently feel healthy and well today?"
                    checked={formData.generalHealth.feelWell}
                    onChange={(val) => setFormData((p) => ({ ...p, generalHealth: { ...p.generalHealth, feelWell: val } }))}
                  />
                  <RadioRow
                    label="Do you currently have a fever, cough, or infectious illness?"
                    checked={formData.generalHealth.hasFeverOrIllness}
                    onChange={(val) => setFormData((p) => ({ ...p, generalHealth: { ...p.generalHealth, hasFeverOrIllness: val } }))}
                  />
                  <RadioRow
                    label="Have you recently recovered from an acute illness in the last 14 days?"
                    checked={formData.generalHealth.recoveredRecently}
                    onChange={(val) => setFormData((p) => ({ ...p, generalHealth: { ...p.generalHealth, recoveredRecently: val } }))}
                  />
                </div>
              </div>

              {/* 2. Medical History */}
              <div style={{ marginBottom: 28, padding: 18, background: "#f8fafc", borderRadius: 8 }}>
                <h3 style={{ fontSize: 16, color: "var(--primary)", marginTop: 0 }}>
                  <i className="fas fa-hospital" style={{ marginRight: 8 }} /> 2. Medical History & Conditions
                </h3>
                <div style={{ display: "grid", gap: 14 }}>
                  <RadioRow
                    label="Do you have any ongoing or chronic medical condition (e.g. diabetes, cardiac, asthma)?"
                    checked={formData.medicalHistory.chronicCondition}
                    onChange={(val) => setFormData((p) => ({ ...p, medicalHistory: { ...p.medicalHistory, chronicCondition: val } }))}
                  />
                  {formData.medicalHistory.chronicCondition && (
                    <input
                      type="text"
                      placeholder="Please specify condition details"
                      value={formData.medicalHistory.chronicConditionDetails}
                      onChange={(e) => setFormData((p) => ({ ...p, medicalHistory: { ...p.medicalHistory, chronicConditionDetails: e.target.value } }))}
                      style={{ padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
                    />
                  )}
                  <RadioRow
                    label="Have you undergone any surgery or invasive procedure in the past 6 months?"
                    checked={formData.medicalHistory.recentSurgery}
                    onChange={(val) => setFormData((p) => ({ ...p, medicalHistory: { ...p.medicalHistory, recentSurgery: val } }))}
                  />
                  <RadioRow
                    label="Are you currently under ongoing medical treatment or doctor's care?"
                    checked={formData.medicalHistory.underTreatment}
                    onChange={(val) => setFormData((p) => ({ ...p, medicalHistory: { ...p.medicalHistory, underTreatment: val } }))}
                  />
                </div>
              </div>

              {/* 3. Medication */}
              <div style={{ marginBottom: 28, padding: 18, background: "#f8fafc", borderRadius: 8 }}>
                <h3 style={{ fontSize: 16, color: "var(--primary)", marginTop: 0 }}>
                  <i className="fas fa-pills" style={{ marginRight: 8 }} /> 3. Medications
                </h3>
                <RadioRow
                  label="Are you currently taking any prescription drugs, antibiotics, or regular medication?"
                  checked={formData.medication.takingMedication}
                  onChange={(val) => setFormData((p) => ({ ...p, medication: { ...p.medication, takingMedication: val } }))}
                />
                {formData.medication.takingMedication && (
                  <input
                    type="text"
                    placeholder="List medications (e.g. Amoxicillin, Aspirin)"
                    value={formData.medication.medicationDetails}
                    onChange={(e) => setFormData((p) => ({ ...p, medication: { ...p.medication, medicationDetails: e.target.value } }))}
                    style={{ marginTop: 10, padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", width: "100%" }}
                  />
                )}
              </div>

              {/* 4. Measurements */}
              <div style={{ marginBottom: 28, padding: 18, background: "#f8fafc", borderRadius: 8 }}>
                <h3 style={{ fontSize: 16, color: "var(--primary)", marginTop: 0 }}>
                  <i className="fas fa-weight-scale" style={{ marginRight: 8 }} /> 4. Physical Measurements & Vitals
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Weight in kg *</label>
                    <input
                      type="number"
                      placeholder="e.g. 65"
                      value={formData.measurements.weightKg}
                      onChange={(e) => setFormData((p) => ({ ...p, measurements: { ...p.measurements, weightKg: Number(e.target.value) } }))}
                      style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Hemoglobin (g/dL if tested)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 13.5"
                      value={formData.measurements.recentHemoglobin}
                      onChange={(e) => setFormData((p) => ({ ...p, measurements: { ...p.measurements, recentHemoglobin: Number(e.target.value) } }))}
                      style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>Systolic BP (optional)</label>
                    <input
                      type="number"
                      placeholder="e.g. 120"
                      value={formData.measurements.bloodPressureSystolic}
                      onChange={(e) => setFormData((p) => ({ ...p, measurements: { ...p.measurements, bloodPressureSystolic: Number(e.target.value) } }))}
                      style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
                    />
                  </div>
                </div>
              </div>

              {/* 5. Recent Exposures & Procedures */}
              <div style={{ marginBottom: 28, padding: 18, background: "#f8fafc", borderRadius: 8 }}>
                <h3 style={{ fontSize: 16, color: "var(--primary)", marginTop: 0 }}>
                  <i className="fas fa-syringe" style={{ marginRight: 8 }} /> 5. Recent Procedures & Exposure
                </h3>
                <div style={{ display: "grid", gap: 14 }}>
                  <RadioRow
                    label="Have you had a tattoo, piercing, or acupuncture in the past 6 months?"
                    checked={formData.recentProcedures.recentTattooOrPiercing}
                    onChange={(val) => setFormData((p) => ({ ...p, recentProcedures: { ...p.recentProcedures, recentTattooOrPiercing: val } }))}
                  />
                  <RadioRow
                    label="Have you ever received a blood transfusion?"
                    checked={formData.recentProcedures.recentTransfusion}
                    onChange={(val) => setFormData((p) => ({ ...p, recentProcedures: { ...p.recentProcedures, recentTransfusion: val } }))}
                  />
                  <RadioRow
                    label="Have you had recent travel to malaria or high-risk infection endemic regions?"
                    checked={formData.travelExposure.highRiskTravel}
                    onChange={(val) => setFormData((p) => ({ ...p, travelExposure: { ...p.travelExposure, highRiskTravel: val } }))}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button type="button" onClick={() => setActiveStep(1)} className="btn btn-outline">
                  &larr; Back to Consent
                </button>
                <button type="button" onClick={() => setActiveStep(3)} className="btn">
                  Continue to Document Upload &rarr;
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: DOCUMENT UPLOAD */}
          {activeStep === 3 && (
            <div className="form-section">
              <h2 style={{ margin: "0 0 8px", color: "var(--secondary)" }}>Medical Document Upload</h2>
              <p style={{ color: "var(--gray)", fontSize: 14, marginBottom: 24 }}>
                Upload verified blood test reports, hemoglobin lab slips, or medical fitness certificates (PDF, JPG, PNG up to 5MB).
              </p>

              <form onSubmit={handleFileUpload} style={{ background: "#f8fafc", padding: 20, borderRadius: 8, marginBottom: 24 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Document Type</label>
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #cbd5e1", backgroundColor: "white" }}
                    >
                      <option value="blood_report">Blood Test Report</option>
                      <option value="hemoglobin_report">Hemoglobin Report</option>
                      <option value="medical_certificate">Medical Certificate</option>
                      <option value="fitness_certificate">Fitness Certificate</option>
                      <option value="other">Other Clinical Document</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Select File (Max 5MB)</label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                      style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1", backgroundColor: "white" }}
                    />
                  </div>
                </div>

                <button type="submit" disabled={uploading || !selectedFile} className="btn" style={{ padding: "10px 20px" }}>
                  {uploading ? (
                    <>
                      <i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} /> Uploading Privately...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-upload" style={{ marginRight: 6 }} /> Upload Medical Document
                    </>
                  )}
                </button>
              </form>

              {/* Uploaded Documents List */}
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Uploaded Documents ({documents.length}/5)</h3>
              {documents.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", background: "#f8fafc", borderRadius: 8, color: "var(--gray)" }}>
                  No documents uploaded yet. Document upload is optional but helps clinical review.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
                  {documents.map((doc) => (
                    <div
                      key={doc._id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        background: "white",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <i
                          className={`fas ${doc.mimeType === "application/pdf" ? "fa-file-pdf" : "fa-file-image"}`}
                          style={{ fontSize: 24, color: "var(--primary)" }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--secondary)" }}>{doc.originalFileName}</div>
                          <div style={{ fontSize: 12, color: "var(--gray)" }}>
                            {doc.documentType.replace("_", " ").toUpperCase()} &bull; {(doc.fileSize / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <a
                          href={`${API_BASE_URL}/health-screening/documents/${doc._id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-outline"
                          style={{ padding: "6px 12px", fontSize: 12 }}
                        >
                          <i className="fas fa-eye" /> View
                        </a>
                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(doc._id)}
                          className="btn btn-outline"
                          style={{ padding: "6px 12px", fontSize: 12, color: "var(--primary)", borderColor: "var(--primary)" }}
                        >
                          <i className="fas fa-trash" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button type="button" onClick={() => setActiveStep(2)} className="btn btn-outline">
                  &larr; Back to Questionnaire
                </button>
                <button type="button" onClick={() => setActiveStep(4)} className="btn">
                  Continue to Summary &rarr;
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & SUBMIT */}
          {activeStep === 4 && (
            <div className="form-section">
              <h2 style={{ margin: "0 0 8px", color: "var(--secondary)" }}>Review & Submit Screening</h2>
              <p style={{ color: "var(--gray)", fontSize: 14, marginBottom: 24 }}>
                Review your responses and attached documents before submitting for clinical review.
              </p>

              {/* Preliminary Flag Preview */}
              {screening?.preliminaryFlags && screening.preliminaryFlags.length > 0 && (
                <div style={{ padding: 16, background: "#fffbeb", borderRadius: 8, border: "1px solid #fde68a", marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#b45309", fontWeight: 700, marginBottom: 8 }}>
                    <i className="fas fa-circle-info" /> Items Requiring Clinical Verification ({screening.preliminaryFlags.length})
                  </div>
                  <p style={{ fontSize: 13, color: "#92400e", margin: "0 0 10px" }}>
                    The following self-reported answers will be reviewed by our authorized medical officer. This is NOT an automatic diagnosis or rejection.
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#78350f" }}>
                    {screening.preliminaryFlags.map((flag, idx) => (
                      <li key={idx} style={{ marginBottom: 4 }}>
                        <strong>{flag.category}:</strong> {flag.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ background: "#f8fafc", padding: 18, borderRadius: 8, marginBottom: 24 }}>
                <h4 style={{ margin: "0 0 10px" }}>Summary Overview:</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 14 }}>
                  <div><strong>Donor Name:</strong> {user.name}</div>
                  <div><strong>Blood Group:</strong> {user.bloodGroup}</div>
                  <div><strong>Weight:</strong> {formData.measurements.weightKg ? `${formData.measurements.weightKg} kg` : "Not entered"}</div>
                  <div><strong>Attached Reports:</strong> {documents.length} file(s)</div>
                  <div><strong>Informed Consent:</strong> <span style={{ color: "var(--success)" }}><i className="fas fa-check" /> Acknowledged</span></div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button type="button" onClick={() => setActiveStep(3)} className="btn btn-outline">
                  &larr; Back to Documents
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmitScreening}
                  className="btn"
                  style={{ padding: "12px 28px", fontSize: 15 }}
                >
                  {submitting ? (
                    <>
                      <i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} /> Submitting for Review...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-paper-plane" style={{ marginRight: 8 }} /> Submit for Medical Review
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: STATUS VIEW */}
          {activeStep === 5 && (
            <div className="form-section" style={{ textAlign: "center", padding: "40px 24px" }}>
              <StatusBadge status={screening?.status || "draft"} />

              <h2 style={{ marginTop: 16, marginBottom: 8, color: "var(--secondary)" }}>
                {screening?.status === "approved"
                  ? "Medically Approved for Donation"
                  : screening?.status === "submitted"
                  ? "Screening Submitted for Review"
                  : screening?.status === "temporarily_deferred"
                  ? "Temporarily Deferred"
                  : screening?.status === "permanently_deferred"
                  ? "Permanently Deferred"
                  : screening?.status === "needs_information"
                  ? "Additional Information Required"
                  : "Health Screening Draft"}
              </h2>

              <p style={{ maxWidth: 600, margin: "0 auto 24px", color: "var(--gray)", fontSize: 15, lineHeight: 1.6 }}>
                {screening?.status === "approved"
                  ? "Your donor health screening has been cleared by authorized medical personnel. You may now register for blood donation camps and emergency matching."
                  : screening?.status === "submitted"
                  ? "Your questionnaire and medical records are currently queued for authorized clinical review. You will receive an in-app notification when the review decision is finalized."
                  : screening?.status === "temporarily_deferred"
                  ? `Clinical review indicated a temporary deferral period: ${screening.reviewerDecision?.reason || "Follow-up required."}`
                  : screening?.status === "permanently_deferred"
                  ? `Medical review decision: ${screening.reviewerDecision?.reason || "Ineligible for voluntary whole blood donation."}`
                  : "Please complete all steps to submit your screening."}
              </p>

              {screening?.reviewerDecision?.deferredUntil && (
                <div
                  style={{
                    display: "inline-block",
                    padding: "10px 20px",
                    borderRadius: 30,
                    background: "#fef3c7",
                    color: "#92400e",
                    fontWeight: 700,
                    marginBottom: 24,
                  }}
                >
                  <i className="fas fa-calendar-alt" style={{ marginRight: 8 }} />
                  Eligible to Re-apply After: {new Date(screening.reviewerDecision.deferredUntil).toLocaleDateString()}
                </div>
              )}

              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <Link to="/dashboard" className="btn">
                  Donor Dashboard
                </Link>
                <Link to="/eligibility" className="btn btn-outline">
                  View Overall Eligibility
                </Link>
                {screening?.status !== "approved" && screening?.status !== "permanently_deferred" && (
                  <button type="button" onClick={() => setActiveStep(2)} className="btn btn-outline">
                    Edit Questionnaire
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}

function RadioRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (val: boolean) => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
      <span style={{ fontSize: 14, color: "#334155" }}>{label}</span>
      <div style={{ display: "flex", gap: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input
            type="radio"
            checked={checked === true}
            onChange={() => onChange(true)}
            style={{ accentColor: "var(--primary)" }}
          />
          Yes
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input
            type="radio"
            checked={checked === false}
            onChange={() => onChange(false)}
            style={{ accentColor: "var(--primary)" }}
          />
          No
        </label>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  let bg = "#e2e8f0";
  let color = "#475569";
  let icon = "fa-hourglass-start";

  if (status === "approved") {
    bg = "#dcfce7";
    color = "#166534";
    icon = "fa-check-circle";
  } else if (status === "submitted" || status === "under_review") {
    bg = "#dbeafe";
    color = "#1e40af";
    icon = "fa-clock";
  } else if (status === "temporarily_deferred") {
    bg = "#fef3c7";
    color = "#92400e";
    icon = "fa-calendar-times";
  } else if (status === "permanently_deferred" || status === "rejected") {
    bg = "#fee2e2";
    color = "#991b1b";
    icon = "fa-times-circle";
  }

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 18px",
        borderRadius: 24,
        background: bg,
        color: color,
        fontWeight: 700,
        fontSize: 14,
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      <i className={`fas ${icon}`} />
      <span>{status.replace("_", " ")}</span>
    </div>
  );
}

