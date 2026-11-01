"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { clickable, solid } from "../lib/interact";
import { woodTexture } from "../lib/textures";
import { useRoom } from "../store";

export const DESK_Y = 0.74;

export default function Desk() {
  const m = useMemo(() => ({
    top: new THREE.MeshStandardMaterial({ map: woodTexture(4, "#8a5532", [1.4, 1]), roughness: 0.42 }),
    leg: new THREE.MeshStandardMaterial({ map: woodTexture(5, "#6d4126", [0.3, 1]), roughness: 0.5 }),
    cover: new THREE.MeshStandardMaterial({ color: "#7a2b2b", roughness: 0.7 }),
    pages: new THREE.MeshStandardMaterial({ color: "#efe6d2", roughness: 0.9 }),
    pen: new THREE.MeshStandardMaterial({ color: "#1d3c7a", roughness: 0.3, metalness: 0.2 }),
  }), []);
  const legs: [number, number][] = [[-0.71, -0.46], [1.11, -0.46], [-0.71, 0.16], [1.11, 0.16]];
  return (
    <group>
      <mesh position={[0.2, DESK_Y - 0.0175, -0.15]} castShadow receiveShadow material={m.top} {...solid}>
        <boxGeometry args={[1.9, 0.035, 0.7]} />
      </mesh>
      {legs.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, (DESK_Y - 0.035) / 2, z]} castShadow receiveShadow material={m.leg}>
          <boxGeometry args={[0.045, DESK_Y - 0.035, 0.045]} />
        </mesh>
      ))}
      <mesh position={[0.2, DESK_Y - 0.075, 0.165]} castShadow material={m.leg}><boxGeometry args={[1.78, 0.08, 0.02]} /></mesh>
      {/* a notebook and a pen */}
      <group position={[0.36, DESK_Y, 0.05]} rotation-y={0.32}>
        <mesh position={[0, 0.006, 0]} castShadow receiveShadow material={m.cover}><boxGeometry args={[0.15, 0.012, 0.21]} /></mesh>
        <mesh position={[0.003, 0.006, 0]} material={m.pages}><boxGeometry args={[0.146, 0.009, 0.206]} /></mesh>
        <mesh position={[0.05, 0.0125, 0]} material={m.pen}><boxGeometry args={[0.006, 0.002, 0.21]} /></mesh>
      </group>
      <mesh position={[0.5, DESK_Y + 0.005, 0.06]} rotation={[0, 0.9, Math.PI / 2]} castShadow material={m.pen}>
        <cylinderGeometry args={[0.0045, 0.0045, 0.14, 10]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- the desk lamp
const BASE = new THREE.Vector3(-0.6, DESK_Y, -0.3);
const ELBOW = new THREE.Vector3(-0.63, 1.13, -0.4);
const HEAD = new THREE.Vector3(-0.43, 1.19, -0.22);
const AIM = new THREE.Vector3(-0.22, DESK_Y, -0.06);

function Segment({ a, b, r, material }: { a: THREE.Vector3; b: THREE.Vector3; r: number; material: THREE.Material }) {
  const d = b.clone().sub(a);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  return (
    <mesh position={a.clone().add(b).multiplyScalar(0.5)} quaternion={q} castShadow material={material}>
      <cylinderGeometry args={[r, r, d.length(), 12]} />
    </mesh>
  );
}

export function Lamp() {
  const spot = useRef<THREE.SpotLight>(null);
  const bounce = useRef<THREE.PointLight>(null);
  const k = useRef(1);
  const m = useMemo(() => ({
    body: new THREE.MeshStandardMaterial({ color: "#244a3e", roughness: 0.35, metalness: 0.55 }),
    inside: new THREE.MeshStandardMaterial({ color: "#f3e3c8", emissive: new THREE.Color("#ffcf96"), emissiveIntensity: 0.9, side: THREE.BackSide }),
    bulb: new THREE.MeshStandardMaterial({ color: "#fff3df", emissive: new THREE.Color("#ffd9a8"), emissiveIntensity: 7 }),
  }), []);
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.copy(AIM);
    return o;
  }, []);
  // the shade points from the head at the desk
  const shadeQ = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), AIM.clone().sub(HEAD).normalize()), []);
  const bulbPos = useMemo(() => HEAD.clone().addScaledVector(AIM.clone().sub(HEAD).normalize(), 0.035), []);

  useFrame((_, dt) => {
    const on = useRoom.getState().lamp;
    // the filament lights at once and glows out over a moment
    k.current += ((on ? 1 : 0) - k.current) * Math.min(1, dt * (on ? 14 : 5));
    if (spot.current) spot.current.intensity = 3.2 * k.current;
    if (bounce.current) bounce.current.intensity = 0.55 * k.current;
    m.bulb.emissiveIntensity = 7 * k.current;
    m.inside.emissiveIntensity = 0.9 * k.current;
  });

  const props = clickable(() => (useRoom.getState().lamp ? "LAMP · SWITCH OFF" : "LAMP · SWITCH ON"), () => useRoom.getState().toggleLamp());
  return (
    <group {...props}>
      <mesh position={[BASE.x, BASE.y + 0.011, BASE.z]} castShadow receiveShadow material={m.body}>
        <cylinderGeometry args={[0.07, 0.075, 0.022, 32]} />
      </mesh>
      <Segment a={BASE.clone().setY(BASE.y + 0.02)} b={ELBOW} r={0.008} material={m.body} />
      <Segment a={ELBOW} b={HEAD} r={0.008} material={m.body} />
      <mesh position={ELBOW} material={m.body}><sphereGeometry args={[0.016, 16, 12]} /></mesh>
      <group position={HEAD} quaternion={shadeQ}>
        <mesh position={[0, -0.04, 0]} castShadow material={m.body}>
          <cylinderGeometry args={[0.028, 0.085, 0.12, 32, 1, true]} />
        </mesh>
        <mesh position={[0, -0.04, 0]} material={m.inside}>
          <cylinderGeometry args={[0.0275, 0.084, 0.119, 32, 1, true]} />
        </mesh>
        <mesh position={[0, 0.025, 0]} castShadow material={m.body}><sphereGeometry args={[0.03, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
      </group>
      <mesh position={bulbPos} material={m.bulb}><sphereGeometry args={[0.022, 16, 12]} /></mesh>
      <primitive object={target} />
      <spotLight
        ref={spot}
        position={bulbPos}
        target={target}
        color="#ffc98f"
        intensity={3.2}
        angle={0.95}
        penumbra={0.75}
        distance={4}
        decay={2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-near={0.05}
        shadow-camera-far={4}
      />
      {/* the light the desk throws back up */}
      <pointLight ref={bounce} position={[-0.25, 0.95, -0.05]} color="#ffb877" intensity={0.55} distance={2.6} decay={2} />
    </group>
  );
}
