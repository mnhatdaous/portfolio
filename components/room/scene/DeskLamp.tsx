"use client";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clickable } from "../lib/interact";
import { soft } from "../lib/shapes";
import { useRoom } from "../store";
import { DESK_Y } from "./Desk";

// An architect's lamp at the left end of the desk, in black: a round iron base, two springs, a lower arm of three rods
// and an upper arm of two, knuckles at the joints, and a cone shade with a cream lining bent down over the cat and the
// notebook. A click switches it; it comes on with the other lamps at sunset.

const deg = THREE.MathUtils.degToRad;
const V = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);

/** where it stands, at the left end of the desk, and which way it reaches: along the desk, its head over the sleeping
 * cat, so the light falls on the cat and the notebook */
const BASE = V(-1.38, DESK_Y, -2.16);
const YAW = -0.315;
/** the arm in the plane it moves in: x along the reach, y up from the desk */
const L1 = 0.45, L2 = 0.45;
const A1 = deg(75), A2 = deg(20), HEAD = deg(-75);
const D1 = V(Math.cos(A1), Math.sin(A1)), N1 = V(-Math.sin(A1), Math.cos(A1));
const D2 = V(Math.cos(A2), Math.sin(A2)), N2 = V(-Math.sin(A2), Math.cos(A2));
const SHOULDER = V(0, 0.075);
const ELBOW = SHOULDER.clone().addScaledVector(D1, L1);
const WRIST = ELBOW.clone().addScaledVector(D2, L2);
/** the springs run from a lug behind the pivot to a pin a little way up the lower arm, just behind it */
const SPRING_FROM = V(-0.03, 0.028), SPRING_TO = SHOULDER.clone().addScaledVector(D1, 0.1).addScaledVector(N1, 0.016);

/** a coil spring along +y */
class Helix extends THREE.Curve<THREE.Vector3> {
  constructor(private len: number, private r: number, private turns: number) {
    super();
  }
  override getPoint(t: number, out = new THREE.Vector3()) {
    const a = t * this.turns * Math.PI * 2;
    return out.set(Math.cos(a) * this.r, t * this.len, Math.sin(a) * this.r);
  }
}

/** the base: a low iron disc, its edge rounded, with a boss in the middle */
const BASE_PROFILE = [[0, 0], [0.074, 0], [0.078, 0.003], [0.079, 0.012], [0.076, 0.018], [0.066, 0.022], [0.03, 0.026], [0.022, 0.03], [0, 0.031]];
/** the shade, from the mouth up to the top of its domed back; its axis is -y */
const SHADE_PROFILE = [[0.071, -0.178], [0.064, -0.158], [0.055, -0.135], [0.046, -0.11], [0.039, -0.085], [0.034, -0.062],
  ...Array.from({ length: 7 }, (_, i) => { const a = (Math.PI / 2) * (1 - i / 6); return [0.032 * Math.sin(a), -0.052 + 0.032 * Math.cos(a)]; })];
const lathe = (pts: number[][], k = 1) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r * k, 0.0001), y)), 40);

const UP = V(0, 1, 0);
/** a rod from a to b */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number) {
  const d = b.clone().sub(a);
  return { p: a.clone().add(b).multiplyScalar(0.5), q: new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()), len: d.length(), r };
}
const Z = new THREE.Euler(Math.PI / 2, 0, 0);

export function DeskLamp() {
  const m = useMemo(() => ({
    iron: new THREE.MeshStandardMaterial({ color: "#1c1d20", roughness: 0.42, metalness: 0.45 }),
    spring: new THREE.MeshStandardMaterial({ color: "#3a3c40", roughness: 0.3, metalness: 0.7 }),
    lining: new THREE.MeshStandardMaterial({ color: "#efe9dd", roughness: 0.6, side: THREE.BackSide, emissive: new THREE.Color("#ffd9a3"), emissiveIntensity: 0 }),
    bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff1d8") }),
  }), []);
  const g = useMemo(() => {
    const spring = rod(SPRING_FROM, SPRING_TO, 0);
    return {
      base: lathe(BASE_PROFILE),
      shade: lathe(SHADE_PROFILE),
      lining: lathe(SHADE_PROFILE, 0.955),
      spring: new THREE.TubeGeometry(new Helix(spring.len, 0.0052, 30), 30 * 8, 0.0009, 4, false),
      springAt: spring,
      rods: [
        // the lower arm: a rod either side, and the one that keeps the head's angle, below them
        ...[-1, 1].map((s) => rod(SHOULDER.clone().setZ(s * 0.012), ELBOW.clone().setZ(s * 0.012), 0.0038)),
        rod(SHOULDER.clone().addScaledVector(N1, -0.02), ELBOW.clone().addScaledVector(N1, -0.02), 0.003),
        // the upper arm: two rods, one over the other, running on a little past the elbow
        ...[-1, 1].map((s) => rod(ELBOW.clone().addScaledVector(D2, -0.035).addScaledVector(N2, s * 0.01), WRIST.clone().addScaledVector(N2, s * 0.01), 0.0034)),
      ],
    };
  }, []);

  const light = useRef<THREE.SpotLight>(null), target = useRef<THREE.Object3D>(null), k = useRef(0);
  useLayoutEffect(() => {
    if (light.current && target.current) light.current.target = target.current;
  }, []);
  useFrame((_, dt) => {
    const on = useRoom.getState().deskLamp;
    k.current += ((on ? 1 : 0) - k.current) * Math.min(1, dt * (on ? 10 : 4));
    if (light.current) light.current.intensity = 1.5 * k.current;
    m.lining.emissiveIntensity = 0.9 * k.current;
    m.bulb.color.setRGB(1, 0.95, 0.85).multiplyScalar(0.75 + 3.6 * k.current);
  });
  const label = () => (useRoom.getState().deskLamp ? "DESK LAMP · SWITCH OFF" : "DESK LAMP · SWITCH ON");

  return (
    <group position={BASE} rotation-y={YAW} {...clickable(label, () => useRoom.getState().toggleDeskLamp())}>
      <mesh geometry={g.base} castShadow receiveShadow material={m.iron} />
      {/* the turret, the yoke the arm pivots in, its axle and knobs */}
      <mesh position={[0, 0.045, 0]} castShadow material={m.iron}><cylinderGeometry args={[0.013, 0.015, 0.03, 20]} /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0.066, s * 0.019]} castShadow material={m.iron}><primitive object={soft(0.026, 0.032, 0.004, 0.0015)} attach="geometry" /></mesh>
      ))}
      <mesh position={SHOULDER} rotation={Z} material={m.iron}><cylinderGeometry args={[0.0045, 0.0045, 0.05, 10]} /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[SHOULDER.x, SHOULDER.y, s * 0.026]} rotation={Z} castShadow material={m.iron}><cylinderGeometry args={[0.01, 0.01, 0.005, 18]} /></mesh>
      ))}
      {/* the springs, from a lug at the back of the base */}
      <mesh position={[SPRING_FROM.x, SPRING_FROM.y - 0.004, 0]} castShadow material={m.iron}><primitive object={soft(0.018, 0.012, 0.034, 0.003)} attach="geometry" /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={g.spring} position={[SPRING_FROM.x, SPRING_FROM.y, s * 0.011]} quaternion={g.springAt.q} castShadow material={m.spring} />
      ))}
      <mesh position={SPRING_TO} rotation={Z} material={m.iron}><cylinderGeometry args={[0.0025, 0.0025, 0.03, 8]} /></mesh>

      {g.rods.map((r, i) => (
        <mesh key={i} position={r.p} quaternion={r.q} castShadow material={m.iron}><cylinderGeometry args={[r.r, r.r, r.len, 8]} /></mesh>
      ))}
      {/* the elbow and the wrist: an axle through the rods, a knob either end */}
      {[{ p: ELBOW, r: 0.0075, len: 0.044, knob: 0.011 }, { p: WRIST, r: 0.006, len: 0.03, knob: 0.0085 }].map(({ p, r, len, knob }, i) => (
        <group key={i} position={p}>
          <mesh rotation={Z} castShadow material={m.iron}><cylinderGeometry args={[r, r, len, 12]} /></mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, 0, (s * len) / 2]} rotation={Z} castShadow material={m.iron}><cylinderGeometry args={[knob, knob, 0.005, 18]} /></mesh>
          ))}
        </group>
      ))}

      {/* the shade, hung from the wrist and bent down; the light shines out along its axis */}
      <group position={WRIST} rotation-z={Math.PI / 2 + HEAD}>
        <mesh position={[0, -0.012, 0]} castShadow material={m.iron}><cylinderGeometry args={[0.0045, 0.0045, 0.026, 10]} /></mesh>
        <mesh geometry={g.shade} castShadow receiveShadow material={m.iron} />
        <mesh geometry={g.lining} material={m.lining} />
        <mesh position={[0, -0.178, 0]} rotation-x={Math.PI / 2} castShadow material={m.iron}><torusGeometry args={[0.071, 0.0026, 8, 48]} /></mesh>
        <mesh position={[0, -0.044, 0.031]} rotation={Z} material={m.iron}><cylinderGeometry args={[0.0048, 0.0048, 0.012, 12]} /></mesh>
        <mesh position={[0, -0.082, 0]} material={m.bulb}><sphereGeometry args={[0.021, 16, 12]} /></mesh>
        <spotLight ref={light} position={[0, -0.09, 0]} color="#ffd8a4" intensity={0} angle={0.55} penumbra={0.55} distance={2.6} decay={2} />
        <object3D ref={target} position={[0, -1, 0]} />
      </group>
    </group>
  );
}
