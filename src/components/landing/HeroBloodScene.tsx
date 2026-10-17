import { useState, useEffect, useRef, useCallback } from "react";

export interface HeroBloodSceneProps {
  interactive?: boolean;
  className?: string;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

export function HeroBloodScene({ interactive = true, className = "" }: HeroBloodSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [particles, setParticles] = useState<Particle[]>([]);

  // Generate floating ambient particles once on mount
  useEffect(() => {
    const p: Particle[] = Array.from({ length: 42 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 4,
      duration: 5 + Math.random() * 7,
      delay: Math.random() * 4,
      opacity: 0.2 + Math.random() * 0.6,
    }));
    setParticles(p);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!interactive || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = (e.clientX - centerX) / (rect.width / 2);
      const deltaY = (e.clientY - centerY) / (rect.height / 2);

      // Clamp tilt between -18deg and 18deg
      setRotate({
        x: -deltaY * 18,
        y: deltaX * 22,
      });
    },
    [interactive],
  );

  const handleMouseLeave = useCallback(() => {
    if (!interactive) return;
    setRotate({ x: 0, y: 0 });
  }, [interactive]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full h-full overflow-hidden flex items-center justify-center select-none ${className}`}
      aria-hidden="true"
      style={{ perspective: "1000px" }}
    >
      {/* Ambient background glow */}
      <div className="absolute inset-0 bg-radial from-rose-950/30 via-slate-950/60 to-[#070508] pointer-events-none" />

      {/* Floating ambient particles */}
      <div className="absolute inset-0 pointer-events-none">
        {particles.map((pt) => (
          <span
            key={pt.id}
            className="absolute rounded-full bg-rose-400 animate-pulse pointer-events-none"
            style={{
              left: `${pt.x}%`,
              top: `${pt.y}%`,
              width: `${pt.size}px`,
              height: `${pt.size}px`,
              opacity: pt.opacity,
              animationDuration: `${pt.duration}s`,
              animationDelay: `${pt.delay}s`,
              boxShadow: "0 0 8px rgba(251, 113, 133, 0.6)",
            }}
          />
        ))}
      </div>

      {/* Interactive 3D Blood Drop Sculpture */}
      <div
        className="relative transition-transform duration-300 ease-out flex items-center justify-center"
        style={{
          transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Soft back-shadow */}
        <div
          className="absolute -bottom-10 w-48 h-12 rounded-full bg-rose-950/50 blur-xl pointer-events-none transition-transform duration-300"
          style={{
            transform: `translateZ(-50px) scale(${1 + Math.abs(rotate.y) * 0.01})`,
          }}
        />

        {/* 3D Sculpted Blood Drop SVG */}
        <svg
          viewBox="0 0 240 320"
          className="w-48 sm:w-60 md:w-72 h-auto filter drop-shadow-[0_15px_35px_rgba(225,29,72,0.45)]"
          style={{ transform: "translateZ(30px)" }}
        >
          <defs>
            {/* Primary ruby liquid gradient */}
            <linearGradient id="bloodBodyGrad" x1="20%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%" stopColor="#ff4d6d" />
              <stop offset="35%" stopColor="#e11d48" />
              <stop offset="70%" stopColor="#be123c" />
              <stop offset="100%" stopColor="#881337" />
            </linearGradient>

            {/* Specular front gloss */}
            <radialGradient id="specularGlow" cx="35%" cy="30%" r="45%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
              <stop offset="25%" stopColor="#fda4af" stopOpacity="0.35" />
              <stop offset="70%" stopColor="#e11d48" stopOpacity="0" />
            </radialGradient>

            {/* Depth vignette */}
            <radialGradient id="depthShade" cx="65%" cy="70%" r="55%">
              <stop offset="0%" stopColor="#4c0519" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#e11d48" stopOpacity="0" />
            </radialGradient>

            {/* Outer edge rim light */}
            <filter id="rimGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Droplet outer body */}
          <path
            d="M 120 18 C 120 18, 40 148, 40 212 C 40 262, 76 298, 120 298 C 164 298, 200 262, 200 212 C 200 148, 120 18, 120 18 Z"
            fill="url(#bloodBodyGrad)"
          />

          {/* Inner depth shadow */}
          <path
            d="M 120 18 C 120 18, 40 148, 40 212 C 40 262, 76 298, 120 298 C 164 298, 200 262, 200 212 C 200 148, 120 18, 120 18 Z"
            fill="url(#depthShade)"
            style={{ mixBlendMode: "multiply" }}
          />

          {/* Inner specular highlight curve */}
          <ellipse
            cx="88"
            cy="172"
            rx="24"
            ry="48"
            transform="rotate(-28 88 172)"
            fill="url(#specularGlow)"
          />

          {/* Secondary bright gleam */}
          <ellipse
            cx="80"
            cy="145"
            rx="7"
            ry="18"
            transform="rotate(-25 80 145)"
            fill="#ffffff"
            opacity="0.85"
          />

          {/* Bottom rim light bounce */}
          <path
            d="M 68 245 C 80 275, 120 290, 155 280"
            fill="none"
            stroke="#fecdd3"
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity="0.45"
            filter="url(#rimGlow)"
          />
        </svg>
      </div>
    </div>
  );
}

export default HeroBloodScene;
