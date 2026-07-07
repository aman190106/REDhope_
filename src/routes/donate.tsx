import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { toast } from "../components/AppToaster";

export const Route = createFileRoute("/donate")({
  head: () => ({
    meta: [
      { title: "Become a Donor — REDhope" },
      {
        name: "description",
        content:
          "Register as a blood donor with REDhope in a quick 4-step form. Save up to 3 lives with a single donation.",
      },
      { property: "og:title", content: "Become a Donor — REDhope" },
      {
        property: "og:description",
        content: "Register to save lives through blood donation.",
      },
    ],
  }),
  component: DonatePage,
});

const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const states = [
  "Delhi", "Maharashtra", "Tamil Nadu", "Karnataka", "Uttar Pradesh",
  "West Bengal", "Gujarat", "Rajasthan", "Andhra Pradesh", "Telangana",
  "Kerala", "Madhya Pradesh", "Haryana", "Punjab", "Odisha",
];

interface FormData {
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  bloodType: string;
  lastDonation: string;
  medicalConditions: string;
  agree: boolean;
}

const initialData: FormData = {
  firstName: "", lastName: "", dob: "", gender: "",
  email: "", phone: "", address: "", city: "", state: "", pincode: "",
  bloodType: "", lastDonation: "", medicalConditions: "", agree: false,
};

const stepLabels = ["Personal Info", "Contact Details", "Health Info", "Review"];

function DonatePage() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(initialData);

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setData((d) => ({ ...d, [key]: value }));

  const validate = (): string | null => {
    if (step === 0) {
      if (!data.firstName || !data.lastName || !data.dob || !data.gender)
        return "Please fill in all personal fields.";
    } else if (step === 1) {
      if (!data.email || !data.phone || !data.address || !data.city || !data.state || !data.pincode)
        return "Please fill in all contact fields.";
      if (!/^\S+@\S+\.\S+$/.test(data.email)) return "Enter a valid email address.";
      if (!/^\d{10}$/.test(data.phone)) return "Enter a valid 10-digit phone number.";
    } else if (step === 2) {
      if (!data.bloodType) return "Please select your blood type.";
    }
    return null;
  };

  const next = () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setStep((s) => Math.min(3, s + 1));
    window.scrollTo({ top: 200, behavior: "smooth" });
  };
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const submit = () => {
    if (!data.agree) { toast.error("Please accept the terms."); return; }
    toast.success("Registration successful! We'll be in touch shortly.");
    setData(initialData);
    setStep(0);
  };

  const progress = (step / (stepLabels.length - 1)) * 100;

  return (
    <>
      <Navbar solid />

      <section className="hero hero-compact" style={{ minHeight: "40vh" }}>
        <div className="hero-inner">
          <h1>Become a Life Saver</h1>
          <p>
            Join our network of donors and help us ensure that no patient dies due to lack
            of blood. Your registration takes just 2 minutes but can save countless lives.
          </p>
        </div>
      </section>

      <section className="features" style={{ paddingTop: 40 }}>
        <div className="container">
          {/* Progress */}
          <div
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: `repeat(${stepLabels.length}, 1fr)`,
              marginBottom: 40,
              maxWidth: 720,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            <div style={{
              position: "absolute", top: 20, left: 20, right: 20, height: 4,
              background: "var(--light-gray)", borderRadius: 2, zIndex: 0,
            }} />
            <div style={{
              position: "absolute", top: 20, left: 20, height: 4,
              width: `calc((100% - 40px) * ${progress / 100})`,
              background: "var(--primary)", borderRadius: 2,
              transition: "width .3s ease", zIndex: 1,
            }} />
            {stepLabels.map((label, i) => (
              <div key={label} style={{ textAlign: "center", position: "relative", zIndex: 2 }}>
                <div
                  style={{
                    width: 40, height: 40, borderRadius: "50%",
                    margin: "0 auto 10px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: i <= step ? "var(--primary)" : "var(--light-gray)",
                    color: i <= step ? "white" : "var(--gray)",
                    fontWeight: 700,
                    transition: "var(--transition)",
                  }}
                >{i + 1}</div>
                <div style={{ fontSize: 13, color: "var(--secondary)", fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            {step === 0 && (
              <div className="form-section">
                <h3><i className="fas fa-user" /> Personal Information</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="required-field">First Name</label>
                    <input value={data.firstName} onChange={(e) => update("firstName", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="required-field">Last Name</label>
                    <input value={data.lastName} onChange={(e) => update("lastName", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="required-field">Date of Birth</label>
                    <input type="date" value={data.dob} onChange={(e) => update("dob", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="required-field">Gender</label>
                    <div className="radio-group">
                      {["male", "female", "other"].map((g) => (
                        <label key={g} className="radio-option">
                          <input
                            type="radio"
                            name="gender"
                            checked={data.gender === g}
                            onChange={() => update("gender", g)}
                          />
                          <span style={{ textTransform: "capitalize" }}>{g}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="form-section">
                <h3><i className="fas fa-address-book" /> Contact Information</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="required-field">Email Address</label>
                    <input type="email" value={data.email} onChange={(e) => update("email", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="required-field">Phone (10 digits)</label>
                    <input type="tel" maxLength={10} value={data.phone} onChange={(e) => update("phone", e.target.value.replace(/\D/g, ""))} />
                  </div>
                  <div className="form-group full-width">
                    <label className="required-field">Street Address</label>
                    <input value={data.address} onChange={(e) => update("address", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="required-field">City</label>
                    <input value={data.city} onChange={(e) => update("city", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="required-field">State</label>
                    <select value={data.state} onChange={(e) => update("state", e.target.value)}>
                      <option value="">Select State</option>
                      {states.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="required-field">Pincode</label>
                    <input value={data.pincode} onChange={(e) => update("pincode", e.target.value.replace(/\D/g, ""))} maxLength={6} />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="form-section">
                <h3><i className="fas fa-heartbeat" /> Donation & Health Info</h3>
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="required-field">Blood Type</label>
                  <div className="blood-type-selector">
                    {bloodTypes.map((bt) => (
                      <label key={bt} className="blood-type-option">
                        <input
                          type="radio"
                          name="bt"
                          checked={data.bloodType === bt}
                          onChange={() => update("bloodType", bt)}
                        />
                        <span className="blood-type-label">{bt}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Last Donation Date</label>
                    <input type="date" value={data.lastDonation} onChange={(e) => update("lastDonation", e.target.value)} />
                  </div>
                  <div className="form-group full-width">
                    <label>Medical Conditions (if any)</label>
                    <textarea value={data.medicalConditions} onChange={(e) => update("medicalConditions", e.target.value)} placeholder="Mention any medical conditions, medications, or allergies" />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="form-section">
                <h3><i className="fas fa-clipboard-check" /> Review & Submit</h3>
                <ul style={{ listStyle: "none", display: "grid", gap: 8, marginBottom: 20 }}>
                  <li><strong>Name:</strong> {data.firstName} {data.lastName}</li>
                  <li><strong>DOB / Gender:</strong> {data.dob} · {data.gender || "—"}</li>
                  <li><strong>Email:</strong> {data.email}</li>
                  <li><strong>Phone:</strong> {data.phone}</li>
                  <li><strong>Address:</strong> {data.address}, {data.city}, {data.state} {data.pincode}</li>
                  <li><strong>Blood Type:</strong> {data.bloodType}</li>
                  <li><strong>Last Donation:</strong> {data.lastDonation || "N/A"}</li>
                </ul>
                <label className="radio-option">
                  <input type="checkbox" checked={data.agree} onChange={(e) => update("agree", e.target.checked)} />
                  <span>I confirm the information is accurate and consent to being contacted.</span>
                </label>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={prev}
                disabled={step === 0}
                style={{ visibility: step === 0 ? "hidden" : "visible" }}
              >
                <i className="fas fa-arrow-left" /> Previous
              </button>
              {step < 3 ? (
                <button type="button" className="btn" onClick={next}>
                  Next <i className="fas fa-arrow-right" />
                </button>
              ) : (
                <button type="button" className="btn" onClick={submit}>
                  Submit Registration <i className="fas fa-check" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
