import { Link } from "@tanstack/react-router";

interface RedHopeLogoProps {
  className?: string;
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  linkTo?: string;
}

export function RedHopeLogo({
  className = "",
  variant = "light",
  size = "md",
  linkTo = "/",
}: RedHopeLogoProps) {
  const iconSizes = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  const content = (
    <div className={`inline-flex items-center gap-2.5 font-bold tracking-tight select-none ${className}`}>
      {/* Canva Reference Emblem: Red rounded box with bold R */}
      <div
        className={`${iconSizes[size]} bg-red-600 rounded-md flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm`}
      >
        R
      </div>

      {/* Brand Text */}
      <span className={`${textSizes[size]} font-bold tracking-tight ${variant === "dark" ? "text-white" : "text-slate-900"}`}>
        REDhope
      </span>
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} aria-label="REDhope Home" className="transition-opacity hover:opacity-90 inline-block">
        {content}
      </Link>
    );
  }

  return content;
}

