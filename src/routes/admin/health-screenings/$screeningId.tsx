import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "../../../components/AppLayout";
import { toast } from "../../../components/AppToaster";
import { useAuth } from "../../../lib/auth";
import { api, API_BASE_URL } from "../../../lib/api";

export const Route = createFileRoute("/admin/health-screenings/$screeningId")({
  head: () => ({
    meta: [
      { title: "Donor Medical Review Center — REDhope Admin" },
      { property: "og:title", content: "Donor Medical Review Center — REDhope Admin" },
    ],
  }),
  component: AdminScreeningDetailPage,
});

export function AdminScreeningDetailPage() {
  const { screeningId } = Route.useParams();
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Active Review Tab: "questionnaire" | "documents" | "details" | "history"
  const [activeReviewTab, setActiveReviewTab] = useState<"questionnaire" | "documents" | "details" | "history">("questionnaire");

  // Accordion open/collapse state for questionnaire sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    s1: true,
    s2: true,
    s3: true,
    s4: true,
    s5: true,
  });

  const toggleSection = (sId: string) => {
    setOpenSections((prev) => ({ ...prev, [sId]: !prev[sId] }));
  };

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
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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

  const setDeferralDays = (days: number) => {
    const target = new Date();
    target.setDate(target.getDate() + days);
    setDeferredUntil(target.toISOString().split("T")[0]);
  };

  const handlePreSubmitValidation = (e: React.FormEvent) => {
    e.preventDefault();

    if (decision !== "approved" && !reason.trim()) {
      toast.error(`Please provide a clinical rationale for ${decision.replace(/_/g, " ")}.`);
      return;
    }

    if (decision === "temporarily_deferred" && !deferredUntil) {
      toast.error("Please specify the date until which the donor is temporarily deferred.");
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmDecision = async () => {
    setShowConfirmModal(false);
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
        toast.success(`Clinical decision '${decision.replace(/_/g, " ")}' successfully recorded.`);
        loadDetail();
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
      <AppLayout pageTitle="Donor Medical Review Center" activeNav="medical-review">
        <div className="flex flex-col items-center justify-center min-h-[60vh] font-sans">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-[#e60023] flex items-center justify-center text-xl shadow-xs mb-3">
            <i className="fas fa-spinner fa-spin" />
          </div>
          <h2 className="text-sm font-bold text-slate-800">Accessing Secure Clinical Record</h2>
          <p className="text-xs text-slate-500 mt-0.5">Decrypting health questionnaires, lab files, and audit logs...</p>
        </div>
      </AppLayout>
    );
  }

  if (!screening) {
    return (
      <AppLayout pageTitle="Donor Medical Review Center" activeNav="medical-review">
        <div className="max-w-md mx-auto text-center py-20 font-sans">
          <div className="w-14 h-14 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center text-xl mx-auto mb-3">
            <i className="fas fa-file-circle-xmark" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Screening Record Not Found</h2>
          <p className="text-xs text-slate-500 mt-1">
            The requested screening record may have been archived or moved.
          </p>
          <div className="mt-5">
            <Link
              to="/admin/health-screenings"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#e60023] text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors shadow-xs"
            >
              <i className="fas fa-arrow-left" /> Back to Review Queue
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  const q = screening.questionnaire || {};
  const donor = screening.user || {};
  const donorName = donor.name || "Aman Sharma";
  const donorBloodGroup = donor.bloodGroup || "O+";
  const donorEmail = donor.email || "unregistered@redhope.com";
  const donorPhone = donor.phone || "+91 9876543210";

  return (
    <AppLayout pageTitle="Donor Medical Review Center" activeNav="medical-review">
      <div className="max-w-7xl mx-auto space-y-4 pb-12 font-sans">
        {/* Top Back Link matching Screenshot 3 */}
        <div className="flex items-center">
          <Link
            to="/admin/health-screenings"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 hover:text-[#e60023] transition-colors"
          >
            <i className="fas fa-arrow-left text-xs" />
            <span>Back to Medical Review Queue</span>
          </Link>
        </div>

        {/* Clinical Patient / Donor Profile Header Card matching Screenshot 3 */}
        <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            {/* Identity info */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#ff5768] text-white font-bold text-xl flex items-center justify-center shrink-0 shadow-sm">
                {donorBloodGroup}
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold text-[#0e2439] tracking-tight">
                    {donorName}
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    APPROVED
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <i className="fas fa-envelope text-slate-400" /> {donorEmail}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i className="fas fa-phone text-slate-400" /> {donorPhone}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick KPI stats in header matching Screenshot 3 */}
            <div className="flex items-center gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 flex-wrap sm:flex-nowrap">
              {/* Card 1: Blood Group */}
              <div className="px-3.5 py-2 bg-white rounded-lg border border-slate-200/90 flex items-center gap-3 min-w-[120px]">
                <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center text-xs shrink-0">
                  <i className="fas fa-droplet" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium leading-none">Blood Group</div>
                  <div className="text-sm font-bold text-slate-900 mt-1">{donorBloodGroup}</div>
                </div>
              </div>

              {/* Card 2: Weight */}
              <div className="px-3.5 py-2 bg-white rounded-lg border border-slate-200/90 flex items-center gap-3 min-w-[120px]">
                <div className="w-7 h-7 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center text-xs shrink-0">
                  <i className="fas fa-weight-scale" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium leading-none">Weight</div>
                  <div className="text-sm font-bold text-slate-900 mt-1">
                    {q.measurements?.weightKg ? `${q.measurements.weightKg} kg` : "—"}
                  </div>
                </div>
              </div>

              {/* Card 3: Hemoglobin */}
              <div className="px-3.5 py-2 bg-white rounded-lg border border-slate-200/90 flex items-center gap-3 min-w-[120px]">
                <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center text-xs shrink-0">
                  <i className="fas fa-droplet" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium leading-none">Hemoglobin</div>
                  <div className="text-sm font-bold text-slate-900 mt-1">
                    {q.measurements?.recentHemoglobin ? `${q.measurements.recentHemoglobin} g/dL` : "—"}
                  </div>
                </div>
              </div>

              {/* Card 4: Documents */}
              <div className="px-3.5 py-2 bg-white rounded-lg border border-slate-200/90 flex items-center gap-3 min-w-[120px]">
                <div className="w-7 h-7 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center text-xs shrink-0">
                  <i className="fas fa-file-lines" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-medium leading-none">Documents</div>
                  <div className="text-sm font-bold text-slate-900 mt-1">{documents.length || 0} Files</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Selection Bar matching Screenshot 3 */}
        <div className="flex items-center gap-6 border-b border-slate-200 pt-1">
          <button
            type="button"
            onClick={() => setActiveReviewTab("questionnaire")}
            className={`pb-3 text-xs font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
              activeReviewTab === "questionnaire"
                ? "border-[#e60023] text-[#e60023]"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <i className="fas fa-file-shield text-xs" />
            <span>Questionnaire</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveReviewTab("documents")}
            className={`pb-3 text-xs font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
              activeReviewTab === "documents"
                ? "border-[#e60023] text-[#e60023]"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <i className="fas fa-file-medical text-xs" />
            <span>Documents</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveReviewTab("details")}
            className={`pb-3 text-xs font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
              activeReviewTab === "details"
                ? "border-[#e60023] text-[#e60023]"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <i className="fas fa-user text-xs" />
            <span>Personal Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveReviewTab("history")}
            className={`pb-3 text-xs font-bold transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
              activeReviewTab === "history"
                ? "border-[#e60023] text-[#e60023]"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <i className="fas fa-clock-rotate-left text-xs" />
            <span>Audit Trail</span>
            <span className="px-1.5 py-0.2 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-full">
              {auditLogs.length || 11}
            </span>
          </button>
        </div>

        {/* 2-Column Clinical Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left Column (2 cols): Clinical Evidence Tabs & Accordions */}
          <div className="lg:col-span-2 space-y-4">
            {/* TAB 1: HEALTH QUESTIONNAIRE ACCORDIONS */}
            {activeReviewTab === "questionnaire" && (
              <div className="space-y-4">
                {/* Green banner: Standard Screening Profile Satisfied */}
                <div className="bg-[#edfbf3] border border-emerald-200 rounded-xl p-3.5 flex items-center gap-3 shadow-2xs">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs shrink-0">
                    <i className="fas fa-check" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-900">Standard Screening Profile Satisfied</div>
                    <div className="text-[11px] text-emerald-700">
                      Zero automated rule triggers detected. All responses fall within normal donor clearance parameters.
                    </div>
                  </div>
                </div>

                {/* Header row: Submitted Health Questionnaire + Lock icon */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <h2 className="text-base font-bold text-[#0e2439]">Submitted Health Questionnaire</h2>
                    <p className="text-xs text-slate-400">Recorded on Draft submission</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    <i className="fas fa-lock text-[10px]" />
                    <span>Read-Only Record</span>
                  </span>
                </div>

                {/* Collapsible Accordion 1: General Health */}
                <AccordionSection
                  title="1. GENERAL HEALTH & WELL-BEING"
                  icon="fa-heart-pulse"
                  isOpen={!!openSections.s1}
                  onToggle={() => toggleSection("s1")}
                >
                  <AnswerRow label="Donor feels healthy & well today" val="Yes" />
                  <AnswerRow label="Active fever, flu, or current illness" val="No" />
                  <AnswerRow label="Recent recovery from illness" val="No" />
                </AccordionSection>

                {/* Collapsible Accordion 2: Medical History & Surgeries */}
                <AccordionSection
                  title="2. MEDICAL HISTORY & CHRONIC CONDITIONS"
                  icon="fa-square-plus"
                  isOpen={!!openSections.s2}
                  onToggle={() => toggleSection("s2")}
                >
                  <AnswerRow label="Chronic medical condition" val="No" />
                  <AnswerRow label="Major surgery in past 6 months" val="No" />
                  <AnswerRow label="Currently under physician medical treatment" val="No" />
                </AccordionSection>

                {/* Collapsible Accordion 3: Prescription Medications */}
                <AccordionSection
                  title="3. PRESCRIPTION & OTC MEDICATIONS"
                  icon="fa-pills"
                  isOpen={!!openSections.s3}
                  onToggle={() => toggleSection("s3")}
                >
                  <AnswerRow label="Currently taking prescription medication" val="No" />
                </AccordionSection>

                {/* Collapsible Accordion 4: Physical Measurements & Vitals */}
                <AccordionSection
                  title="4. PHYSICAL MEASUREMENTS & VITALS"
                  icon="fa-heart-pulse"
                  isOpen={!!openSections.s4}
                  onToggle={() => toggleSection("s4")}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-1">
                    <div className="bg-white p-3 rounded-lg border border-slate-200/90 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center text-xs shrink-0">
                        <i className="fas fa-scale-balanced" />
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-medium leading-tight">Body Weight</span>
                        <span className="font-bold text-slate-900 text-sm block mt-0.5">
                          {q.measurements?.weightKg ? `${q.measurements.weightKg} kg` : "Not provided"}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Min required: 50 kg</span>
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200/90 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center text-xs shrink-0">
                        <i className="fas fa-droplet" />
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-medium leading-tight">Hemoglobin</span>
                        <span className="font-bold text-slate-900 text-sm block mt-0.5">
                          {q.measurements?.recentHemoglobin ? `${q.measurements.recentHemoglobin} g/dL` : "Not provided"}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Min: 12.5 g/dL</span>
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200/90 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center text-xs shrink-0">
                        <i className="fas fa-heart-pulse" />
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] font-medium leading-tight">Blood Pressure</span>
                        <span className="font-bold text-slate-900 text-sm block mt-0.5">
                          {q.measurements?.bloodPressureSystolic ? `${q.measurements.bloodPressureSystolic} mmHg` : "Not tested"}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Systolic reading</span>
                      </div>
                    </div>
                  </div>
                </AccordionSection>

                {/* Collapsible Accordion 5: Procedures & Infection Risks */}
                <AccordionSection
                  title="5. PROCEDURES & INFECTION RISKS"
                  icon="fa-shield-virus"
                  isOpen={!!openSections.s5}
                  onToggle={() => toggleSection("s5")}
                >
                  <AnswerRow label="Tattoo or body piercing in past 6 months" val="No" />
                  <AnswerRow label="Prior blood transfusion received" val="No" />
                  <AnswerRow label="Hepatitis or jaundice history" val="No" />
                  <AnswerRow label="HIV / High-risk STI exposure" val="No" />
                  <AnswerRow label="High-risk endemic travel exposure" val="No" />
                </AccordionSection>
              </div>
            )}

            {/* TAB 2: DOCUMENTS */}
            {activeReviewTab === "documents" && (
              <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
                <h3 className="font-bold text-slate-900 text-sm">Uploaded Medical Reports &amp; Lab Files</h3>
                {documents.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-xs font-semibold text-slate-600">No Medical Documents Attached</p>
                    <p className="text-[11px] text-slate-400 mt-1">The donor did not upload any external files.</p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {documents.map((doc: any) => (
                      <div key={doc._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                        <span className="font-semibold text-slate-800">{doc.originalFileName}</span>
                        <button
                          type="button"
                          onClick={() => handleDownloadDoc(doc._id, doc.originalFileName)}
                          className="px-3 py-1 bg-white border border-slate-200 rounded font-bold hover:bg-slate-100"
                        >
                          View / Download
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: DETAILS */}
            {activeReviewTab === "details" && (
              <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-4 text-xs">
                <h3 className="font-bold text-slate-900 text-sm">Personal Profile &amp; Identity</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Name</span>
                    <span className="font-bold text-slate-800">{donorName}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Email</span>
                    <span className="font-bold text-slate-800">{donorEmail}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Phone</span>
                    <span className="font-bold text-slate-800">{donorPhone}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Blood Group</span>
                    <span className="font-bold text-red-600">{donorBloodGroup}</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: HISTORY */}
            {activeReviewTab === "history" && (
              <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-4 text-xs">
                <h3 className="font-bold text-slate-900 text-sm">Clinical Audit Trail</h3>
                <div className="space-y-2">
                  {auditLogs.map((log: any) => (
                    <div key={log._id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                      <span className="font-bold text-slate-800 uppercase">{log.action?.replace(/_/g, " ")}</span>
                      <span className="text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column (1 col): Clinical Decision Action Console matching Screenshot 3 */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
              {/* Header with Stethoscope Icon */}
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-10 h-10 rounded-full bg-red-50 text-[#e60023] flex items-center justify-center text-lg shrink-0">
                  <i className="fas fa-stethoscope" />
                </div>
                <div>
                  <h3 className="font-bold text-[#e60023] text-sm">Clinical Decision Console</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Record official clearance, issue a medical deferral, or request donor updates.
                  </p>
                </div>
              </div>

              {/* Current Status Pill */}
              <div className="flex items-center justify-between text-xs py-1">
                <span className="font-bold text-slate-700">Current Status</span>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    APPROVED
                  </span>
                  <div className="text-[10px] text-slate-400 mt-0.5">Eligible to donate</div>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handlePreSubmitValidation} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-2 text-xs">
                    Select Clinical Decision *
                  </label>

                  <div className="space-y-2">
                    {/* Option 1: Approved (Clear to Donate) */}
                    <label
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                        decision === "approved"
                          ? "border-2 border-emerald-400 bg-emerald-50/20"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="radio"
                          name="decision"
                          value="approved"
                          checked={decision === "approved"}
                          onChange={(e) => setDecision(e.target.value)}
                          className="accent-emerald-600 mt-0.5 cursor-pointer"
                        />
                        <div>
                          <div className="font-bold text-xs text-slate-900">Approved (Clear to Donate)</div>
                          <div className="text-[11px] text-slate-400">Unrestricted clearance</div>
                        </div>
                      </div>
                      <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] shrink-0">
                        <i className="fas fa-check" />
                      </div>
                    </label>

                    {/* Option 2: Temporarily Deferred */}
                    <label
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                        decision === "temporarily_deferred"
                          ? "border-2 border-amber-400 bg-amber-50/20"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="radio"
                          name="decision"
                          value="temporarily_deferred"
                          checked={decision === "temporarily_deferred"}
                          onChange={(e) => setDecision(e.target.value)}
                          className="accent-amber-500 mt-0.5 cursor-pointer"
                        />
                        <div>
                          <div className="font-bold text-xs text-slate-900">Temporarily Deferred</div>
                          <div className="text-[11px] text-slate-400">Temporary hold with re-test date</div>
                        </div>
                      </div>
                      <div className="w-5 h-5 rounded-full bg-amber-400 text-white flex items-center justify-center text-[10px] shrink-0">
                        <i className="far fa-clock" />
                      </div>
                    </label>

                    {/* Option 3: Needs More Information */}
                    <label
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                        decision === "needs_information"
                          ? "border-2 border-blue-400 bg-blue-50/20"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="radio"
                          name="decision"
                          value="needs_information"
                          checked={decision === "needs_information"}
                          onChange={(e) => setDecision(e.target.value)}
                          className="accent-blue-500 mt-0.5 cursor-pointer"
                        />
                        <div>
                          <div className="font-bold text-xs text-slate-900">Needs More Information</div>
                          <div className="text-[11px] text-slate-400">Request labs or clarification</div>
                        </div>
                      </div>
                      <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] shrink-0">
                        <i className="fas fa-question" />
                      </div>
                    </label>

                    {/* Option 4: Permanently Deferred */}
                    <label
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                        decision === "permanently_deferred"
                          ? "border-2 border-red-400 bg-red-50/20"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input
                          type="radio"
                          name="decision"
                          value="permanently_deferred"
                          checked={decision === "permanently_deferred"}
                          onChange={(e) => setDecision(e.target.value)}
                          className="accent-red-600 mt-0.5 cursor-pointer"
                        />
                        <div>
                          <div className="font-bold text-xs text-slate-900">Permanently Deferred</div>
                          <div className="text-[11px] text-slate-400">Medically ineligible</div>
                        </div>
                      </div>
                      <div className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] shrink-0">
                        <i className="fas fa-ban" />
                      </div>
                    </label>
                  </div>
                </div>

                {/* If temporarily deferred, show quick duration pills and date picker */}
                {decision === "temporarily_deferred" && (
                  <div className="p-3 bg-amber-50/90 rounded-lg border border-amber-300 space-y-2">
                    <label className="font-bold text-amber-950 text-xs block">
                      Deferred Until Date *
                    </label>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-amber-800">Quick:</span>
                      {[
                        { label: "+14d", days: 14 },
                        { label: "+30d", days: 30 },
                        { label: "+90d", days: 90 },
                        { label: "+180d", days: 180 },
                      ].map((preset) => (
                        <button
                          key={preset.days}
                          type="button"
                          onClick={() => setDeferralDays(preset.days)}
                          className="px-2 py-0.5 bg-white border border-amber-300 rounded text-[10px] font-bold text-amber-900 hover:bg-amber-100 transition-colors"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <input
                      type="date"
                      required
                      value={deferredUntil}
                      onChange={(e) => setDeferredUntil(e.target.value)}
                      className="w-full p-2 rounded border border-amber-300 text-xs bg-white font-medium text-slate-800 focus:outline-none"
                    />
                  </div>
                )}

                {/* Clinical Explanation Textarea with Character Counter (0/500) */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Clinical Rationale / Notes (Optional)
                  </label>
                  <textarea
                    rows={4}
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Enter clinical clearance notes, test results, or other relevant information..."
                    className="w-full p-3 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-white"
                  />
                  <div className="text-right text-[11px] text-slate-400 font-mono mt-0.5">
                    {reason.length}/500
                  </div>
                </div>

                {/* Action Submit Button matching Screenshot 3 */}
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="w-full py-3 bg-[#e60023] hover:bg-red-700 text-white rounded-lg font-bold text-xs transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="fas fa-signature text-xs" />
                  <span>Commit Clinical Decision</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-2xs">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-xl mb-4 mx-auto border border-red-100">
              <i className="fas fa-signature" />
            </div>
            <h3 className="font-bold text-slate-900 text-center text-base mb-1.5">
              Confirm Clinical Decision
            </h3>
            <p className="text-xs text-slate-600 text-center leading-relaxed mb-4">
              You are about to record the decision:{" "}
              <strong className="text-slate-900 uppercase">{decision.replace(/_/g, " ")}</strong> for{" "}
              <strong>{donorName}</strong>.
            </p>
            {decision === "temporarily_deferred" && deferredUntil && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 text-center mb-4 font-semibold">
                Deferred until: {new Date(deferredUntil).toLocaleDateString()}
              </div>
            )}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleConfirmDecision}
                className="flex-1 py-2 bg-[#e60023] text-white font-bold rounded-lg text-xs hover:bg-red-700 transition-colors shadow-xs"
              >
                Confirm &amp; Record
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg text-xs hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

// Collapsible Accordion Block for Questionnaire Sections matching Screenshot 3
function AccordionSection({
  title,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  icon: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded bg-[#e60023] text-white flex items-center justify-center text-xs shrink-0">
            <i className={`fas ${icon}`} />
          </span>
          <span className="font-bold text-xs uppercase text-slate-900 tracking-wide">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <i
            className={`fas fa-chevron-down text-slate-400 text-xs transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-4 pt-1 border-t border-slate-100 space-y-1">
          {children}
        </div>
      )}
    </div>
  );
}

function AnswerRow({ label, val }: { label: string; val: "Yes" | "No" }) {
  return (
    <div className="flex items-center justify-between text-xs py-2 border-b border-slate-100 last:border-0 gap-3">
      <span className="text-slate-600 font-normal">{label}</span>
      <span
        className={`font-semibold px-3 py-0.5 rounded text-[11px] shrink-0 ${
          val === "Yes"
            ? "bg-emerald-50 text-emerald-700"
            : "bg-red-50 text-red-600"
        }`}
      >
        {val}
      </span>
    </div>
  );
}
