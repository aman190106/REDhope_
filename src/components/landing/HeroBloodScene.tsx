import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function BloodDropSculpture({ interactive }: { interactive: boolean }) {
  const group = useRef<THREE.Group>(null);
  const target = useRef({ x: 0, y: 0 });

  const geometry = useMemo(() => {
    const points: THREE.Vector2[] = [];
    for (let i = 0; i <= 32; i++) {
      const t = i / 32;
      const y = t * 2.2 - 1.1;
      const radius = Math.sin(t * Math.PI) * 0.72 * (1 - t * 0.15) + 0.08 * (1 - t);
      points.push(new THREE.Vector2(radius, y));
    }
    return new THREE.LatheGeometry(points, 64);
  }, []);

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.rotation.y += delta * 0.22;
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0.12 + target.current.y * 0.08, 0.06);
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, target.current.x * 0.08, 0.06);
    group.current.position.y = Math.sin(t * 0.9) * 0.06;
  });

  return (
    <group
      ref={group}
      onPointerMove={
        interactive
          ? (e) => {
              e.stopPropagation();
              const x = (e.point.x / 2) * 2;
              const y = (e.point.y / 2) * 2;
              target.current = { x, y };
            }
          : undefined
      }
    >
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshPhysicalMaterial
          color="#ff1f49"
          roughness={0.08}
          metalness={0.05}
          transmission={0.92}
          thickness={1.4}
          ior={1.45}
          clearcoat={1}
          clearcoatRoughness={0.08}
          attenuationColor="#7f1d1d"
          attenuationDistance={0.8}
          envMapIntensity={1.2}
        />
      </mesh>
      <mesh geometry={geometry} scale={1.015}>
        <meshBasicMaterial color="#fb7185" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

function AmbientParticles({ count = 120 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 8;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 6;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    return arr;
  }, [count]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.03;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.025} color="#fda4af" transparent opacity={0.55} sizeAttenuation />
    </points>
  );
}

function SceneContent({ interactive }: { interactive: boolean }) {
  return (
    <>
      <color attach="background" args={["#070508"]} />
      <fog attach="fog" args={["#070508", 6, 14]} />
      <ambientLight intensity={0.35} />
      <spotLight position={[4, 6, 5]} intensity={90} angle={0.45} penumbra={0.6} color="#ffe4e6" castShadow />
      <pointLight position={[-3, -1, 2]} intensity={28} color="#e11d48" />
      <pointLight position={[2, 2, -3]} intensity={18} color="#fda4af" />
      <BloodDropSculpture interactive={interactive} />
      <AmbientParticles />
    </>
  );
}

export interface HeroBloodSceneProps {
  interactive?: boolean;
  className?: string;
}

export function HeroBloodScene({ interactive = true, className = "" }: HeroBloodSceneProps) {
  return (
    <div className={className} aria-hidden="true">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0.2, 4.2], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        shadows
      >
        <SceneContent interactive={interactive} />
      </Canvas>
    </div>
  );
}
