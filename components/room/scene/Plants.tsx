"use client";
import { useMemo } from "react";
import * as THREE from "three";
import { canvasTexture, rng } from "../lib/textures";
import { DESK_Y } from "./Desk";
import { ROOM, WIN } from "./Room";

// More green in the room: an olive tree and a fiddle-leaf fig, tulips on the desk, pots of flowers along the side
// windows, and a tall vase of blossom. Leaves and petals are instanced, so there can be a lot of them.

type Item = { m: THREE.Matrix4; c?: THREE.Color };
const o = new THREE.Object3D();
/** a matrix from a position, a rotation and a scale */
function place(p: THREE.Vector3Like, r: [number, number, number], s: number | [number, number, number]) {
  o.position.set(p.x, p.y, p.z);
  o.rotation.set(r[0], r[1], r[2]);
  if (typeof s === "number") o.scale.setScalar(s);
  else o.scale.set(...s);
  o.updateMatrix();
  return o.matrix.clone();
}

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

/** a stick between two points: a trunk, a branch, a stem */
function Stick({ a, b, r, material }: { a: THREE.Vector3; b: THREE.Vector3; r: number; material: THREE.Material }) {
  const d = b.clone().sub(a);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  return (
    <mesh position={a.clone().add(b).multiplyScalar(0.5)} quaternion={q} castShadow material={material}>
      <cylinderGeometry args={[r * 0.75, r, d.length(), 8]} />
    </mesh>
  );
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

// ---------------------------------------------------------------- leaves and petals
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

/** a tulip's cup */
function tulipCup() {
  const pts = [[0, 0], [0.012, 0.003], [0.021, 0.013], [0.025, 0.03], [0.023, 0.047], [0.017, 0.058]].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 14);
}

/** a daisy from above: white petals round a yellow eye, on a transparent square */
function daisyTexture() {
  return canvasTexture(128, 128, (ctx, w) => {
    const c = w / 2;
    ctx.fillStyle = "#fbfaf6";
    for (let i = 0; i < 14; i++) {
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate((i / 14) * Math.PI * 2);
      ctx.beginPath();
      ctx.ellipse(0, -34, 9, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = "#f0b83a";
    ctx.beginPath();
    ctx.arc(c, c, 15, 0, Math.PI * 2);
    ctx.fill();
  }).texture;
}

const LEAF_GREENS = ["#3f6b3e", "#4f7f45", "#365f39", "#5a8a4c"].map((h) => new THREE.Color(h));
const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];

// ---------------------------------------------------------------- an olive tree in the back-right corner
export function OliveTree() {
  const m = useMemo(() => ({
    bark: new THREE.MeshStandardMaterial({ color: "#6e6355", roughness: 0.9 }),
    leaf: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.6, side: THREE.DoubleSide }),
  }), []);
  const { branches, leaves, geo } = useMemo(() => {
    const r = rng(91), fork = new THREE.Vector3(0.03, 1.12, 0.02);
    const tips = [new THREE.Vector3(-0.2, 1.62, 0.08), new THREE.Vector3(0.2, 1.75, -0.1), new THREE.Vector3(0.02, 1.98, 0.14), new THREE.Vector3(0.12, 1.4, -0.16)];
    const silver = ["#8a9a78", "#76896a", "#9aa88a", "#6c7f62"].map((h) => new THREE.Color(h));
    const leaves: Item[] = [];
    tips.forEach((t, k) => {
      const rad = k === 3 ? 0.17 : 0.27;
      for (let i = 0; i < (k === 3 ? 110 : 210); i++) {
        const u = r() * Math.PI * 2, v = Math.acos(2 * r() - 1), s = Math.cbrt(r());
        const p = new THREE.Vector3(Math.sin(v) * Math.cos(u), Math.cos(v) * 0.75, Math.sin(v) * Math.sin(u)).multiplyScalar(rad * s).add(t);
        leaves.push({ m: place(p, [r() * 6.3, r() * 6.3, r() * 6.3], 0.055 + r() * 0.025), c: pick(r, silver).clone().offsetHSL(0, 0, (r() - 0.5) * 0.06) });
      }
    });
    return { branches: tips.map((t) => [fork, t] as const), leaves, geo: blade(0.13) };
  }, []);
  return (
    <group position={[2.0, 0, 2.0]}>
      <Pot r={0.21} h={0.44} color="#3b3e43" rough={0.85} />
      <Stick a={new THREE.Vector3(0, 0.4, 0)} b={new THREE.Vector3(-0.02, 0.8, 0.01)} r={0.03} material={m.bark} />
      <Stick a={new THREE.Vector3(-0.02, 0.8, 0.01)} b={new THREE.Vector3(0.03, 1.12, 0.02)} r={0.026} material={m.bark} />
      {branches.map(([a, b], i) => <Stick key={i} a={a} b={b} r={0.014} material={m.bark} />)}
      <Instances geometry={geo} material={m.leaf} items={leaves} />
    </group>
  );
}

// ---------------------------------------------------------------- a fiddle-leaf fig by the left window
export function FiddleLeafFig() {
  const m = useMemo(() => ({
    trunk: new THREE.MeshStandardMaterial({ color: "#6b5a46", roughness: 0.85 }),
    leaf: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.35, side: THREE.DoubleSide }),
  }), []);
  const { leaves, geo } = useMemo(() => {
    const r = rng(17), leaves: Item[] = [];
    for (let i = 0; i < 26; i++) {
      const y = 0.72 + (i / 26) * 0.95, a = i * 2.4, len = 0.22 + r() * 0.12;
      const p = new THREE.Vector3(Math.cos(a) * 0.03, y, Math.sin(a) * 0.03);
      o.position.copy(p);
      o.rotation.set(0, -a + Math.PI / 2, 0);
      o.rotateX(0.55 + r() * 0.5);
      o.scale.setScalar(len);
      o.updateMatrix();
      leaves.push({ m: o.matrix.clone(), c: new THREE.Color("#2f5b35").offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.06) });
    }
    return { leaves, geo: fiddleLeaf() };
  }, []);
  return (
    <group position={[-1.98, 0, -0.2]}>
      <Pot r={0.18} h={0.36} color="#e9e3d8" />
      <Stick a={new THREE.Vector3(0, 0.33, 0)} b={new THREE.Vector3(0.02, 1.0, -0.01)} r={0.02} material={m.trunk} />
      <Stick a={new THREE.Vector3(0.02, 1.0, -0.01)} b={new THREE.Vector3(-0.01, 1.66, 0.02)} r={0.016} material={m.trunk} />
      <Instances geometry={geo} material={m.leaf} items={leaves} />
    </group>
  );
}

// ---------------------------------------------------------------- flowers on stems, for the vases
const TULIP_COLORS = ["#f08aa2", "#e9607e", "#f4a08b", "#f7c6d0", "#fbe3a0"].map((h) => new THREE.Color(h));
const stemMat = new THREE.MeshStandardMaterial({ color: "#4f7f3c", roughness: 0.6 });
const petalMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.55, side: THREE.DoubleSide });

/** a few tulips standing in a vase: stems splaying from `at`, a cup on each, and some leaves */
export function Tulips({ at = [0, 0, 0], n = 6, height = 0.3, seed = 1 }: { at?: [number, number, number]; n?: number; height?: number; seed?: number }) {
  const cup = useMemo(tulipCup, []), leaf = useMemo(() => blade(0.1), []);
  const { stems, cups, leaves } = useMemo(() => {
    const r = rng(seed), stems: [THREE.Vector3, THREE.Vector3][] = [], cups: Item[] = [], leaves: Item[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.6, lean = 0.12 + r() * 0.16, h = height * (0.85 + r() * 0.25);
      const top = new THREE.Vector3(Math.sin(lean) * Math.cos(a) * h, Math.cos(lean) * h, Math.sin(lean) * Math.sin(a) * h);
      stems.push([new THREE.Vector3(0, 0, 0), top]);
      cups.push({ m: place(top, [Math.sin(a) * lean, 0, -Math.cos(a) * lean], 1 + r() * 0.25), c: pick(r, TULIP_COLORS) });
    }
    for (let i = 0; i < 3; i++) {
      const a = r() * Math.PI * 2;
      o.position.set(0, height * 0.35, 0);
      o.rotation.set(0, a, 0);
      o.rotateX(0.6 + r() * 0.4);
      o.scale.set(0.18, 0.18 + r() * 0.06, 0.18);
      o.updateMatrix();
      leaves.push({ m: o.matrix.clone(), c: LEAF_GREENS[1] });
    }
    return { stems, cups, leaves };
  }, [n, height, seed]);
  return (
    <group position={at}>
      {stems.map(([a, b], i) => <Stick key={i} a={a} b={b} r={0.0028} material={stemMat} />)}
      <Instances geometry={cup} material={petalMat} items={cups} />
      <Instances geometry={leaf} material={petalMat} items={leaves} />
    </group>
  );
}

/** tulips in a glass of water at the left end of the desk */
export function DeskTulips() {
  const m = useMemo(() => ({
    glass: new THREE.MeshStandardMaterial({ color: "#eef6f8", transparent: true, opacity: 0.22, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }),
    water: new THREE.MeshStandardMaterial({ color: "#cfe6ec", transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false }),
  }), []);
  return (
    <group position={[-1.13, DESK_Y, -1.8]}>
      <mesh position={[0, 0.08, 0]} material={m.glass}><cylinderGeometry args={[0.045, 0.04, 0.16, 28, 1, true]} /></mesh>
      <mesh position={[0, 0.05, 0]} material={m.water}><cylinderGeometry args={[0.042, 0.039, 0.1, 28]} /></mesh>
      <Tulips at={[0, 0.02, 0]} n={7} height={0.32} seed={4} />
    </group>
  );
}

// ---------------------------------------------------------------- pots of flowers along the side windows
type Kind = "geranium" | "lavender" | "daisy";
function SillPot({ kind, seed }: { kind: Kind; seed: number }) {
  const daisy = useMemo(() => new THREE.MeshStandardMaterial({ map: daisyTexture(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7 }), []);
  const round = useMemo(() => new THREE.CircleGeometry(1, 12), []);
  const bud = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const spike = useMemo(() => new THREE.SphereGeometry(1, 8, 6), []);
  const square = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const parts = useMemo(() => {
    const r = rng(seed), stems: [THREE.Vector3, THREE.Vector3][] = [], greens: Item[] = [], blooms: Item[] = [], heads: Item[] = [];
    const n = kind === "lavender" ? 16 : kind === "daisy" ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, lean = r() * 0.35, h = (kind === "lavender" ? 0.16 : 0.11) + r() * 0.06;
      const base = new THREE.Vector3(Math.cos(a) * 0.015, 0.08, Math.sin(a) * 0.015);
      const top = base.clone().add(new THREE.Vector3(Math.sin(lean) * Math.cos(a) * h, Math.cos(lean) * h, Math.sin(lean) * Math.sin(a) * h));
      stems.push([base, top]);
      if (kind === "geranium") for (let k = 0; k < 9; k++) blooms.push({ m: place(top.clone().add(new THREE.Vector3((r() - 0.5) * 0.04, (r() - 0.3) * 0.025, (r() - 0.5) * 0.04)), [0, 0, 0], 0.008 + r() * 0.004), c: new THREE.Color(r() < 0.5 ? "#d8434b" : "#ef6f7f") });
      if (kind === "lavender") blooms.push({ m: place(top, [Math.sin(a) * lean, 0, -Math.cos(a) * lean], [0.006, 0.026, 0.006]), c: new THREE.Color(r() < 0.5 ? "#8e7cc3" : "#a28fd4") });
      if (kind === "daisy") heads.push({ m: place(top, [-Math.PI / 2 + 0.5 * (r() - 0.5), 0, r() * 6], 0.022 + r() * 0.006) });
    }
    // a low skirt of leaves round the rim
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      greens.push({ m: place(new THREE.Vector3(Math.cos(a) * 0.032, 0.09, Math.sin(a) * 0.032), [-Math.PI / 2 + 0.6, 0, a], kind === "geranium" ? 0.024 : 0.015), c: pick(r, LEAF_GREENS) });
    }
    return { stems, greens, blooms, heads };
  }, [kind, seed]);
  return (
    <group>
      <Pot r={0.042} h={0.085} color="#c27a52" rough={0.85} />
      {parts.stems.map(([a, b], i) => <Stick key={i} a={a} b={b} r={0.0022} material={stemMat} />)}
      <Instances geometry={round} material={petalMat} items={parts.greens} />
      {parts.blooms.length > 0 && <Instances geometry={kind === "lavender" ? spike : bud} material={petalMat} items={parts.blooms} />}
      {parts.heads.length > 0 && <Instances geometry={square} material={daisy} items={parts.heads} />}
    </group>
  );
}

const SILL_Y = WIN.sideY0 + 0.024;
const SILL: { x: number; z: number; kind: Kind }[] = [
  { x: ROOM.x0 - 0.008, z: -1.45, kind: "lavender" }, { x: ROOM.x0 - 0.008, z: -0.95, kind: "geranium" },
  { x: ROOM.x1 + 0.008, z: -1.2, kind: "daisy" }, { x: ROOM.x1 + 0.008, z: -0.6, kind: "lavender" }, { x: ROOM.x1 + 0.008, z: 0, kind: "geranium" },
];
export function SillFlowers() {
  return <>{SILL.map((s, i) => <group key={i} position={[s.x, SILL_Y, s.z]}><SillPot kind={s.kind} seed={30 + i} /></group>)}</>;
}

// ---------------------------------------------------------------- blossom branches in a tall vase, by the left window
export function BlossomVase() {
  const m = useMemo(() => ({
    vase: new THREE.MeshStandardMaterial({ color: "#efeae2", roughness: 0.5 }),
    branch: new THREE.MeshStandardMaterial({ color: "#4a3a30", roughness: 0.85 }),
  }), []);
  const vase = useMemo(() => new THREE.LatheGeometry([[0, 0], [0.1, 0.01], [0.11, 0.18], [0.085, 0.4], [0.05, 0.5], [0.055, 0.53], [0.05, 0.535]].map(([x, y]) => new THREE.Vector2(x, y)), 32), []);
  const { tubes, blooms, bud } = useMemo(() => {
    const r = rng(63), tubes: THREE.TubeGeometry[] = [], blooms: Item[] = [];
    const pinks = ["#f7c5d0", "#f3a7b8", "#fde4ea", "#ffffff", "#f6b4c4"].map((h) => new THREE.Color(h));
    const ends = [[-0.18, 1.55, -0.12], [0.16, 1.45, -0.18], [-0.05, 1.7, 0.04], [0.24, 1.25, 0.08]];
    ends.forEach(([x, y, z]) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.45, 0), new THREE.Vector3(x * 0.3, 0.8, z * 0.3), new THREE.Vector3(x * 0.75 + (r() - 0.5) * 0.05, y - 0.3, z * 0.75), new THREE.Vector3(x, y, z),
      ]);
      tubes.push(new THREE.TubeGeometry(curve, 24, 0.006, 6, false));
      for (let t = 0.4; t <= 1; t += 0.06) {
        const c = curve.getPointAt(t);
        for (let k = 0; k < 4; k++) {
          blooms.push({ m: place(c.clone().add(new THREE.Vector3((r() - 0.5) * 0.07, (r() - 0.5) * 0.05, (r() - 0.5) * 0.07)), [r() * 6, r() * 6, 0], 0.012 + r() * 0.01), c: pick(r, pinks) });
        }
      }
    });
    return { tubes, blooms, bud: new THREE.IcosahedronGeometry(1, 1) };
  }, []);
  return (
    <group position={[-2.06, 0, 0.5]}>
      <mesh geometry={vase} castShadow receiveShadow material={m.vase} />
      {tubes.map((g, i) => <mesh key={i} geometry={g} castShadow material={m.branch} />)}
      <Instances geometry={bud} material={petalMat} items={blooms} />
    </group>
  );
}
