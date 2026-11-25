"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { ParametricGeometry } from "three/addons/geometries/ParametricGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { clickable } from "../lib/interact";
import { canvasTexture, rng } from "../lib/textures";
import { soft } from "../lib/shapes";
import { useRoom } from "../store";
import { saigonTime } from "./Computer";
import { DESK_Y } from "./Desk";
import { HANG } from "./Room";

// The things that only do something small when clicked, and the plants. They're what make the room feel lived in.

// ---------------------------------------------------------------- a mug of coffee, steaming
const MUG = new THREE.Vector3(0.84, DESK_Y, -1.86);

export function Mug() {
  const st = useRef({ level: 1 });
  const liquid = useRef<THREE.Group>(null);
  const puffs = useRef<(THREE.Sprite | null)[]>([]);
  const m = useMemo(() => {
    const wisp = canvasTexture(64, 64, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, "rgba(255,255,255,.9)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }).texture;
    return {
      glaze: new THREE.MeshStandardMaterial({ color: "#9fb39a", roughness: 0.35, side: THREE.DoubleSide }),
      coffee: new THREE.MeshStandardMaterial({ color: "#3b2416", roughness: 0.15 }),
      steam: Array.from({ length: 4 }, () => new THREE.SpriteMaterial({ map: wisp, transparent: true, depthWrite: false, opacity: 0 })),
    };
  }, []);

  useFrame(({ clock }, dt) => {
    const T = clock.elapsedTime, s = st.current;
    if (liquid.current) liquid.current.scale.y += (Math.max(0.03, s.level) - liquid.current.scale.y) * Math.min(1, dt * 3);
    // wisps rise, widen and fade, one after another; fewer as the mug empties
    puffs.current.forEach((p, i) => {
      if (!p) return;
      const t = (T * 0.32 + i / 4) % 1;
      p.position.set(Math.sin(T * 1.3 + i * 2) * 0.014 * t, 0.1 + t * 0.17, Math.cos(T * 0.9 + i) * 0.01 * t);
      p.scale.setScalar(0.035 + t * 0.07);
      m.steam[i].opacity = Math.sin(t * Math.PI) * 0.2 * Math.min(1, s.level * 3);
    });
  });

  const label = () => (st.current.level > 0.05 ? "COFFEE · SIP" : "COFFEE · ONE MORE");
  const act = () => {
    const s = st.current;
    s.level = s.level > 0.05 ? Math.max(0, s.level - 0.26) : 1;
  };

  return (
    <group position={MUG} {...clickable(label, act)}>
      <mesh position={[0, 0.0475, 0]} castShadow receiveShadow material={m.glaze}><cylinderGeometry args={[0.041, 0.037, 0.095, 32, 1, true]} /></mesh>
      <mesh position={[0, 0.003, 0]} castShadow material={m.glaze}><cylinderGeometry args={[0.037, 0.037, 0.006, 32]} /></mesh>
      <mesh position={[0.045, 0.05, 0]} castShadow material={m.glaze}><torusGeometry args={[0.024, 0.006, 8, 20, Math.PI]} /></mesh>
      <group ref={liquid} position={[0, 0.006, 0]}>
        <mesh position={[0, 0.04, 0]} material={m.coffee}><cylinderGeometry args={[0.038, 0.036, 0.08, 28]} /></mesh>
      </group>
      {m.steam.map((s, i) => <sprite key={i} ref={(o) => { puffs.current[i] = o; }} material={s} />)}
    </group>
  );
}

// ---------------------------------------------------------------- a small clock on the desk, on Saigon time
function drawClock(ctx: CanvasRenderingContext2D) {
  const W = ctx.canvas.width, c = W / 2;
  ctx.fillStyle = "#f6f1e7";
  ctx.fillRect(0, 0, W, W);
  ctx.strokeStyle = "#2b2b2b";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.lineWidth = i % 3 ? 3 : 6;
    ctx.beginPath();
    ctx.moveTo(c + Math.sin(a) * W * 0.36, c - Math.cos(a) * W * 0.36);
    ctx.lineTo(c + Math.sin(a) * W * 0.44, c - Math.cos(a) * W * 0.44);
    ctx.stroke();
  }
  const [h, mm] = saigonTime().split(":").map(Number);
  const hand = (a: number, len: number, w: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + Math.sin(a) * len, c - Math.cos(a) * len);
    ctx.stroke();
  };
  hand(((h % 12) + mm / 60) / 12 * Math.PI * 2, W * 0.24, 9, "#2b2b2b");
  hand((mm / 60) * Math.PI * 2, W * 0.36, 6, "#2b2b2b");
  ctx.fillStyle = "#c0632b";
  ctx.beginPath();
  ctx.arc(c, c, 8, 0, Math.PI * 2);
  ctx.fill();
}

export function DeskClock() {
  const face = useMemo(() => canvasTexture(256, 256, drawClock), []);
  const m = useMemo(() => ({
    body: new THREE.MeshStandardMaterial({ color: "#c0632b", roughness: 0.4 }),
    face: new THREE.MeshStandardMaterial({ map: face.texture, roughness: 0.5 }),
  }), [face]);
  const minute = useRef("");
  useFrame(() => {
    const t = saigonTime();
    if (t === minute.current) return;
    minute.current = t;
    drawClock(face.ctx);
    face.texture.needsUpdate = true;
  });
  return (
    <group position={[0.86, DESK_Y, -2.18]} rotation-y={-0.35}>
      <mesh position={[0, 0.052, 0]} rotation-x={Math.PI / 2} castShadow receiveShadow material={m.body}><cylinderGeometry args={[0.048, 0.048, 0.032, 32]} /></mesh>
      <mesh position={[0, 0.052, 0.0165]} material={m.face}><circleGeometry args={[0.041, 32]} /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.026, 0.004, 0]} rotation-z={s * 0.4} castShadow material={m.body}><cylinderGeometry args={[0.004, 0.004, 0.016, 8]} /></mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- the dome pendant over the desk
export function PendantLamp() {
  const light = useRef<THREE.PointLight>(null);
  const k = useRef(0);
  const m = useMemo(() => ({
    shade: new THREE.MeshStandardMaterial({ color: "#ece3d3", roughness: 0.55 }),
    inner: new THREE.MeshStandardMaterial({ color: "#f6efe2", emissive: new THREE.Color("#ffd9a3"), emissiveIntensity: 0, side: THREE.BackSide }),
    cord: new THREE.MeshStandardMaterial({ color: "#3a3530", roughness: 0.6 }),
    bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff1d8") }),
  }), []);
  useFrame((_, dt) => {
    const on = useRoom.getState().lamp;
    k.current += ((on ? 1 : 0) - k.current) * Math.min(1, dt * (on ? 10 : 4));
    if (light.current) light.current.intensity = 2.6 * k.current;
    m.inner.emissiveIntensity = 1.1 * k.current;
    m.bulb.color.setRGB(1, 0.95, 0.85).multiplyScalar(0.8 + 3.5 * k.current);
  });
  const label = () => (useRoom.getState().lamp ? "PENDANT · SWITCH OFF" : "PENDANT · SWITCH ON");
  // it hangs from the purlin across the glass roof
  const x = 0.62, z = HANG.z, y = 1.98, top = HANG.y;
  return (
    <group position={[x, y, z]} {...clickable(label, () => useRoom.getState().toggleLamp())}>
      <mesh position={[0, (top - y) / 2, 0]} material={m.cord}><cylinderGeometry args={[0.003, 0.003, top - y, 6]} /></mesh>
      <mesh position={[0, top - y - 0.01, 0]} material={m.shade}><cylinderGeometry args={[0.04, 0.04, 0.02, 20]} /></mesh>
      <mesh position={[0, 0.005, 0]} material={m.shade}><cylinderGeometry args={[0.022, 0.026, 0.05, 20]} /></mesh>
      <group scale={[1, 0.72, 1]}>
        <mesh castShadow material={m.shade}><sphereGeometry args={[0.21, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
        <mesh material={m.inner}><sphereGeometry args={[0.206, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
      </group>
      <mesh position={[0, 0.02, 0]} material={m.bulb}><sphereGeometry args={[0.035, 16, 12]} /></mesh>
      <pointLight ref={light} position={[0, -0.05, 0]} color="#ffd6a0" intensity={0} distance={4} decay={2} />
    </group>
  );
}

// ---------------------------------------------------------------- the reading corner: a giant beanbag and a lamp
// in the back corner under the pictures, clear of the board on the left wall
const CORNER = new THREE.Vector3(-2.12, 0, 2.02);
const TAU = Math.PI * 2;
const { smoothstep } = THREE.MathUtils;

/** the beanbag's surface: round it (u), and from the floor up the side, over the rim and down into the hollow you sit
 * in (v). A big soft sack that has settled the way they do: its fill spread out low, the back standing up as a
 * backrest, a hollow pressed into the seat with the cover creased in round it, soft wrinkles where it sags at the
 * front. Its front is +z. */
const BAG = new THREE.SplineCurve(
  [[0, 0], [0.5, 0], [0.68, 0.05], [0.78, 0.17], [0.79, 0.31], [0.72, 0.45], [0.57, 0.56], [0.38, 0.6], [0.2, 0.55], [0, 0.52]].map(([r, y]) => new THREE.Vector2(r, y)),
);
/** where the cover creases, running in toward the hollow: the angle round, and how deep */
const CREASES = [0.3, 1.25, 2.1, 2.75, 3.6, 4.4, 5.3, 5.95].map((a, i) => ({ a, k: 0.6 + ((i * 37) % 10) / 20 }));
function bagPoint(u: number, v: number, out: THREE.Vector3) {
  const p = BAG.getPoint(v), a = u * TAU, front = Math.cos(a), back = Math.max(0, -front);
  const up = smoothstep(v, 0.15, 0.55) * (1 - smoothstep(v, 0.82, 1));
  // the creases run in over the rim and fade out down the slope into the hollow, which stays smooth
  const top = smoothstep(v, 0.46, 0.6) * (1 - smoothstep(v, 0.7, 0.82));
  const fill = Math.min(1, p.x / 0.3);
  let crease = 0;
  for (const c of CREASES) {
    const d = Math.abs((((a - c.a + Math.PI) % TAU) + TAU) % TAU - Math.PI);
    crease += c.k * Math.exp(-((d / 0.09) ** 2));
  }
  const lump = (Math.sin(a * 5 + v * 7) * 0.012 + Math.sin(a * 3 - v * 4 + 1) * 0.016 + Math.sin(a * 11 + v * 13) * 0.004) * fill;
  const sag = Math.max(0, front) * smoothstep(v, 0.08, 0.3) * (1 - smoothstep(v, 0.45, 0.6)) * Math.sin(v * 70 + a * 2) * 0.006;
  const r = p.x * (1 + 0.06 * back * up) + lump + sag - crease * 0.02 * top * fill;
  const y = p.y + up * (0.3 * Math.pow(back, 1.6) - 0.07 * Math.max(0, front)) + lump * up * 0.7 - crease * 0.025 * top;
  return out.set(Math.sin(a) * r, y, Math.cos(a) * r);
}
/** the outward normal there, from the surface either side */
function bagNormal(u: number, v: number, out: THREE.Vector3) {
  const e = 0.002, a = bagPoint(u + e, v, new THREE.Vector3()).sub(bagPoint(u - e, v, new THREE.Vector3()));
  const b = bagPoint(u, Math.min(1, v + e), new THREE.Vector3()).sub(bagPoint(u, Math.max(0, v - e), new THREE.Vector3()));
  return out.crossVectors(a, b).normalize();
}
/** the beanbag seen from a point in its middle, CY up: for each direction round it, how far its surface is at each
 * angle from straight down to straight up. Draping things over it is then a look-up. */
const CY = 0.3, KA = 72, KP = 90;
function bagShape() {
  const p = new THREE.Vector3();
  return Array.from({ length: KA }, (_, k) => {
    const pol: [number, number][] = [];
    for (let i = 0; i <= 160; i++) {
      bagPoint(k / KA, i / 160, p);
      const r = Math.hypot(p.x, p.z), y = p.y - CY;
      pol.push([Math.atan2(y, r), Math.hypot(r, y)]);
    }
    const d = new Float32Array(KP + 1);
    for (let j = 0, i = 1; j <= KP; j++) {
      const phi = -Math.PI / 2 + (j / KP) * Math.PI;
      while (i < pol.length - 1 && pol[i][0] < phi) i++;
      const [p0, d0] = pol[i - 1], [p1, d1] = pol[i];
      d[j] = d0 + ((d1 - d0) * (phi - p0)) / Math.max(1e-6, p1 - p0);
    }
    return d;
  });
}
/** if q is inside the beanbag (or under the floor), move it out along the surface's normal to `gap` clear of it (out
 * along the normal, not straight away from the middle, so nothing resting on it creeps toward the edge) */
function pushOut(q: THREE.Vector3, shape: Float32Array[], gap: number) {
  let moved = false;
  const u = (((Math.atan2(q.x, q.z) / TAU) % 1) + 1) % 1, d = shape[Math.round(u * KA) % KA];
  const rho = Math.hypot(q.x, q.z), y = q.y - CY, phi = Math.atan2(y, rho), dist = Math.hypot(rho, y);
  const f = Math.min(KP - 1e-3, Math.max(1e-3, ((phi + Math.PI / 2) / Math.PI) * KP)), j = Math.min(KP - 1, Math.floor(f));
  const D = d[j] + (d[j + 1] - d[j]) * (f - j);
  if (dist < D + gap) {
    const ph0 = -Math.PI / 2 + (j / KP) * Math.PI, ph1 = ph0 + Math.PI / KP;
    let nr = Math.sin(ph1) * d[j + 1] - Math.sin(ph0) * d[j], ny = -(Math.cos(ph1) * d[j + 1] - Math.cos(ph0) * d[j]);
    const nl = Math.hypot(nr, ny) || 1;
    nr /= nl;
    ny /= nl;
    const depth = (Math.cos(phi) * D - rho) * nr + (Math.sin(phi) * D - y) * ny + gap;
    if (depth > 0) {
      const r2 = Math.max(0, rho + nr * depth);
      q.y = CY + y + ny * depth;
      if (rho > 1e-6) { q.x *= r2 / rho; q.z *= r2 / rho; }
      moved = true;
    }
  }
  if (q.y < 0.006) { q.y = 0.006; moved = true; }
  return moved;
}
/** the throw: a knitted rectangle dropped onto the beanbag and left to settle, by a small cloth simulation run a few
 * steps a frame while the room comes up. It catches on the seat and slides over the front-left side in its own folds,
 * a corner hanging free. */
const THROW = { w: 0.8, h: 1.1, nx: 17, ny: 23, steps: 170 };
function makeThrow() {
  const shape = bagShape(), { w, h, nx, ny } = THROW;
  const geo = new THREE.PlaneGeometry(w, h, nx - 1, ny - 1);
  geo.rotateX(-Math.PI / 2);
  geo.rotateY(0.6);
  geo.translate(-0.2, 1.0, 0.22);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute, n = pos.count;
  const P = Float32Array.from(pos.array as Float32Array), Q = Float32Array.from(P);
  const A: number[] = [], B: number[] = [], L: number[] = [], K: number[] = [];
  const link = (a: number, b: number, k: number) => {
    A.push(a * 3);
    B.push(b * 3);
    L.push(Math.hypot(P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]));
    K.push(k);
  };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const id = j * nx + i;
      if (i + 1 < nx) link(id, id + 1, 1);
      if (j + 1 < ny) link(id, id + nx, 1);
      if (i + 1 < nx && j + 1 < ny) { link(id, id + nx + 1, 0.5); link(id + 1, id + nx, 0.5); }
      if (i + 2 < nx) link(id, id + 2, 0.1);
      if (j + 2 < ny) link(id, id + 2 * nx, 0.1);
    }
  }
  const g = -9.8 / 3600, q = new THREE.Vector3(), touch = new Uint8Array(n);
  let step = 0;
  const once = () => {
    for (let x = 0; x < n * 3; x++) {
      const cur = P[x], v = (cur - Q[x]) * 0.985;
      Q[x] = cur;
      P[x] = cur + v + (x % 3 === 1 ? g : 0);
    }
    touch.fill(0);
    for (let it = 0; it < 5; it++) {
      for (let c = 0; c < A.length; c++) {
        const a = A[c], b = B[c], dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2], d = Math.hypot(dx, dy, dz);
        if (d < 1e-9) continue;
        const f = ((d - L[c]) / d) * 0.5 * K[c];
        P[a] += dx * f; P[a + 1] += dy * f; P[a + 2] += dz * f;
        P[b] -= dx * f; P[b + 1] -= dy * f; P[b + 2] -= dz * f;
      }
      for (let k = 0; k < n; k++) {
        q.fromArray(P, k * 3);
        if (pushOut(q, shape, 0.012)) { q.toArray(P, k * 3); touch[k] = 1; }
      }
    }
    // knit on corduroy grips: where it touches, most of its slide is lost
    for (let k = 0; k < n; k++) if (touch[k]) for (let c = 0; c < 3; c++) Q[k * 3 + c] += (P[k * 3 + c] - Q[k * 3 + c]) * 0.88;
  };
  return {
    geo,
    get done() { return step >= THROW.steps; },
    /** a few more steps, and the cloth shown where it has got to */
    run(steps: number) {
      for (let s = 0; s < steps && step < THROW.steps; s++, step++) once();
      (pos.array as Float32Array).set(P);
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
    },
    /** its two short ends, and which way a tassel hangs off each point along them */
    ends() {
      const out: { p: THREE.Vector3; d: THREE.Vector3 }[] = [];
      for (const [row, inner] of [[0, 1], [ny - 1, ny - 2]]) {
        for (let i = 0; i < nx; i++) {
          const e = new THREE.Vector3().fromArray(P, (row * nx + i) * 3), back = new THREE.Vector3().fromArray(P, (inner * nx + i) * 3);
          out.push({ p: e, d: e.clone().sub(back).normalize().multiplyScalar(0.5).add(new THREE.Vector3(0, -1, 0)).normalize() });
        }
      }
      return out;
    },
  };
}
/** corduroy: the colour and the bump of one rib, repeated round the bag */
function corduroy(normal: boolean) {
  return canvasTexture(32, 4, (ctx, w, h) => {
    for (let i = 0; i < w; i++) {
      const ph = ((i + 0.5) / w) * Math.PI * 2, slope = Math.sin(ph) * 0.6, k = 1 / Math.hypot(1, slope);
      ctx.fillStyle = normal
        ? `rgb(${Math.round(((slope * k + 1) / 2) * 255)},128,${Math.round(((k + 1) / 2) * 255)})`
        : `rgb(${[239, 233, 222].map((c) => Math.round(c * (0.95 + 0.05 * Math.cos(ph)))).join(",")})`;
      ctx.fillRect(i, 0, 1, h);
    }
  }, { repeat: [380, 1], color: !normal }).texture;
}
/** stockinette: rows of little Vs, each leg a soft loop lit on top and shaded below */
function knit() {
  return canvasTexture(128, 120, (ctx, w, h) => {
    ctx.fillStyle = "#cdb99c";
    ctx.fillRect(0, 0, w, h);
    const cw = 16, ch = 12;
    for (let y = 0; y < h; y += ch) {
      for (let x = 0; x < w; x += cw) {
        for (const sd of [-1, 1]) {
          ctx.save();
          ctx.translate(x + cw / 2 + sd * cw * 0.22, y + ch / 2);
          ctx.rotate(sd * -0.5);
          const g = ctx.createLinearGradient(0, -ch / 2, 0, ch / 2);
          g.addColorStop(0, "rgba(255,248,232,.55)");
          g.addColorStop(1, "rgba(95,70,40,.35)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(0, 0, cw * 0.2, ch * 0.62, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }, { repeat: [5, 7] }).texture;
}
/** one half of an open book: the pages rising from the spine in a soft curve and settling toward the edge */
function bookHalf() {
  const s = new THREE.Shape();
  s.moveTo(0.002, 0);
  s.lineTo(0.148, 0);
  s.lineTo(0.148, 0.011);
  s.quadraticCurveTo(0.07, 0.027, 0.004, 0.013);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false, curveSegments: 10 });
  g.translate(0, 0.004, -0.1);
  return g;
}

export function ReadingCorner() {
  const light = useRef<THREE.PointLight>(null);
  const k = useRef(0);
  const m = useMemo(() => ({
    cord: new THREE.MeshPhysicalMaterial({ map: corduroy(false), normalMap: corduroy(true), normalScale: new THREE.Vector2(0.55, 0.55), roughness: 0.92, sheen: 0.7, sheenColor: new THREE.Color("#ffffff"), sheenRoughness: 0.45 }),
    throw: new THREE.MeshPhysicalMaterial({ map: knit(), roughness: 1, sheen: 0.6, sheenColor: new THREE.Color("#fff3dc"), side: THREE.DoubleSide }),
    tassel: new THREE.MeshStandardMaterial({ color: "#c4ae8e", roughness: 1 }),
    cover: new THREE.MeshStandardMaterial({ color: "#2f4a6b", roughness: 0.7 }),
    pages: new THREE.MeshStandardMaterial({ color: "#f4efe4", roughness: 0.9, side: THREE.DoubleSide }),
    metal: new THREE.MeshStandardMaterial({ color: "#2b2a28", roughness: 0.4, metalness: 0.7 }),
    shade: new THREE.MeshStandardMaterial({ color: "#efe2c6", emissive: new THREE.Color("#ffcf96"), emissiveIntensity: 0, roughness: 0.9, side: THREE.DoubleSide }),
  }), []);
  const bag = useMemo(() => {
    const geo = new ParametricGeometry((u, v, out) => bagPoint(u, v, out), 160, 72);
    // where the surface closes to a point (the middle of the base and of the hollow) the triangles have no area and
    // leave a zero normal, which lights as NaN and the bloom spreads it over the screen: point those down and up
    const nrm = geo.getAttribute("normal"), uv = geo.getAttribute("uv");
    for (let i = 0; i < nrm.count; i++) if (Math.hypot(nrm.getX(i), nrm.getY(i), nrm.getZ(i)) < 1e-4) nrm.setXYZ(i, 0, uv.getY(i) < 0.5 ? -1 : 1, 0);
    // the throw, settling over the first frames, and a fringe of tassels at its two ends once it has
    const cloth = makeThrow();
    const fringe = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0026, 0.002, 0.05, 5), m.tassel, THROW.nx * 2);
    fringe.castShadow = true;
    fringe.visible = false;
    const throwGeo = cloth.geo;
    // a book left open on the seat, sunk a little into it
    const at = bagPoint(0.12, 0.88, new THREE.Vector3()), n = bagNormal(0.12, 0.88, new THREE.Vector3());
    const book = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.5));
    return { geo, throw: throwGeo, cloth, fringe, half: bookHalf(), book: { p: at.addScaledVector(n, -0.003), q: book } };
  }, [m]);
  // a click flops into it: it squashes and springs back
  const flop = useRef(-1), group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const on = useRoom.getState().floorLamp;
    k.current += ((on ? 1 : 0) - k.current) * Math.min(1, dt * (on ? 12 : 5));
    if (light.current) light.current.intensity = 2.2 * k.current;
    m.shade.emissiveIntensity = 0.6 * k.current;
    // the throw settles over the first frames; when it has, the tassels go on its ends
    if (!bag.cloth.done) {
      bag.cloth.run(12);
      if (bag.cloth.done) {
        const o = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
        bag.cloth.ends().forEach((t, i) => {
          o.position.copy(t.p).addScaledVector(t.d, 0.025);
          o.quaternion.setFromUnitVectors(up, t.d);
          o.updateMatrix();
          bag.fringe.setMatrixAt(i, o.matrix);
        });
        bag.fringe.instanceMatrix.needsUpdate = true;
        bag.fringe.visible = true;
      }
    }
    const g = group.current;
    if (!g || flop.current < 0) return;
    flop.current += dt;
    const t = flop.current, d = 0.1 * Math.exp(-t * 4.5) * Math.cos(t * 10);
    g.scale.set(1 + d * 0.35, 1 - d, 1 + d * 0.35);
    if (t > 1.6) { g.scale.setScalar(1); flop.current = -1; }
  });
  const label = () => (useRoom.getState().floorLamp ? "READING LAMP · SWITCH OFF" : "READING LAMP · SWITCH ON");
  return (
    <group>
      {/* a giant corduroy beanbag turned toward the windows, a throw falling down one side, a book left open */}
      <group position={CORNER} rotation-y={2.45}>
        <group ref={group} {...clickable("BEANBAG · FLOP DOWN", () => { flop.current = 0; })}>
          <mesh geometry={bag.geo} castShadow receiveShadow material={m.cord} />
          <mesh geometry={bag.throw} castShadow receiveShadow material={m.throw} />
          <primitive object={bag.fringe} />
          <group position={bag.book.p} quaternion={bag.book.q}>
            {[-1, 1].map((sd) => (
              <group key={sd} scale-x={sd} rotation-z={sd * 0.05}>
                <mesh position={[0.076, 0.002, 0]} castShadow material={m.cover}><primitive object={soft(0.152, 0.004, 0.21, 0.0015)} attach="geometry" /></mesh>
                <mesh geometry={bag.half} castShadow receiveShadow material={m.pages} />
              </group>
            ))}
          </group>
        </group>
      </group>
      <group position={[-2.95, 0, 2.95]} {...clickable(label, () => useRoom.getState().toggleFloorLamp())}>
        <mesh position={[0, 0.012, 0]} castShadow receiveShadow material={m.metal}><cylinderGeometry args={[0.14, 0.16, 0.024, 32]} /></mesh>
        <mesh position={[0, 0.75, 0]} castShadow material={m.metal}><cylinderGeometry args={[0.011, 0.011, 1.48, 10]} /></mesh>
        <mesh position={[0, 1.58, 0]} castShadow material={m.shade}><cylinderGeometry args={[0.15, 0.2, 0.28, 32, 1, true]} /></mesh>
        <pointLight ref={light} position={[0, 1.5, 0]} color="#ffd6a3" intensity={0} distance={4.2} decay={2} />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- plants
/** a golden pothos leaf: heart-shaped with a pointed tip, the lobes curving down either side of where the stalk joins,
 * cupped along the midrib and arched, the tip curling down a touch. Its stalk joins at the origin; it points along +y
 * with its face to +z. u runs across it, v from the base to the tip. */
function pothosLeaf() {
  const L = 0.072, W = 0.03;
  return new ParametricGeometry((u, v, out) => {
    const across = u * 2 - 1;
    const half = W * Math.pow(Math.sin(Math.PI * (0.06 + 0.94 * v)), 0.72) * (1 - 0.3 * v);
    const x = across * half;
    const y = L * v - L * 0.16 * Math.abs(across) * Math.pow(1 - v, 3);
    const z = (0.3 * x * x) / W + 0.006 * Math.sin(Math.PI * v) - 0.008 * v * v * v;
    out.set(x, y, z);
  }, 8, 12);
}
/** the leaf's skin: deep green, a pale midrib and curving veins, and the golden streaks a golden pothos has */
function pothosSkin() {
  return canvasTexture(64, 128, (ctx, w, h) => {
    const r = rng(52), g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, "#2f6a2c");
    g.addColorStop(0.5, "#3f8236");
    g.addColorStop(1, "#2f6a2c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      // streaks of yellow-green running out from the midrib toward the edge, as the veins do
      const y0 = h * (0.15 + r() * 0.75), side = r() < 0.5 ? -1 : 1;
      ctx.strokeStyle = `rgba(214,206,110,${0.35 + r() * 0.35})`;
      ctx.lineWidth = 1 + r() * 3;
      ctx.beginPath();
      ctx.moveTo(w / 2, y0);
      ctx.quadraticCurveTo(w / 2 + side * w * 0.25, y0 + h * 0.05, w / 2 + side * w * (0.35 + r() * 0.12), y0 + h * (0.1 + r() * 0.08));
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(190,215,140,.5)";
    ctx.lineWidth = 1;
    for (let k = 1; k < 7; k++) {
      const y = (k / 7) * h;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(w / 2, y);
        ctx.quadraticCurveTo(w / 2 + side * w * 0.2, y + h * 0.04, w / 2 + side * w * 0.42, y + h * 0.12);
        ctx.stroke();
      }
    }
    ctx.fillStyle = "rgba(205,225,160,.75)";
    ctx.fillRect(w / 2 - 1, 0, 2, h);
  }).texture;
}
/** a terracotta pot with a rolled rim, on its saucer: its outline, turned */
const POT_PROFILE = [[0, 0.012], [0.05, 0.012], [0.052, 0.02], [0.063, 0.096], [0.069, 0.099], [0.072, 0.106], [0.071, 0.114], [0.066, 0.116], [0.062, 0.11], [0.06, 0.1]].map(([x, y]) => new THREE.Vector2(x, y));
const SAUCER_PROFILE = [[0, 0], [0.068, 0], [0.074, 0.004], [0.076, 0.014], [0.072, 0.015], [0.069, 0.006], [0, 0.006]].map(([x, y]) => new THREE.Vector2(x, y));

/** a pothos: a bushy pot, and vines that run out across whatever it stands on and trail over the front edge, `edge`
 * metres ahead of the pot (+z). The vines are different lengths, each leaf on its own stalk, alternating sides at
 * the nodes and smaller toward the tips where they're new. */
export function Pothos({ position, vines = 3, length = 6, rotation = 0, edge = 0.14 }: { position: [number, number, number]; vines?: number; length?: number; rotation?: number; edge?: number }) {
  const leaf = useMemo(pothosLeaf, []);
  const skin = useMemo(pothosSkin, []);
  const greens = useMemo(() => ["#ffffff", "#e8f3dd", "#dbe8c8", "#f2f7e8"].map((c) => new THREE.MeshStandardMaterial({ map: skin, color: c, roughness: 0.42, side: THREE.DoubleSide })), [skin]);
  const m = useMemo(() => ({
    pot: new THREE.MeshStandardMaterial({ color: "#b8693f", roughness: 0.9 }),
    soil: new THREE.MeshStandardMaterial({ color: "#2b1d14", roughness: 1 }),
    stem: new THREE.MeshStandardMaterial({ color: "#5b7d3a", roughness: 0.6 }),
  }), []);
  const g = useMemo(() => ({ pot: new THREE.LatheGeometry(POT_PROFILE, 36), saucer: new THREE.LatheGeometry(SAUCER_PROFILE, 36) }), []);
  const { leaves, stems } = useMemo(() => {
    const r = rng(23 + vines * 7 + length), V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const leaves: { p: THREE.Vector3; q: THREE.Quaternion; s: number; c: number }[] = [], tubes: THREE.BufferGeometry[] = [];
    /** a leaf whose tip points along `tip`, its face turned toward `face` */
    const orient = (tip: THREE.Vector3, face: THREE.Vector3) => {
      const y = tip.clone().normalize(), z = face.clone().addScaledVector(y, -face.dot(y)).normalize();
      return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(y, z), y, z));
    };
    /** a leaf on a short stalk from `node`, the stalk arching out to where the leaf's base sits */
    const leafAt = (node: THREE.Vector3, tip: THREE.Vector3, face: THREE.Vector3, size: number, stalk: number) => {
      const base = node.clone().addScaledVector(tip.clone().normalize(), stalk * 0.6).addScaledVector(face.clone().normalize(), stalk * 0.5);
      tubes.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(node, node.clone().lerp(base, 0.5).addScaledVector(face.clone().normalize(), stalk * 0.25), base), 6, 0.0011, 4, false));
      leaves.push({ p: base, q: orient(tip, face), s: size, c: Math.floor(r() * 4) });
    };
    const soilY = 0.1;
    // the bush: leaves on stalks arching up and out of the soil, the big ones outside
    for (let i = 0; i < 22; i++) {
      const a = r() * Math.PI * 2, d = 0.008 + r() * 0.04, out = V(Math.cos(a), 0, Math.sin(a)), h = 0.05 + r() * 0.1;
      const node = V(out.x * d * 0.3, soilY, out.z * d * 0.3), top = V(out.x * d, soilY + h, out.z * d);
      tubes.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(node, V(out.x * d * 0.5, soilY + h * 0.8, out.z * d * 0.5), top), 6, 0.0017, 4, false));
      leafAt(top, out.clone().setY(0.4 + r() * 1.1), V(0, 1, 0).addScaledVector(out, 0.5), 0.85 + r() * 0.45 + d * 4, 0.012);
    }
    // the vines: over the rim, along the surface to the edge, over it and down, swinging a little side to side
    for (let v = 0; v < vines; v++) {
      const phi = (v - (vines - 1) / 2) * 0.42 + (r() - 0.5) * 0.16, dir = V(Math.sin(phi), 0, Math.cos(phi)), side = V(dir.z, 0, -dir.x);
      const reach = Math.max(0.13, edge / Math.cos(phi)), drop = length * 0.045 * (0.55 + r() * 0.75) * (v === 1 ? 1.25 : 1);
      const at = (hh: number, y: number) => dir.clone().multiplyScalar(hh).setY(y);
      const pts = [at(0.02, soilY), at(0.07, 0.122), at(0.09, 0.085), at(0.105, 0.012), at(reach - 0.012, 0.006), at(reach + 0.008, -0.01)];
      const n = Math.max(3, Math.round(drop / 0.05));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        pts.push(at(reach + 0.016 + Math.sin(t * 2.5 + v) * 0.012, -0.01 - drop * t).addScaledVector(side, Math.sin(t * 3.2 + v * 2.1) * 0.03 * t));
      }
      const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
      tubes.push(new THREE.TubeGeometry(curve, 96, 0.0018, 5, false));
      // a node every few centimetres, a leaf at each, alternating sides, the young ones at the tip smaller
      const len = curve.getLength(), count = Math.max(4, Math.round(len / 0.045));
      for (let k = 0; k < count; k++) {
        const u = 0.12 + (0.86 * (k + 0.5)) / count, p = curve.getPointAt(u), tan = curve.getTangentAt(u);
        const lr = k % 2 ? 1 : -1, hanging = p.y < -0.02, young = Math.pow(u, 2.2);
        const tip = hanging ? V(0, -1, 0).addScaledVector(dir, 0.6).addScaledVector(side, lr * 0.6) : tan.clone().setY(0.15).addScaledVector(side, lr * 0.9);
        const face = hanging ? dir.clone().add(V(0, 0.4, 0)).addScaledVector(side, lr * 0.35) : V(0, 1, 0).addScaledVector(side, lr * 0.2);
        leafAt(p.clone().addScaledVector(side, lr * 0.002), tip, face, (1.05 - young * 0.5) * (0.85 + r() * 0.25), 0.014);
      }
    }
    return { leaves, stems: mergeGeometries(tubes)! };
  }, [vines, length, edge]);
  const group = useRef<THREE.Group>(null);
  const rustle = useRef(0);
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), e: new THREE.Euler() }), []);
  useFrame(({ clock }, dt) => {
    const gr = group.current;
    if (!gr) return;
    rustle.current = Math.max(0, rustle.current - dt * 0.8);
    const T = clock.elapsedTime, amp = 0.025 + rustle.current * 0.16;
    gr.children.forEach((c, i) => {
      const w = T * (1.4 + (i % 5) * 0.3) + i;
      c.quaternion.copy(leaves[i].q).multiply(tmp.q.setFromEuler(tmp.e.set(Math.sin(w) * amp, 0, Math.sin(w * 0.7 + 1) * amp)));
    });
  });
  return (
    <group position={position} rotation-y={rotation} {...clickable("POTHOS · RUSTLE", () => { rustle.current = 1; })}>
      <mesh geometry={g.saucer} castShadow receiveShadow material={m.pot} />
      <mesh geometry={g.pot} castShadow receiveShadow material={m.pot} />
      <mesh position={[0, 0.1, 0]} rotation-x={-Math.PI / 2} receiveShadow material={m.soil}><circleGeometry args={[0.061, 32]} /></mesh>
      <mesh geometry={stems} castShadow material={m.stem} />
      <group ref={group}>
        {leaves.map((l, i) => (
          <mesh key={i} geometry={leaf} material={greens[l.c]} position={l.p} quaternion={l.q} scale={l.s} castShadow />
        ))}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- dust in the sunbeams
export function DustMotes() {
  const { geo, mat } = useMemo(() => {
    const r = rng(61), n = 320, pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos.set([-3.0 + r() * 6.0, 0.75 + r() * 1.9, -2.2 + r() * 2.6], i * 3);
      seed[i] = r();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float seed;
        uniform float uTime, uScale;
        varying float vA;
        void main(){
          vec3 p = position + vec3(sin(uTime * .21 + seed * 40.) * .08, sin(uTime * .13 + seed * 17.) * .12, cos(uTime * .17 + seed * 23.) * .08);
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          gl_PointSize = (1.4 + seed * 2.2) * uScale / -mv.z;
          vA = .25 + .75 * pow(.5 + .5 * sin(uTime * (.6 + seed) + seed * 50.), 3.);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main(){
          float d = length(gl_PointCoord - .5);
          gl_FragColor = vec4(vec3(1., .93, .78) * 1.6, smoothstep(.5, .1, d) * vA * .32);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geo, mat };
  }, []);
  useFrame(({ clock, gl }) => {
    mat.uniforms.uTime.value = clock.elapsedTime;
    mat.uniforms.uScale.value = gl.getPixelRatio() * 2;
  });
  return <points geometry={geo} material={mat} />;
}
