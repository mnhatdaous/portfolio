"use client";
import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { rng } from "../lib/textures";

// The green in the room: an olive tree, a fiddle-leaf fig, a monstera and a rubber plant. Trunks and branches are
// tapered tubes along curves; leaves are instanced, so there can be a lot of them.

type Item = { m: THREE.Matrix4; c?: THREE.Color };
function Instances({ geometry, material, items }: { geometry: THREE.BufferGeometry; material: THREE.Material; items: Item[] }) {
  const mesh = useMemo(() => {
    const im = new THREE.InstancedMesh(geometry, material, items.length);
    items.forEach((it, i) => {
      im.setMatrixAt(i, it.m);
      if (it.c) im.setColorAt(i, it.c);
    });
    im.castShadow = im.receiveShadow = true;
    return im;
  }, [geometry, material, items]);
  return <primitive object={mesh} />;
}

const soilMat = new THREE.MeshStandardMaterial({ color: "#3a2a1e", roughness: 1 });
/** an open pot with soil a little below the rim */
function Pot({ r, h, color, rough = 0.75 }: { r: number; h: number; color: string; rough?: number }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: rough, side: THREE.DoubleSide }), [color, rough]);
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow material={mat}><cylinderGeometry args={[r, r * 0.82, h, 32, 1, true]} /></mesh>
      <mesh position={[0, 0.004, 0]} material={mat}><cylinderGeometry args={[r * 0.82, r * 0.82, 0.008, 32]} /></mesh>
      <mesh position={[0, h - 0.025, 0]} material={soilMat}><cylinderGeometry args={[r * 0.96, r * 0.96, 0.01, 32]} /></mesh>
    </group>
  );
}

// ---------------------------------------------------------------- leaves
/** a narrow, pointed leaf one unit long: an olive's, a tulip's */
function blade(width = 0.16) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(width, 0.25, width, 0.75, 0, 1);
  s.bezierCurveTo(-width, 0.75, -width, 0.25, 0, 0);
  return new THREE.ShapeGeometry(s, 6);
}

/** a fiddle-leaf fig's leaf, one unit long: a waist low down, a broad rounded top, cupped a little */
function fiddleLeaf() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.12, 0.02, 0.2, 0.2, 0.15, 0.42);
  s.bezierCurveTo(0.12, 0.55, 0.34, 0.62, 0.3, 0.85);
  s.bezierCurveTo(0.27, 1.0, 0.06, 1.02, 0, 0.97);
  s.bezierCurveTo(-0.06, 1.02, -0.27, 1.0, -0.3, 0.85);
  s.bezierCurveTo(-0.34, 0.62, -0.12, 0.55, -0.15, 0.42);
  s.bezierCurveTo(-0.2, 0.2, -0.12, 0.02, 0, 0);
  const g = new THREE.ShapeGeometry(s, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, -p.getX(i) * p.getX(i) * 0.9 + p.getY(i) * 0.05);
  g.computeVertexNormals();
  return g;
}

const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];

// ---------------------------------------------------------------- trunks, branches and leaves
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

/** a tube along a smooth curve through `points`, tapering from r0 to r1: a trunk, a branch, a twig, a stem */
function taperedTube(points: THREE.Vector3[], r0: number, r1: number, segs = 12, radial = 7) {
  const curve = new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
  const p = g.attributes.position, c = V(0, 0, 0), v = V(0, 0, 0);
  for (let i = 0; i <= segs; i++) {
    curve.getPointAt(i / segs, c);
    const rad = r0 + (r1 - r0) * (i / segs);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(p, k).sub(c).multiplyScalar(rad).add(c);
      p.setXYZ(k, v.x, v.y, v.z);
    }
  }
  return g;
}

/** a leaf's matrix: its length along `dir`, `len` long, its face turned up toward the light as far as it can be */
function leafMatrix(at: THREE.Vector3, dir: THREE.Vector3, len: number, roll = 0) {
  const y = dir.clone().normalize();
  const z = UP.clone().addScaledVector(y, -UP.dot(y));
  if (z.lengthSq() < 1e-6) z.set(1, 0, 0);
  z.normalize();
  if (roll) z.applyAxisAngle(y, roll);
  const x = V(0, 0, 0).crossVectors(y, z);
  return new THREE.Matrix4().makeBasis(x.multiplyScalar(len), y.multiplyScalar(len), z.multiplyScalar(len)).setPosition(at);
}

/** pairs of leaves along a twig, angled forward toward its tip, each pair turned a little from the last; one at the tip */
function leavesAlong(curve: THREE.Curve<THREE.Vector3>, n: number, out: Item[], r: () => number, palette: THREE.Color[], len: [number, number], from = 0.2) {
  const leaf = (at: THREE.Vector3, dir: THREE.Vector3) =>
    out.push({ m: leafMatrix(at, dir, len[0] + r() * (len[1] - len[0]), (r() - 0.5) * 0.6), c: pick(r, palette).clone().offsetHSL(0, 0, (r() - 0.5) * 0.05) });
  for (let i = 0; i < n; i++) {
    const u = from + (1 - from) * (i / n), at = curve.getPointAt(u), t = curve.getTangentAt(u);
    const side = V(0, 0, 0).crossVectors(t, UP);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize().applyAxisAngle(t, i * 1.1 + r() * 0.5);
    for (const sgn of [1, -1]) leaf(at, t.clone().multiplyScalar(0.8).addScaledVector(side, sgn * 0.9).add(V(0, 0.15, 0)));
  }
  leaf(curve.getPointAt(1), curve.getTangentAt(1).add(V(0, 0.1, 0)));
}

/** leaves a shade lighter underneath (olive leaves are silvery there, a rubber plant's reddish) */
function twoTone(m: THREE.MeshStandardMaterial, back: [number, number, number]) {
  m.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      if (!gl_FrontFacing) diffuseColor.rgb *= vec3(${back.map((v) => v.toFixed(2)).join(", ")});`);
  };
  m.customProgramCacheKey = () => `two-tone-${back.join(",")}`;
  return m;
}

/** an oval leaf with a pointed tip, one unit long, folded a little along its midrib */
function ovalLeaf() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.3, 0.05, 0.34, 0.6, 0, 1);
  s.bezierCurveTo(-0.34, 0.6, -0.3, 0.05, 0, 0);
  const g = new THREE.ShapeGeometry(s, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, -Math.abs(p.getX(i)) * 0.25);
  g.computeVertexNormals();
  return g;
}

/** a monstera leaf, one unit long: a broad heart with slits running in from the edge */
function monsteraLeaf() {
  const half = (side: 1 | -1) => {
    const pts: THREE.Vector2[] = [];
    const edge = (t: number) => new THREE.Vector2(side * 0.46 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.75) * (1 - 0.25 * t), t);
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const p = edge(t);
      pts.push(p);
      // a slit at a few points along the edge, cut in toward the midrib
      if ([5, 9, 13, 17].includes(i)) {
        pts.push(new THREE.Vector2(p.x * 0.3, p.y + 0.035));
        pts.push(edge(t + 0.03).clone().setY(p.y + 0.05));
      }
    }
    return side === 1 ? pts : pts.reverse();
  };
  const g = new THREE.ShapeGeometry(new THREE.Shape([...half(1), ...half(-1)]), 2);
  // a gentle droop from the midrib outward
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, -Math.abs(p.getX(i)) * 0.35 - p.getY(i) * p.getY(i) * 0.15);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- an olive tree in the back-right corner
export function OliveTree() {
  const m = useMemo(() => ({
    bark: new THREE.MeshStandardMaterial({ color: "#7d7366", roughness: 0.95 }),
    leaf: twoTone(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.65, side: THREE.DoubleSide }), [1.45, 1.5, 1.4]),
  }), []);
  const { wood, leaves, geo } = useMemo(() => {
    const r = rng(91), tubes: THREE.BufferGeometry[] = [], leaves: Item[] = [];
    const silver = ["#5f7454", "#6b7f5c", "#56694d", "#73865f"].map((h) => new THREE.Color(h));
    // a trunk that leans and corrects itself, then opens into branches
    const trunk = [V(0, 0.36, 0), V(0.05, 0.62, 0.02), V(-0.01, 0.88, 0.05), V(0.04, 1.08, 0.02)];
    tubes.push(taperedTube(trunk, 0.036, 0.022, 14, 8));
    const fork = trunk[3];
    [V(-0.6, 1, 0.3), V(0.65, 1, -0.15), V(0.05, 1.1, 0.6), V(0.4, 0.75, 0.55), V(-0.35, 0.85, -0.5)].forEach((d0, k) => {
      const d = d0.normalize(), len = 0.42 + r() * 0.22;
      const start = k < 3 ? fork.clone() : V(0.02, 0.86 + k * 0.04, 0.04);
      const end = start.clone().addScaledVector(d, len).add(V(0, -0.05, 0));
      const mid = start.clone().lerp(end, 0.5).add(V((r() - 0.5) * 0.08, 0.06, (r() - 0.5) * 0.08));
      tubes.push(taperedTube([start, mid, end], 0.017, 0.005, 10, 6));
      const curve = new THREE.CatmullRomCurve3([start, mid, end]);
      leavesAlong(curve, 6, leaves, r, silver, [0.05, 0.07], 0.5);
      // twigs off the outer part, each with its leaves
      for (let j = 0; j < 4; j++) {
        const u = 0.4 + j * 0.15, at = curve.getPointAt(u), t = curve.getTangentAt(u);
        const td = t.multiplyScalar(0.7).add(V(r() - 0.5, 0.25 + r() * 0.4, r() - 0.5).normalize()).normalize(), tl = 0.13 + r() * 0.1;
        const twig = [at, at.clone().addScaledVector(td, tl * 0.55).add(V(0, 0.012, 0)), at.clone().addScaledVector(td, tl)];
        tubes.push(taperedTube(twig, 0.005, 0.0022, 6, 5));
        leavesAlong(new THREE.CatmullRomCurve3(twig), 5, leaves, r, silver, [0.045, 0.065], 0.2);
      }
    });
    return { wood: mergeGeometries(tubes)!, leaves, geo: blade(0.12) };
  }, []);
  return (
    <group position={[2.8, 0, 2.8]}>
      <Pot r={0.21} h={0.44} color="#3b3e43" rough={0.85} />
      <mesh geometry={wood} castShadow receiveShadow material={m.bark} />
      <Instances geometry={geo} material={m.leaf} items={leaves} />
    </group>
  );
}

// ---------------------------------------------------------------- a fiddle-leaf fig by the left window
export function FiddleLeafFig() {
  const m = useMemo(() => ({
    trunk: new THREE.MeshStandardMaterial({ color: "#6b5a46", roughness: 0.85 }),
    leaf: twoTone(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.32, side: THREE.DoubleSide }), [1.25, 1.3, 1.15]),
  }), []);
  const { wood, leaves, geo } = useMemo(() => {
    const r = rng(17), leaves: Item[] = [];
    const pts = [V(0, 0.3, 0), V(0.05, 0.72, -0.02), V(-0.03, 1.18, 0.04), V(0.02, 1.64, 0)];
    const curve = new THREE.CatmullRomCurve3(pts);
    for (let i = 0; i < 24; i++) {
      const u = 0.32 + (i / 23) * 0.68, at = curve.getPointAt(u), a = i * 2.4 + r() * 0.3, out = V(Math.cos(a), 0, Math.sin(a));
      // the big leaves lower down hold out and droop; the young ones at the top stand up
      const dir = out.clone().multiplyScalar(0.8).add(V(0, -0.1 + u * 1.1, 0));
      leaves.push({
        m: leafMatrix(at.clone().addScaledVector(out, 0.025), dir, 0.2 + (1 - u) * 0.1 + r() * 0.06, (r() - 0.5) * 0.5),
        c: new THREE.Color("#2f5b35").offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.06 + (u - 0.5) * 0.06),
      });
    }
    return { wood: taperedTube(pts, 0.022, 0.011, 16, 7), leaves, geo: fiddleLeaf() };
  }, []);
  return (
    <group position={[-2.85, 0, -0.1]}>
      <Pot r={0.18} h={0.36} color="#e9e3d8" />
      <mesh geometry={wood} castShadow material={m.trunk} />
      <Instances geometry={geo} material={m.leaf} items={leaves} />
    </group>
  );
}

// ---------------------------------------------------------------- a monstera by the desk
export function Monstera() {
  const leafGeo = useMemo(monsteraLeaf, []);
  const m = useMemo(() => ({
    leaf: twoTone(new THREE.MeshStandardMaterial({ color: "#2f6a3c", roughness: 0.45, side: THREE.DoubleSide }), [1.2, 1.25, 1.1]),
    stem: new THREE.MeshStandardMaterial({ color: "#4f7a3c", roughness: 0.6 }),
  }), []);
  // long stems arch out of the pot; each leaf hangs from its stem's end, tipped outward
  const { stems, leaves } = useMemo(() => {
    const r = rng(12), tubes: THREE.BufferGeometry[] = [], leaves: Item[] = [];
    for (let i = 0; i < 9; i++) {
      const yaw = (i / 9) * Math.PI * 2 + r() * 0.5, up = 0.55 + r() * 0.65, out = V(Math.sin(yaw), 0, Math.cos(yaw));
      const base = V(0, 0.3, 0).addScaledVector(out, 0.03);
      const tip = V(0, 0.35 + up * 0.55, 0).addScaledVector(out, up * 0.45);
      const mid = base.clone().lerp(tip, 0.5).add(V(0, 0.12, 0)).addScaledVector(out, -0.04);
      tubes.push(taperedTube([base, mid, tip], 0.009, 0.006, 10, 6));
      leaves.push({ m: leafMatrix(tip, out.clone().multiplyScalar(0.9).add(V(0, 0.2 - r() * 0.5, 0)), 0.32 + r() * 0.18, (r() - 0.5) * 0.4) });
    }
    return { stems: mergeGeometries(tubes)!, leaves };
  }, []);
  return (
    <group position={[-2.2, 0, -1.75]}>
      <Pot r={0.19} h={0.34} color="#f0ece4" rough={0.35} />
      <mesh geometry={stems} castShadow material={m.stem} />
      <Instances geometry={leafGeo} material={m.leaf} items={leaves} />
    </group>
  );
}

// ---------------------------------------------------------------- a rubber plant in the front-right corner
export function RubberPlant() {
  const m = useMemo(() => ({
    stem: new THREE.MeshStandardMaterial({ color: "#5c4a35", roughness: 0.8 }),
    leaf: twoTone(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.22, side: THREE.DoubleSide }), [1.6, 1.2, 1.2]),
  }), []);
  // three stems that curve up and out, glossy dark oval leaves turning round each
  const { stems, leaves, geo } = useMemo(() => {
    const r = rng(52), tubes: THREE.BufferGeometry[] = [], leaves: Item[] = [];
    const greens = ["#24402a", "#2c4a31", "#203a26"].map((h) => new THREE.Color(h));
    [[0.04, 1.25, 0.03, 0.1], [-0.18, 1.0, 0.1, -0.2], [0.16, 0.85, -0.12, 0.15]].forEach(([dx, h, dz, bend], k) => {
      const pts = [V(0, 0.28, 0), V(dx * 0.4, 0.28 + (h - 0.28) * 0.45, dz * 0.4), V(dx + bend * 0.2, h, dz)];
      tubes.push(taperedTube(pts, 0.016 - k * 0.003, 0.008, 12, 6));
      const curve = new THREE.CatmullRomCurve3(pts), n = 9 - k * 2;
      for (let i = 0; i < n; i++) {
        const u = 0.35 + (i / (n - 1)) * 0.65, a = i * 2.3 + k;
        leaves.push({ m: leafMatrix(curve.getPointAt(u), V(Math.cos(a) * 0.85, 0.35 + u * 0.5, Math.sin(a) * 0.85), 0.17 + r() * 0.06, (r() - 0.5) * 0.5), c: pick(r, greens) });
      }
    });
    return { stems: mergeGeometries(tubes)!, leaves, geo: ovalLeaf() };
  }, []);
  return (
    <group position={[2.5, 0, -1.95]}>
      <Pot r={0.17} h={0.32} color="#b8663f" rough={0.85} />
      <mesh geometry={stems} castShadow material={m.stem} />
      <Instances geometry={geo} material={m.leaf} items={leaves} />
    </group>
  );
}
