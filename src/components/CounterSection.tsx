import { useEffect, useRef, useState } from "react";

interface CounterProps {
  end: number;
  suffix?: string;
  label: string;
}

function Counter({ end, suffix = "", label }: CounterProps) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!ref.current || started.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          const duration = 1500;
          const startTime = performance.now();
          const tick = (now: number) => {
            const p = Math.min(1, (now - startTime) / duration);
            setValue(Math.floor(end * (1 - Math.pow(1 - p, 3))));
            if (p < 1) requestAnimationFrame(tick);
            else setValue(end);
          };
          requestAnimationFrame(tick);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end]);

  return (
    <div className="counter-item" ref={ref}>
      <div className="counter-number">
        {value}
        {suffix}
      </div>
      <div className="counter-text">{label}</div>
    </div>
  );
}

export function CounterSection() {
  return (
    <section className="counter-section">
      <div className="container">
        <div className="counter-grid">
          <Counter end={50} suffix="+" label="Lives Saved" />
          <Counter end={200} suffix="+" label="Donors Registered" />
          <Counter end={25} suffix="+" label="Cities Covered" />
          <Counter end={500} suffix="+" label="Camps Organized" />
        </div>
      </div>
    </section>
  );
}
