import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";

export const Route = createFileRoute("/stories")({
  head: () => ({
    meta: [
      { title: "Stories — REDhope" },
      {
        name: "description",
        content:
          "Life-changing stories from REDhope donors, recipients, and camp organizers.",
      },
      { property: "og:title", content: "Life-Changing Stories — REDhope" },
      {
        property: "og:description",
        content: "Inspiring experiences from donors, recipients and organizers.",
      },
    ],
  }),
  component: StoriesPage,
});

type Role = "Donor" | "Recipient" | "Organizer";

interface Story {
  name: string;
  role: Role;
  img: string;
  quote: string;
  date: string;
}

const stories: Story[] = [
  {
    name: "Priya Sharma",
    role: "Donor",
    img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80",
    quote:
      "I've been donating blood for 5 years through REDhope. The process is so smooth and the staff is incredibly supportive. Knowing that my blood helped save a child's life last month fills me with joy!",
    date: "June 15, 2025",
  },
  {
    name: "Raj Patel",
    role: "Recipient",
    img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
    quote:
      "After my accident, I needed 4 units of blood. REDhope found donors within hours. I'm alive today because of their amazing network. Forever grateful to the donors and this platform!",
    date: "May 28, 2025",
  },
  {
    name: "Ananya Singh",
    role: "Organizer",
    img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80",
    quote:
      "As a college event organizer, REDhope made our donation camp incredibly successful. Their platform helped us register 127 donors in one day! The dashboard and real-time tracking are game-changers.",
    date: "June 3, 2025",
  },
  {
    name: "Vikram Mehta",
    role: "Donor",
    img: "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=200&q=80",
    quote:
      "I was nervous about donating for the first time, but the REDhope team made me feel so comfortable. The entire process took less than an hour. I've already scheduled my next donation!",
    date: "April 18, 2025",
  },
  {
    name: "Sunita Reddy",
    role: "Recipient",
    img: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&q=80",
    quote:
      "My daughter needed rare AB- blood during her surgery. We were desperate, but REDhope located a donor 50km away who drove to the hospital immediately. Thank you for saving my baby!",
    date: "March 30, 2025",
  },
  {
    name: "Arun Kumar",
    role: "Organizer",
    img: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80",
    quote:
      "Our corporate blood drive with REDhope was the most efficient we've ever had. The mobile app for donor check-in reduced wait times by 70%. We collected 89 units in just 5 hours!",
    date: "May 12, 2025",
  },
];

const roleColor: Record<Role, string> = {
  Donor: "var(--primary)",
  Recipient: "var(--secondary)",
  Organizer: "var(--success)",
};

function StoriesPage() {
  return (
    <>
      <Navbar />

      <section className="hero hero-compact">
        <div className="hero-inner">
          <h1>Life-Changing Stories</h1>
          <p>
            Read inspiring experiences from donors who gave the gift of life, recipients
            whose lives were saved, and organizers who made it all possible.
          </p>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <div className="section-title">
            <h2>Share Your Experience</h2>
            <p>Real stories from the REDhope community</p>
          </div>
          <div className="features-grid">
            {stories.map((s) => (
              <article key={s.name} className="feature-card" style={{ padding: 26 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <img
                    src={s.img}
                    alt={s.name}
                    loading="lazy"
                    style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover" }}
                  />
                  <div>
                    <h3 style={{ fontSize: "1.2rem", color: "var(--secondary)" }}>
                      {s.name}
                    </h3>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "white",
                        background: roleColor[s.role],
                        padding: "3px 10px",
                        borderRadius: 20,
                        textTransform: "uppercase",
                        letterSpacing: 1,
                      }}
                    >
                      {s.role}
                    </span>
                  </div>
                </div>
                <i
                  className="fas fa-quote-left"
                  style={{ color: "var(--primary)", fontSize: 20, opacity: 0.4 }}
                />
                <p style={{ marginTop: 10, color: "var(--dark)", lineHeight: 1.7 }}>
                  {s.quote}
                </p>
                <div style={{ marginTop: 16, color: "var(--gray)", fontSize: 13 }}>
                  <i className="fas fa-calendar-alt" /> {s.date}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="container">
          <h2>Every Drop Counts. Every Life Matters.</h2>
          <p>
            Join India's largest youth-run blood donation organization. Together, we can
            save millions of lives.
          </p>
        </div>
      </section>

      <Footer />
    </>
  );
}
