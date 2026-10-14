import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { api } from "../../lib/api";

interface CampLocation {
  city: string;
  state: string;
}

interface CampItem {
  _id: string;
  name: string;
  location: CampLocation;
  startDate: string;
  capacity: number;
  registrationCount: number;
  status: string;
}

function formatCampDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function LandingCampPreview() {
  const [camps, setCamps] = useState<CampItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const json = await api.get<{ success: boolean; camps?: CampItem[]; message?: string }>("/camps");
        if (cancelled) return;
        if (json?.success && Array.isArray(json.camps)) {
          const published = json.camps
            .filter((c) => c.status === "published")
            .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
            .slice(0, 3);
          setCamps(published);
        } else {
          setError(json?.message || "Unable to load camps.");
        }
      } catch {
        if (!cancelled) setError("Unable to connect to the server.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="relative py-20 md:py-28">
      <div className="mx-auto w-[var(--landing-content)]">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="landing-kicker">Camp discovery</span>
          <h2 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight max-w-2xl">
            Upcoming drives you can join today
          </h2>
          <p className="mt-3 text-[var(--landing-muted)] max-w-xl leading-relaxed">
            Browse published camps from organizers on REDhope — capacity and dates come from live registrations.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {loading &&
            [0, 1, 2].map((i) => (
              <div key={i} className="landing-panel h-44 animate-pulse opacity-60" aria-hidden="true" />
            ))}

          {!loading && error && (
            <p className="text-sm text-[var(--landing-muted)] md:col-span-3">{error}</p>
          )}

          {!loading && !error && camps.length === 0 && (
            <p className="text-sm text-[var(--landing-muted)] md:col-span-3">
              No published camps right now. Check back soon or{" "}
              <Link to="/register" className="text-[var(--landing-crimson-soft)] underline-offset-2 hover:underline">
                register
              </Link>{" "}
              to get notified.
            </p>
          )}

          {!loading &&
            camps.map((camp, index) => (
              <motion.article
                key={camp._id}
                className="landing-panel p-5 flex flex-col gap-3"
                initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: index * 0.08, duration: 0.45 }}
                whileHover={reduceMotion ? undefined : { y: -4 }}
              >
                <div>
                  <h3 className="text-lg font-semibold leading-snug">{camp.name}</h3>
                  <p className="text-sm text-[var(--landing-dim)] mt-1">
                    {camp.location?.city}
                    {camp.location?.state ? `, ${camp.location.state}` : ""}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-[var(--landing-dim)] text-xs uppercase tracking-wide">Date</dt>
                    <dd className="font-medium">{formatCampDate(camp.startDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-[var(--landing-dim)] text-xs uppercase tracking-wide">Spots</dt>
                    <dd className="font-medium">
                      {camp.registrationCount}/{camp.capacity}
                    </dd>
                  </div>
                </dl>
                <Link
                  to="/camps/$campId"
                  params={{ campId: camp._id }}
                  className="mt-auto text-sm font-semibold text-[var(--landing-crimson-soft)] hover:text-white transition-colors"
                >
                  View camp →
                </Link>
              </motion.article>
            ))}
        </div>

        <div className="mt-8">
          <Link to="/camps" className="btn-landing-ghost">
            Explore all donation camps
          </Link>
        </div>
      </div>
    </section>
  );
}
