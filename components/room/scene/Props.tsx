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

// ---------------------------------------------------------------- the reading corner: a big beanbag and a lamp
// in the back corner under the pictures, clear of the board on the left wall
const CORNER = new THREE.Vector3(-2.15, 0, 2.05);

/** the beanbag's surface: round it (u), and from the floor up the side, over the rim and down into the hollow you sit
 * in (v). It has slumped the way they do: the back stands up as a backrest, the front has sagged, the cover is lumpy.
 * Its front is +z. */
const BAG = new THREE.SplineCurve(
  [[0, 0], [0.36, 0], [0.5, 0.04], [0.58, 0.15], [0.59, 0.28], [0.53, 0.4], [0.41, 0.48], [0.27, 0.5], [0.13, 0.46], [0, 0.44]].map(([r, y]) => new THREE.Vector2(r, y)),
);
function bagPoint(u: number, v: number, out: THREE.Vector3) {
  const p = BAG.getPoint(v), a = u * Math.PI * 2, front = Math.cos(a);
  // the upper part is what slumps (the floor and the very middle stay put): the back rises into a rounded backrest,
  // the front sinks a little where you sit down
  const up = THREE.MathUtils.smoothstep(v, 0.15, 0.55) * (1 - THREE.MathUtils.smoothstep(v, 0.8, 1));
  const lump = (Math.sin(a * 5 + v * 7) * 0.01 + Math.sin(a * 3 - v * 4 + 1) * 0.014) * Math.min(1, p.x / 0.3);
  const back = Math.max(0, -front), r = p.x * (1 + 0.06 * back * up) + lump;
  const y = p.y + up * (0.24 * Math.pow(back, 1.6) - 0.06 * Math.max(0, front)) + lump * up * 0.7;
  return out.set(Math.sin(a) * r, y, Math.cos(a) * r);
}
/** the outward normal there, from the surface either side */
function bagNormal(u: number, v: number, out: THREE.Vector3) {
  const e = 0.002, a = bagPoint(u + e, v, new THREE.Vector3()).sub(bagPoint(u - e, v, new THREE.Vector3()));
  const b = bagPoint(u, Math.min(1, v + e), new THREE.Vector3()).sub(bagPoint(u, Math.max(0, v - e), new THREE.Vector3()));
  return out.crossVectors(a, b).normalize();
}
/** a knit throw lying in the hollow and spilling over the front, a little away from the cover, in folds */
function throwOver(u0: number, u1: number, v0: number, v1: number) {
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  return new ParametricGeometry((s, t, out) => {
    const u = u0 + s * (u1 - u0), v = v0 + t * (v1 - v0);
    bagPoint(u, v, p);
    bagNormal(u, v, n);
    const fold = (0.024 * Math.sin(s * Math.PI * 4 + t * 2.5) + 0.01 * Math.sin(s * Math.PI * 11 - t * 4)) * Math.sin(s * Math.PI);
    const hang = 0.05 * Math.max(0, 1 - t / 0.4);
    out.copy(p).addScaledVector(n, 0.018 + Math.abs(fold) + hang);
    out.y = Math.max(0.004, out.y);
  }, 40, 40);
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
  }, { repeat: [300, 1], color: !normal }).texture;
}

export function ReadingCorner() {
  const light = useRef<THREE.PointLight>(null);
  const k = useRef(0);
  const m = useMemo(() => ({
    cord: new THREE.MeshPhysicalMaterial({ map: corduroy(false), normalMap: corduroy(true), normalScale: new THREE.Vector2(0.55, 0.55), roughness: 0.92, sheen: 0.7, sheenColor: new THREE.Color("#ffffff"), sheenRoughness: 0.45 }),
    // a knit: soft ribs running along the blanket
    throw: new THREE.MeshPhysicalMaterial({
      map: canvasTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = "#cbb79a";
        ctx.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 8) {
          ctx.fillStyle = "rgba(110,85,55,.22)";
          ctx.fillRect(x, 0, 2, h);
          ctx.fillStyle = "rgba(255,246,228,.22)";
          ctx.fillRect(x + 4, 0, 2, h);
        }
      }, { repeat: [5, 2] }).texture,
      roughness: 1, sheen: 0.5, sheenColor: new THREE.Color("#fff3dc"), side: THREE.DoubleSide,
    }),
    cover: new THREE.MeshStandardMaterial({ color: "#2f4a6b", roughness: 0.7 }),
    pages: new THREE.MeshStandardMaterial({ color: "#f4efe4", roughness: 0.9 }),
    metal: new THREE.MeshStandardMaterial({ color: "#2b2a28", roughness: 0.4, metalness: 0.7 }),
    shade: new THREE.MeshStandardMaterial({ color: "#efe2c6", emissive: new THREE.Color("#ffcf96"), emissiveIntensity: 0, roughness: 0.9, side: THREE.DoubleSide }),
  }), []);
  const bag = useMemo(() => {
    const geo = new ParametricGeometry((u, v, out) => bagPoint(u, v, out), 96, 56);
    // where the surface closes to a point (the middle of the base and of the hollow) the triangles have no area and
    // leave a zero normal, which lights as NaN and the bloom spreads it over the screen: point those down and up
    const nrm = geo.getAttribute("normal"), uv = geo.getAttribute("uv");
    for (let i = 0; i < nrm.count; i++) if (Math.hypot(nrm.getX(i), nrm.getY(i), nrm.getZ(i)) < 1e-4) nrm.setXYZ(i, 0, uv.getY(i) < 0.5 ? -1 : 1, 0);
    // a book left open in the hollow
    const at = bagPoint(0.1, 0.9, new THREE.Vector3()), n = bagNormal(0.1, 0.9, new THREE.Vector3());
    const book = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.5));
    return { geo, throw: throwOver(0.87, 1.07, 0.1, 0.9), book: { p: at.addScaledVector(n, 0.012), q: book } };
  }, []);
  // a click flops into it: it squashes and springs back
  const flop = useRef(-1), group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const on = useRoom.getState().floorLamp;
    k.current += ((on ? 1 : 0) - k.current) * Math.min(1, dt * (on ? 12 : 5));
    if (light.current) light.current.intensity = 2.2 * k.current;
    m.shade.emissiveIntensity = 0.6 * k.current;
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
      {/* a giant corduroy beanbag turned toward the windows, a throw spilling over its front, a book left open */}
      <group position={CORNER} rotation-y={2.45}>
        <group ref={group} {...clickable("BEANBAG · FLOP DOWN", () => { flop.current = 0; })}>
          <mesh geometry={bag.geo} castShadow receiveShadow material={m.cord} />
          <mesh geometry={bag.throw} castShadow receiveShadow material={m.throw} />
          <group position={bag.book.p} quaternion={bag.book.q}>
            {[-1, 1].map((sd) => (
              <group key={sd} rotation-z={sd * 0.12}>
                <mesh position={[sd * 0.075, 0.004, 0]} castShadow material={m.cover}><primitive object={soft(0.15, 0.006, 0.22, 0.002)} attach="geometry" /></mesh>
                <mesh position={[sd * 0.072, 0.012, 0]} material={m.pages}><primitive object={soft(0.14, 0.012, 0.21, 0.003)} attach="geometry" /></mesh>
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
function heartLeaf() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.03, 0.006, 0.04, 0.045, 0, 0.07);
  s.bezierCurveTo(-0.04, 0.045, -0.03, 0.006, 0, 0);
  return new THREE.ShapeGeometry(s, 6);
}

/** a pothos: a bushy pot, and vines that run out across whatever it stands on and trail over the front edge, `edge`
 * metres ahead of the pot (+z). Every leaf hangs from a stem. */
export function Pothos({ position, vines = 3, length = 6, rotation = 0, edge = 0.14 }: { position: [number, number, number]; vines?: number; length?: number; rotation?: number; edge?: number }) {
  const leaf = useMemo(heartLeaf, []);
  const greens = useMemo(() => ["#3f7d3a", "#4f8f3f", "#5f9b43", "#3a6e34"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, side: THREE.DoubleSide })), []);
  const m = useMemo(() => ({
    pot: new THREE.MeshStandardMaterial({ color: "#c27a52", roughness: 0.85, side: THREE.DoubleSide }),
    soil: new THREE.MeshStandardMaterial({ color: "#2b1d14", roughness: 1 }),
    stem: new THREE.MeshStandardMaterial({ color: "#56763a", roughness: 0.7 }),
  }), []);
  const { leaves, stems } = useMemo(() => {
    const r = rng(23 + vines * 7 + length), V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const leaves: { p: THREE.Vector3; q: THREE.Quaternion; s: number; c: number }[] = [], tubes: THREE.BufferGeometry[] = [];
    /** a leaf whose tip points along `tip`, its face turned toward `face` */
    const orient = (tip: THREE.Vector3, face: THREE.Vector3) => {
      const y = tip.clone().normalize(), z = face.clone().addScaledVector(y, -face.dot(y)).normalize();
      return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(y, z), y, z));
    };
    // the bush: leaves on short stalks rising out of the soil
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2, d = 0.012 + r() * 0.05, out = V(Math.cos(a), 0, Math.sin(a));
      const base = V(out.x * d, 0.11 + r() * 0.08, out.z * d);
      tubes.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(V(out.x * d * 0.3, 0.088, out.z * d * 0.3), V(out.x * d * 0.6, base.y * 0.85, out.z * d * 0.6), base), 5, 0.0015, 4, false));
      leaves.push({ p: base, q: orient(out.clone().setY(0.5 + r() * 0.9), V(0, 1, 0).addScaledVector(out, 0.4)), s: 0.9 + r() * 0.5, c: Math.floor(r() * 4) });
    }
    // the vines: up over the rim, along the surface to the edge, over it and down, swinging a little side to side
    for (let v = 0; v < vines; v++) {
      const phi = (v - (vines - 1) / 2) * 0.42 + (r() - 0.5) * 0.16, dir = V(Math.sin(phi), 0, Math.cos(phi)), side = V(dir.z, 0, -dir.x);
      const reach = Math.max(0.13, edge / Math.cos(phi)), drop = length * 0.045 * (0.8 + r() * 0.4);
      const at = (h: number, y: number) => dir.clone().multiplyScalar(h).setY(y);
      const pts = [at(0.02, 0.088), at(0.07, 0.112), at(0.088, 0.075), at(0.105, 0.01), at(reach - 0.012, 0.006), at(reach + 0.008, -0.01)];
      const n = Math.max(3, Math.round(drop / 0.05));
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        pts.push(at(reach + 0.018 + Math.sin(t * 2.5 + v) * 0.012, -0.01 - drop * t).addScaledVector(side, Math.sin(t * 3.5 + v * 2.1) * 0.025));
      }
      const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
      tubes.push(new THREE.TubeGeometry(curve, 72, 0.0019, 5, false));
      // a leaf at each node, alternating sides: lying on the shelf along the top, hanging and facing out below the edge
      for (let k = 0; k < length; k++) {
        const u = 0.1 + (0.9 * (k + 0.5)) / length, p = curve.getPointAt(u), tan = curve.getTangentAt(u);
        const lr = k % 2 ? 1 : -1, hanging = p.y < -0.02;
        const tip = hanging ? V(0, -1, 0).addScaledVector(dir, 0.55).addScaledVector(side, lr * 0.55) : tan.clone().setY(0).addScaledVector(side, lr * 0.9);
        const face = hanging ? dir.clone().add(V(0, 0.35, 0)).addScaledVector(side, lr * 0.3) : V(0, 1, 0);
        leaves.push({ p: p.addScaledVector(side, lr * 0.006), q: orient(tip, face), s: 0.72 + r() * 0.32, c: Math.floor(r() * 4) });
      }
    }
    return { leaves, stems: mergeGeometries(tubes)! };
  }, [vines, length, edge]);
  const group = useRef<THREE.Group>(null);
  const rustle = useRef(0);
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), e: new THREE.Euler() }), []);
  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    rustle.current = Math.max(0, rustle.current - dt * 0.8);
    const T = clock.elapsedTime, amp = 0.03 + rustle.current * 0.16;
    g.children.forEach((c, i) => {
      const w = T * (1.4 + (i % 5) * 0.3) + i;
      c.quaternion.copy(leaves[i].q).multiply(tmp.q.setFromEuler(tmp.e.set(Math.sin(w) * amp, 0, Math.sin(w * 0.7 + 1) * amp)));
    });
  });
  return (
    <group position={position} rotation-y={rotation} {...clickable("POTHOS · RUSTLE", () => { rustle.current = 1; })}>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow material={m.pot}><cylinderGeometry args={[0.065, 0.048, 0.1, 24, 1, true]} /></mesh>
      <mesh position={[0, 0.088, 0]} material={m.soil}><cylinderGeometry args={[0.062, 0.062, 0.006, 24]} /></mesh>
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
