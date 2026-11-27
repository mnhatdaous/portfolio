"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { ParametricGeometry } from "three/addons/geometries/ParametricGeometry.js";
import { clickable } from "../lib/interact";
import { music, toggleMusic } from "../lib/music";
import { canvasTexture, rng } from "../lib/textures";
import { DESK_Y } from "./Desk";

// Over-ear headphones in silver, hung on a stand beside the monitor: a black steel strap rising from a faceted block of
// oak and bent forward at the top. Two rounded aluminium cups with knit cushions hang from telescoping steel arms; a
// steel band arches over a knit canopy, and the canopy rests on the stand. A click plays the music or pauses it, and
// sets them swinging a little.

const STAND = new THREE.Vector3(-0.54, DESK_Y, -2.17);
/** turned toward the window on the left, so from the middle of the room, and from the computer, you see the right
 * cup's face and the other's cushion */
const TURN = -0.75;
/** the band's half-width at the arms, and how far its ends drop below the top of the canopy */
const HALF = 0.078, DROP = 0.04;
/** the top of the stand, where the canopy rests */
const REST = new THREE.Vector3(0, 0.2905, 0.012);

/** a rounded rectangle, centred, drawn into a shape or a hole */
function rounded<T extends THREE.Path>(p: T, w: number, h: number, r: number) {
  const x = -w / 2, y = -h / 2;
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y);
  p.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  p.lineTo(x + w, y + h - r);
  p.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  p.lineTo(x + r, y + h);
  p.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  p.lineTo(x, y + r);
  p.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return p;
}

/** an ear cup's aluminium shell: a soft-edged rounded slab, 3 cm thick, its inner face at +z */
function cupGeometry() {
  const g = new THREE.ExtrudeGeometry(rounded(new THREE.Shape(), 0.05, 0.064, 0.021), { depth: 0.014, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 5, curveSegments: 12 });
  return g.translate(0, 0, -0.007);
}
/** the cushion: a plump knit ring on the cup's inner face */
function cushionGeometry() {
  const s = rounded(new THREE.Shape(), 0.05, 0.064, 0.021);
  s.holes.push(rounded(new THREE.Path(), 0.045, 0.059, 0.018));
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.009, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.0055, bevelSegments: 4, curveSegments: 12 });
  return g.translate(0, 0, 0.021);
}

/** the band's curve: its ends drop to the arms, its top `lift` above the canopy's */
const bandAt = (phi: number, lift: number, out: THREE.Vector3) => out.set(HALF * Math.sin(phi), lift - (lift + DROP) * (1 - Math.cos(phi)), 0);
/** the canopy's width, narrowing to where it meets the arms */
const canopyW = (phi: number) => 0.016 + 0.024 * Math.pow(Math.max(0, Math.cos(phi)), 0.7);
/** the steel band over the top (side 0), or one of the canopy's hemmed edges (side ±1) */
class Band extends THREE.Curve<THREE.Vector3> {
  constructor(private lift: number, private side = 0) {
    super();
  }
  override getPoint(t: number, out = new THREE.Vector3()) {
    const phi = (t * 2 - 1) * (Math.PI / 2);
    return bandAt(phi, this.lift, out).setZ((this.side * canopyW(phi)) / 2);
  }
}
function canopyGeometry() {
  return new ParametricGeometry((u, v, out) => {
    const phi = (v * 2 - 1) * (Math.PI / 2);
    bandAt(phi, 0, out).setZ((u - 0.5) * canopyW(phi));
  }, 6, 40);
}

/** the strap, in its side view: up from inside the block, round a bend and forward over the top */
function strapGeometry() {
  const t = 0.0034, R = 0.02, back = -0.037, top = 0.29, bend = 0.27, front = 0.044, s = new THREE.Shape();
  s.moveTo(back + t, 0.015);
  s.lineTo(back + t, bend);
  s.absarc(back + R, bend, R - t, Math.PI, Math.PI / 2, true);
  s.lineTo(front, top - t);
  s.lineTo(front, top);
  s.lineTo(back + R, top);
  s.absarc(back + R, bend, R, Math.PI / 2, Math.PI, false);
  s.lineTo(back, 0.015);
  s.closePath();
  const W = 0.034, g = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: true, bevelThickness: 0.0008, bevelSize: 0.0008, bevelSegments: 2, curveSegments: 16 });
  return g.rotateY(-Math.PI / 2).translate(W / 2, 0, 0);
}

/** the base: a block of oak cut in facets, a flat top, its sides bulging a little */
function oakBlock() {
  const r = rng(23), N = 8, H = 0.046;
  const ring = (y: number, rad: number, off: number, jit: number) =>
    Array.from({ length: N }, (_, i) => {
      const a = ((i + off) / N) * Math.PI * 2 + (r() - 0.5) * 0.2, k = rad * (1 + (r() - 0.5) * jit);
      return new THREE.Vector3(Math.cos(a) * k * 1.1, y, Math.sin(a) * k * 0.9);
    });
  const top = ring(H, 0.054, 0, 0.14), mid = ring(H * 0.5, 0.066, 0.5, 0.12), bot = ring(0, 0.057, 0, 0.1);
  const ct = new THREE.Vector3(0, H, 0), cb = new THREE.Vector3(), centre = new THREE.Vector3(0, H / 2, 0);
  const tris: THREE.Vector3[][] = [];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    tris.push([ct, top[i], top[j]], [cb, bot[i], bot[j]]);
    tris.push([top[i], top[j], mid[i]], [mid[i], top[j], mid[j]]);
    tris.push([bot[i], bot[j], mid[i]], [mid[i], bot[j], mid[j]]);
  }
  const pos: number[] = [], nor: number[] = [], uv: number[] = [];
  const n = new THREE.Vector3(), e = new THREE.Vector3(), c = new THREE.Vector3(), tan = new THREE.Vector3();
  for (const t of tris) {
    let [a, b, d] = t;
    n.subVectors(b, a).cross(e.subVectors(d, a)).normalize();
    c.copy(a).add(b).add(d).divideScalar(3).sub(centre);
    // every facet faces out
    if (n.dot(c) < 0) { [b, d] = [d, b]; n.negate(); }
    const cap = Math.abs(n.y) > 0.7;
    tan.set(-n.z, 0, n.x).normalize();
    for (const p of [a, b, d]) {
      pos.push(p.x, p.y, p.z);
      nor.push(n.x, n.y, n.z);
      // the grain runs along the top and round the sides
      if (cap) uv.push(p.x / 0.16 + 0.5, p.z / 0.16 + 0.5);
      else uv.push(p.dot(tan) / 0.16 + 0.5, p.y / 0.16 + 0.3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/** light oak: soft bands, fine wavy grain and the pale flecks of its rays */
function oakTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#c99b62";
    ctx.fillRect(0, 0, w, h);
    const r = rng(41);
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(${r() < 0.5 ? "255,226,180" : "120,78,40"},${0.05 + r() * 0.08})`;
      ctx.fillRect(0, r() * h, w, 6 + r() * 22);
    }
    for (let i = 0; i < 90; i++) {
      const y0 = r() * h, amp = 1 + r() * 4, f = 0.008 + r() * 0.02, ph = r() * 7;
      ctx.strokeStyle = `rgba(110,70,36,${0.1 + r() * 0.28})`;
      ctx.lineWidth = 0.5 + r() * 1.3;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const y = y0 + Math.sin(x * f + ph) * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(240,214,170,${0.15 + r() * 0.2})`;
      ctx.fillRect(r() * w, r() * h, 2 + r() * 7, 1 + r() * 1.5);
    }
  }).texture;
}

export function Headphones() {
  const m = useMemo(() => {
    const knit = new THREE.MeshPhysicalMaterial({ color: "#c2c4c7", roughness: 0.95, sheen: 0.5, sheenColor: new THREE.Color("#ffffff"), sheenRoughness: 0.8 });
    return {
      alu: new THREE.MeshStandardMaterial({ color: "#d6d7da", roughness: 0.32, metalness: 0.3 }),
      steel: new THREE.MeshStandardMaterial({ color: "#c4c8cd", roughness: 0.22, metalness: 0.6 }),
      knit,
      canopy: Object.assign(knit.clone(), { side: THREE.DoubleSide }),
      grille: new THREE.MeshStandardMaterial({ color: "#76797e", roughness: 1 }),
      strap: new THREE.MeshStandardMaterial({ color: "#1d1e21", roughness: 0.5, metalness: 0.35 }),
      oak: new THREE.MeshStandardMaterial({ map: oakTexture(), roughness: 0.62 }),
    };
  }, []);
  const g = useMemo(() => ({
    cup: cupGeometry(),
    cushion: cushionGeometry(),
    grille: new THREE.ShapeGeometry(rounded(new THREE.Shape(), 0.04, 0.054, 0.016), 8),
    canopy: canopyGeometry(),
    frame: new THREE.TubeGeometry(new Band(0.011), 48, 0.0027, 6, false),
    hems: [-1, 1].map((s) => new THREE.TubeGeometry(new Band(0, s), 40, 0.0012, 4, false)),
    strap: strapGeometry(),
    block: oakBlock(),
  }), []);

  // a click sets them swinging on the stand, and dying away
  const swing = useRef<THREE.Group>(null), since = useRef(-1);
  useFrame((_, dt) => {
    const o = swing.current;
    if (!o || since.current < 0) return;
    since.current += dt;
    const t = since.current;
    o.rotation.x = 0.1 * Math.exp(-t * 2.6) * Math.sin(t * 8.5);
    if (t > 3) { o.rotation.x = 0; since.current = -1; }
  });
  const label = () => (music.playing() ? "HEADPHONES · PAUSE THE MUSIC" : "HEADPHONES · PLAY THE MUSIC");
  const act = () => { toggleMusic(); since.current = 0; };

  return (
    <group position={STAND} rotation-y={TURN} {...clickable(label, act)}>
      <mesh geometry={g.block} castShadow receiveShadow material={m.oak} />
      <mesh geometry={g.strap} castShadow receiveShadow material={m.strap} />

      <group position={REST} rotation-y={0.05}>
        <group ref={swing}>
          {/* the canopy resting on the stand, the steel band arching over it, its hems either side */}
          <mesh geometry={g.canopy} castShadow receiveShadow material={m.canopy} />
          {g.hems.map((h, i) => <mesh key={i} geometry={h} material={m.alu} />)}
          <mesh geometry={g.frame} castShadow material={m.steel} />
          {[-1, 1].map((s) => (
            <group key={s} position={[s * HALF, 0, 0]}>
              {/* the arm: a short cap at the band's end, and the steel rod drawn a little way out of it */}
              <mesh position={[0, -0.047, 0]} castShadow material={m.alu}><cylinderGeometry args={[0.0052, 0.0045, 0.014, 14]} /></mesh>
              <mesh position={[0, -0.054, 0]} material={m.alu}><sphereGeometry args={[0.0045, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} /></mesh>
              <mesh position={[0, -0.076, 0]} castShadow material={m.steel}><cylinderGeometry args={[0.0021, 0.0021, 0.042, 8]} /></mesh>
              {/* the cup turns on a pivot at its top, its cushion facing the other */}
              <group position={[0, -0.098, 0]} rotation={[0, s * (-Math.PI / 2 - 0.1), s * 0.035]}>
                <mesh material={m.alu}><sphereGeometry args={[0.0045, 12, 8]} /></mesh>
                <group position={[0, -0.044, 0]}>
                  <mesh geometry={g.cup} castShadow receiveShadow material={m.alu} />
                  <mesh geometry={g.cushion} castShadow receiveShadow material={m.knit} />
                  <mesh geometry={g.grille} position={[0, 0, 0.0155]} material={m.grille} />
                </group>
                {s > 0 && (
                  <>
                    {/* the crown and the noise button, on the top of the right cup */}
                    <mesh position={[-0.02, -0.002, 0]} castShadow material={m.alu}><cylinderGeometry args={[0.0068, 0.0068, 0.007, 28]} /></mesh>
                    <mesh position={[0.015, -0.0035, 0]} rotation-z={Math.PI / 2} material={m.alu}><capsuleGeometry args={[0.0022, 0.01, 3, 8]} /></mesh>
                  </>
                )}
              </group>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}
