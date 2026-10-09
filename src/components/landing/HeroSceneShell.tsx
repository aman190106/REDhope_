import { lazy, Suspense, useEffect, useState } from "react";

const HeroBloodScene = lazy(() =>
  import("./HeroBloodScene").then((m) => ({ default: m.HeroBloodScene }))
);

function useWebGLSupported() {
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      setSupported(!!gl);
    } catch {
      setSupported(false);
    }
  }, []);
  return supported;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

function useIsMobileViewport() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mobile;
}

export function HeroSceneShell() {
  const webgl = useWebGLSupported();
  const reducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobileViewport();
  const useStatic = !webgl || reducedMotion || isMobile;

  if (useStatic) {
    return <div className="landing-hero-fallback" role="img" aria-label="Abstract crimson blood drop sculpture" />;
  }

  return (
    <Suspense fallback={<div className="landing-hero-fallback" aria-busy="true" />}>
      <HeroBloodScene interactive className="absolute inset-0 [&_canvas]:!h-full [&_canvas]:!w-full" />
    </Suspense>
  );
}
