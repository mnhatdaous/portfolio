"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { sound } from "../lib/audio";
import { clickable } from "../lib/interact";
import { soft } from "../lib/shapes";
import { ROOM } from "./Room";

// The art: three famous paintings hung together on the back wall above the beanbag (prints of public-domain scans
// from Wikimedia Commons, in public/art), and an acoustic guitar on a stand beside them. Each picture hangs a touch
// crooked until you straighten it; the guitar strums a chord, the next in a lofi loop each time.

type Picture = { src: string; label: string; x: number; y: number; w: number; h: number; frame: "gold" | "oak" | "black"; mat: number; tilt: number };
const PICTURES: Picture[] = [
  { src: "./art/starry-night.jpg", label: "THE STARRY NIGHT · VAN GOGH, 1889", x: -2.28, y: 1.68, w: 0.6, h: 0.475, frame: "oak", mat: 0.06, tilt: 0.02 },
  { src: "./art/mona-lisa.jpg", label: "MONA LISA · LEONARDO DA VINCI", x: -1.42, y: 1.6, w: 0.4, h: 0.596, frame: "gold", mat: 0, tilt: -0.014 },
  { src: "./art/great-wave.jpg", label: "THE GREAT WAVE · HOKUSAI, ABOUT 1831", x: -0.58, y: 1.66, w: 0.5, h: 0.336, frame: "black", mat: 0.06, tilt: 0.024 },
];
const FRAME = {
  gold: { b: 0.075, d: 0.045, bevel: 0.012 },
  oak: { b: 0.03, d: 0.03, bevel: 0.004 },
  black: { b: 0.022, d: 0.026, bevel: 0.003 },
};

/** a picture frame: a rectangle with the opening cut out, its edges rounded over */
function frameRing(w: number, h: number, b: number, d: number, bevel: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 - b, -h / 2 - b);
  s.lineTo(w / 2 + b, -h / 2 - b);
  s.lineTo(w / 2 + b, h / 2 + b);
  s.lineTo(-w / 2 - b, h / 2 + b);
  s.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-w / 2, -h / 2);
  hole.lineTo(-w / 2, h / 2);
  hole.lineTo(w / 2, h / 2);
  hole.lineTo(w / 2, -h / 2);
  hole.closePath();
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 1 });
  g.translate(0, 0, -d / 2 + bevel);
  return g;
}

export function Paintings() {
  const m = useMemo(() => {
    const frames = {
      gold: new THREE.MeshStandardMaterial({ color: "#c9a24a", metalness: 0.85, roughness: 0.32 }),
      goldInner: new THREE.MeshStandardMaterial({ color: "#8a6a2c", metalness: 0.8, roughness: 0.4 }),
      oak: new THREE.MeshStandardMaterial({ color: "#b98a5a", roughness: 0.6 }),
      black: new THREE.MeshStandardMaterial({ color: "#1d1d1f", roughness: 0.45 }),
    };
    const loader = new THREE.TextureLoader();
    const art = PICTURES.map((p) => {
      const t = loader.load(p.src);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      // a little light of its own, as if each were lit for a gallery; the oil paintings carry some varnish sheen
      return new THREE.MeshStandardMaterial({ map: t, roughness: p.frame === "black" ? 0.85 : 0.5, emissive: "#ffffff", emissiveMap: t, emissiveIntensity: p.frame === "gold" ? 0.3 : 0.16 });
    });
    return {
      frames,
      art,
      mat: new THREE.MeshStandardMaterial({ color: "#f6f2ea", roughness: 0.95 }),
      backing: new THREE.MeshStandardMaterial({ color: "#3a332c", roughness: 0.9 }),
      brass: new THREE.MeshStandardMaterial({ color: "#b8925a", metalness: 0.85, roughness: 0.3 }),
      glow: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffe2b0").multiplyScalar(1.6) }),
    };
  }, []);
  const geo = useMemo(() => PICTURES.map((p) => {
    const f = FRAME[p.frame], w = p.w + 2 * p.mat, h = p.h + 2 * p.mat;
    return { ring: frameRing(w, h, f.b, f.d, f.bevel), inner: p.frame === "gold" ? frameRing(w, h, 0.014, f.d * 0.7, 0.003) : null, w, h, f };
  }), []);

  // each hangs a little crooked; a click straightens it, with a swing that settles
  const swing = useRef(PICTURES.map((p) => ({ a: p.tilt, v: 0, to: p.tilt })));
  const groups = useRef<(THREE.Group | null)[]>([]);
  useFrame((_, dt) => {
    const step = Math.min(dt, 1 / 30);
    swing.current.forEach((s, i) => {
      s.v += (-(s.a - s.to) * 60 - s.v * 3.2) * step;
      s.a += s.v * step;
      const g = groups.current[i];
      if (g) g.rotation.z = s.a;
    });
  });

  return (
    <group>
      {PICTURES.map((p, i) => {
        const { ring, inner, w, h, f } = geo[i];
        return (
          // on the back wall, facing into the room; it hangs from a nail above its middle, so it pivots there
          <group key={p.src} position={[p.x, p.y + h / 2 + f.b, ROOM.z1 - f.d / 2 - 0.004]} rotation-y={Math.PI}>
            <group
              ref={(g) => { groups.current[i] = g; }}
              {...clickable(p.label, () => {
                const s = swing.current[i];
                s.to = 0;
                s.v += (s.a > 0 ? -1 : 1) * 0.35;
              })}
            >
              <group position={[0, -h / 2 - f.b, 0]}>
                <mesh geometry={ring} castShadow receiveShadow material={m.frames[p.frame]} />
                {inner && <mesh geometry={inner} position={[0, 0, 0.004]} material={m.frames.goldInner} />}
                <mesh position={[0, 0, -f.d / 2 + 0.003]} material={m.backing}><planeGeometry args={[w + 0.01, h + 0.01]} /></mesh>
                {p.mat > 0 && <mesh position={[0, 0, -0.004]} receiveShadow material={m.mat}><planeGeometry args={[w, h]} /></mesh>}
                <mesh position={[0, 0, -0.002]} receiveShadow material={m.art[i]}><planeGeometry args={[p.w, p.h]} /></mesh>
              </group>
            </group>
            {/* the Mona Lisa has a brass picture light over her */}
            {p.frame === "gold" && (
              <group position={[0, 0.06, 0]}>
                <mesh position={[0, 0, 0.03]} rotation-x={Math.PI / 2} material={m.brass}><cylinderGeometry args={[0.006, 0.006, 0.07, 8]} /></mesh>
                <mesh position={[0, -0.01, 0.07]} rotation-z={Math.PI / 2} castShadow material={m.brass}><cylinderGeometry args={[0.022, 0.022, 0.3, 20]} /></mesh>
                <mesh position={[0, -0.031, 0.07]} material={m.glow}><boxGeometry args={[0.27, 0.003, 0.02]} /></mesh>
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}

// ---------------------------------------------------------------- the guitar
// A steel-string acoustic on a stand: spruce top, mahogany back, sides and neck, a rosewood fretboard. Its own
// coordinates: x across, y from the bottom of the body up the neck, z out of the top.
const BODY = { len: 0.5, depth: 0.1 };
const SCALE = 0.645, SADDLE = 0.19, NUT = SADDLE + SCALE;
const fretY = (n: number) => NUT - SCALE * (1 - Math.pow(2, -n / 12));
// a lofi loop: I, vi, IV, iii in C, each as the strings sound it, low to high
const CHORDS = [
  [130.81, 164.81, 196.0, 246.94, 329.63], // Cmaj7
  [110.0, 164.81, 196.0, 261.63, 329.63], // Am7
  [87.31, 220.0, 261.63, 329.63], // Fmaj7
  [82.41, 123.47, 164.81, 196.0, 293.66, 329.63], // Em7
];

/** the body's outline: a big lower bout, a waist and a smaller upper bout */
function bodyShape() {
  const half = (y: number) => {
    const lower = 0.19 * Math.sqrt(Math.max(0, 1 - ((y - 0.165) / 0.175) ** 2));
    const upper = 0.145 * Math.sqrt(Math.max(0, 1 - ((y - 0.385) / 0.125) ** 2));
    return Math.log(Math.exp(lower * 70) + Math.exp(upper * 70)) / 70 - 0.01;
  };
  const s = new THREE.Shape(), n = 48;
  for (let i = 0; i <= n; i++) {
    const y = (i / n) * BODY.len, x = Math.max(0.004, half(y));
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  for (let i = n; i >= 0; i--) {
    const y = (i / n) * BODY.len;
    s.lineTo(-Math.max(0.004, half(y)), y);
  }
  s.closePath();
  return s;
}

export function Guitar() {
  const m = useMemo(() => ({
    top: new THREE.MeshStandardMaterial({ color: "#d9a55e", roughness: 0.38 }),
    mahogany: new THREE.MeshStandardMaterial({ color: "#5e2f1b", roughness: 0.35 }),
    rosewood: new THREE.MeshStandardMaterial({ color: "#2a1a12", roughness: 0.6 }),
    hole: new THREE.MeshStandardMaterial({ color: "#140d09", roughness: 1 }),
    guard: new THREE.MeshStandardMaterial({ color: "#3b1c12", roughness: 0.3 }),
    bone: new THREE.MeshStandardMaterial({ color: "#efe6d2", roughness: 0.5 }),
    metal: new THREE.MeshStandardMaterial({ color: "#d8cfb8", metalness: 0.9, roughness: 0.25 }),
    stand: new THREE.MeshStandardMaterial({ color: "#1b1c1e", roughness: 0.5, metalness: 0.4 }),
  }), []);
  const g = useMemo(() => {
    const body = new THREE.ExtrudeGeometry(bodyShape(), { depth: BODY.depth - 0.016, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 3, curveSegments: 4 });
    body.translate(0, 0, -BODY.depth + 0.008);
    const guard = new THREE.Shape();
    guard.moveTo(0.02, 0.28);
    guard.bezierCurveTo(0.1, 0.27, 0.12, 0.33, 0.1, 0.37);
    guard.bezierCurveTo(0.085, 0.4, 0.06, 0.39, 0.05, 0.37);
    guard.closePath();
    // the strings run from the saddle to the nut, closer together at the nut
    const strings = Array.from({ length: 6 }, (_, i) => {
      const k = i / 5 - 0.5, a = new THREE.Vector3(k * 0.056, SADDLE, 0.012), b = new THREE.Vector3(k * 0.042, NUT, 0.012);
      return { mid: a.clone().lerp(b, 0.5), len: a.distanceTo(b), tilt: Math.atan2(b.x - a.x, b.y - a.y), r: 0.00045 + (5 - i) * 0.00012 };
    });
    return { body, guard: new THREE.ShapeGeometry(guard), strings };
  }, []);
  const turn = useRef(0), rung = useRef(-1);
  const stringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const strum = () => {
    sound.strum(CHORDS[turn.current % CHORDS.length]);
    turn.current++;
    rung.current = 0;
  };
  useFrame((_, dt) => {
    if (rung.current < 0) return;
    rung.current += dt;
    const t = rung.current, amp = 0.0011 * Math.exp(-t * 2.2);
    stringRefs.current.forEach((s, i) => {
      if (s) s.position.z = 0.012 + Math.sin(t * (90 + i * 23)) * amp;
    });
    if (t > 3) rung.current = -1;
  });

  const lean = 0.3, yoke = 0.72;
  return (
    // standing on its stand by the wall, turned a little toward the room
    <group position={[0.18, 0.1, ROOM.z1 - 0.34]} rotation-y={Math.PI + 0.32}>
      <group rotation-x={-lean} {...clickable("GUITAR · STRUM", strum)}>
        <mesh geometry={g.body} castShadow receiveShadow material={[m.top, m.mahogany]} />
        {/* the sound hole and its rosette, the pickguard, the bridge and saddle */}
        <mesh position={[0, 0.33, 0.0005]} material={m.hole}><circleGeometry args={[0.046, 40]} /></mesh>
        <mesh position={[0, 0.33, 0.0008]} material={m.guard}><ringGeometry args={[0.05, 0.058, 48]} /></mesh>
        <mesh geometry={g.guard} position={[0, 0, 0.0007]} material={m.guard} />
        <mesh position={[0, SADDLE - 0.012, 0.004]} castShadow material={m.rosewood}><primitive object={soft(0.15, 0.03, 0.008, 0.003)} attach="geometry" /></mesh>
        <mesh position={[0, SADDLE, 0.009]} material={m.bone}><boxGeometry args={[0.075, 0.003, 0.004]} /></mesh>
        {/* the neck, its fretboard with frets and dots, the nut */}
        <mesh position={[0, (0.47 + NUT) / 2, -0.014]} castShadow material={m.mahogany}><primitive object={soft(0.05, NUT - 0.47, 0.026, 0.01)} attach="geometry" /></mesh>
        <mesh position={[0, (fretY(20) + NUT) / 2, 0.003]} castShadow material={m.rosewood}><boxGeometry args={[0.052, NUT - fretY(20), 0.006]} /></mesh>
        {Array.from({ length: 20 }, (_, n) => (
          <mesh key={n} position={[0, fretY(n + 1), 0.0065]} material={m.metal}><boxGeometry args={[0.052, 0.0018, 0.0018]} /></mesh>
        ))}
        {[3, 5, 7, 9, 12, 12, 15].map((n, i, all) => {
          const twin = n === 12 ? (all.indexOf(12) === i ? -1 : 1) : 0;
          return (
            <mesh key={i} position={[twin * 0.012, (fretY(n) + fretY(n - 1)) / 2, 0.0062]} rotation-x={Math.PI / 2} material={m.bone}>
              <cylinderGeometry args={[0.0032, 0.0032, 0.001, 12]} />
            </mesh>
          );
        })}
        <mesh position={[0, NUT, 0.007]} material={m.bone}><boxGeometry args={[0.05, 0.005, 0.008]} /></mesh>
        {/* the headstock, angled back, with three tuners a side */}
        <group position={[0, NUT, -0.004]} rotation-x={-0.22}>
          <mesh position={[0, 0.095, 0]} castShadow material={m.mahogany}><primitive object={soft(0.082, 0.19, 0.016, 0.008)} attach="geometry" /></mesh>
          {[-1, 1].flatMap((sd) => [0.04, 0.09, 0.14].map((y) => (
            <group key={`${sd}${y}`} position={[sd * 0.041, y, -0.006]}>
              <mesh position={[sd * 0.012, 0, 0]} rotation-z={Math.PI / 2} material={m.metal}><cylinderGeometry args={[0.004, 0.004, 0.024, 8]} /></mesh>
              <mesh position={[sd * 0.03, 0, 0]} material={m.metal}><primitive object={soft(0.012, 0.018, 0.006, 0.0025)} attach="geometry" /></mesh>
            </group>
          )))}
        </group>
        {g.strings.map((s, i) => (
          <mesh key={i} ref={(o) => { stringRefs.current[i] = o; }} position={s.mid} rotation-z={-s.tilt} material={m.metal}>
            <cylinderGeometry args={[s.r, s.r, s.len, 5]} />
          </mesh>
        ))}
      </group>
      {/* the stand: a cradle the body rests in, splayed feet, a post up the back to a yoke round the neck */}
      <mesh position={[0, -0.008, -0.05]} castShadow material={m.stand}><primitive object={soft(0.26, 0.016, 0.03, 0.006)} attach="geometry" /></mesh>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * 0.15, -0.055, 0.0]} rotation={[0.5, 0, sd * 0.6]} castShadow material={m.stand}><cylinderGeometry args={[0.006, 0.006, 0.12, 8]} /></mesh>
      ))}
      <mesh position={[0, -0.03, -0.16]} rotation-x={Math.PI / 2} material={m.stand}><cylinderGeometry args={[0.007, 0.007, 0.22, 8]} /></mesh>
      <mesh position={[0, (yoke * Math.cos(lean) - 0.1) / 2, -0.27 + 0.02]} rotation-x={0.04} castShadow material={m.stand}>
        <cylinderGeometry args={[0.008, 0.008, yoke * Math.cos(lean) + 0.1, 10]} />
      </mesh>
      <mesh position={[0, yoke * Math.cos(lean), -yoke * Math.sin(lean) - 0.03]} rotation-x={Math.PI / 2 - lean} material={m.stand}>
        <torusGeometry args={[0.032, 0.005, 8, 20, Math.PI]} />
      </mesh>
    </group>
  );
}
