"use client";
import { useMemo } from "react";
import * as THREE from "three";
import { solid } from "../lib/interact";
import { rng, woodTexture } from "../lib/textures";
import { OAK, ROOM } from "./Room";

export const DESK_Y = 0.74;
/** a long built-in desk under the big window */
export const DESK = { x0: -1.5, x1: 1.5, z0: ROOM.z0 + 0.01, z1: -1.6 };
const ZC = (DESK.z0 + DESK.z1) / 2;

const BOOK_COLORS = ["#efe9dc", "#3d5a78", "#c7773d", "#2e3742", "#a4b49a", "#d8b45c", "#7b4636", "#e3d2b8", "#55707a", "#8a9a5b"];

/** a stack of books lying flat; the spine faces -x, the page edges show on the other three sides */
function Books({ seed, x, z, n, rot = 0, children }: { seed: number; x: number; z: number; n: number; rot?: number; children?: (top: number) => React.ReactNode }) {
  const { books, top } = useMemo(() => {
    const r = rng(seed);
    let y = 0;
    const books = Array.from({ length: n }, () => {
      const w = 0.15 + r() * 0.07, d = 0.21 + r() * 0.06, h = 0.018 + r() * 0.026;
      const b = { y: y + h / 2, w, d, h, rot: (r() - 0.5) * 0.22, color: BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)] };
      y += h;
      return b;
    });
    return { books, top: y };
  }, [seed, n]);
  const mats = useMemo(() => {
    const pages = new THREE.MeshStandardMaterial({ color: "#f1ead9", roughness: 0.9 });
    return books.map((b) => {
      const cover = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.75 });
      return [pages, cover, cover, cover, pages, pages];
    });
  }, [books]);
  return (
    <group position={[x, DESK_Y, z]} rotation-y={rot}>
      {books.map((b, i) => (
        <mesh key={i} position={[0, b.y, 0]} rotation-y={b.rot} castShadow receiveShadow material={mats[i]}>
          <boxGeometry args={[b.w, b.h, b.d]} />
        </mesh>
      ))}
      {children?.(top)}
    </group>
  );
}

function Glasses() {
  const m = useMemo(() => ({
    frame: new THREE.MeshStandardMaterial({ color: "#2b211b", roughness: 0.35 }),
    lens: new THREE.MeshStandardMaterial({ color: "#dfeaf2", transparent: true, opacity: 0.18, roughness: 0.05 }),
  }), []);
  return (
    <group rotation-y={0.5}>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.028, 0.012, 0]} rotation-x={-Math.PI / 2 + 0.25}>
          <mesh material={m.frame}><torusGeometry args={[0.022, 0.0022, 6, 28]} /></mesh>
          <mesh material={m.lens}><circleGeometry args={[0.021, 24]} /></mesh>
        </group>
      ))}
      <mesh position={[0, 0.016, -0.002]} rotation-x={-Math.PI / 2 + 0.25} material={m.frame}><torusGeometry args={[0.008, 0.002, 6, 12, Math.PI]} /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.05, 0.004, -0.045]} rotation-y={s * 0.08} material={m.frame}><boxGeometry args={[0.003, 0.003, 0.09]} /></mesh>
      ))}
    </group>
  );
}

function PencilCup() {
  const m = useMemo(() => ({
    cup: new THREE.MeshStandardMaterial({ color: "#e7e1d4", roughness: 0.45, side: THREE.DoubleSide }),
    wood: new THREE.MeshStandardMaterial({ color: "#e2c08c", roughness: 0.6 }),
    leads: ["#e8b830", "#3e6fa3", "#c4492f", "#e8b830", "#4f8a55"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 })),
  }), []);
  const pencils = [[-0.012, 0.01, 0.12, 0.3], [0.014, -0.006, -0.16, 0.9], [0.0, 0.016, 0.06, 1.7], [-0.016, -0.012, -0.08, 2.6], [0.016, 0.014, 0.18, 4]];
  return (
    <group position={[1.3, DESK_Y, -2.12]}>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow material={m.cup}><cylinderGeometry args={[0.036, 0.032, 0.1, 24, 1, true]} /></mesh>
      <mesh position={[0, 0.004, 0]} material={m.cup}><cylinderGeometry args={[0.032, 0.032, 0.008, 24]} /></mesh>
      {pencils.map(([x, z, tilt, yaw], i) => (
        <group key={i} position={[x, 0.01, z]} rotation={[tilt, yaw, tilt * 0.6]}>
          <mesh position={[0, 0.085, 0]} castShadow material={m.leads[i]}><cylinderGeometry args={[0.0036, 0.0036, 0.17, 6]} /></mesh>
          <mesh position={[0, 0.177, 0]} material={m.wood}><coneGeometry args={[0.0036, 0.014, 6]} /></mesh>
        </group>
      ))}
    </group>
  );
}

function Notebook() {
  const m = useMemo(() => ({
    cover: new THREE.MeshStandardMaterial({ color: "#3f5b4d", roughness: 0.8 }),
    pages: new THREE.MeshStandardMaterial({ color: "#f5efe2", roughness: 0.9 }),
    ink: new THREE.MeshStandardMaterial({ color: "#c9d3dc", roughness: 0.9 }),
    pen: new THREE.MeshStandardMaterial({ color: "#20252b", roughness: 0.3, metalness: 0.3 }),
  }), []);
  return (
    <group position={[-0.36, DESK_Y, -1.8]} rotation-y={0.18}>
      <mesh position={[0, 0.002, 0]} receiveShadow material={m.cover}><boxGeometry args={[0.31, 0.004, 0.215]} /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.076, 0.007, 0]} rotation-z={-s * 0.035} receiveShadow material={m.pages}><boxGeometry args={[0.148, 0.006, 0.205]} /></mesh>
      ))}
      {/* a few lines of writing */}
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <mesh key={k} position={[-0.08 + (k % 2) * 0.012, 0.0105, -0.07 + k * 0.024]} rotation-x={-Math.PI / 2} material={m.ink}>
          <planeGeometry args={[0.1 - (k % 3) * 0.02, 0.0025]} />
        </mesh>
      ))}
      <mesh position={[0.07, 0.014, 0.01]} rotation={[Math.PI / 2, 0, 0.5]} castShadow material={m.pen}><cylinderGeometry args={[0.0042, 0.0042, 0.14, 10]} /></mesh>
    </group>
  );
}

function leafBlade() {
  const s = new THREE.Shape();
  s.moveTo(-0.012, 0);
  s.bezierCurveTo(-0.02, 0.08, -0.012, 0.16, 0, 0.22);
  s.bezierCurveTo(0.012, 0.16, 0.02, 0.08, 0.012, 0);
  return new THREE.ShapeGeometry(s, 8);
}

/** a snake plant in a small pot, at the back of the desk */
function SnakePlant() {
  const blade = useMemo(leafBlade, []);
  const m = useMemo(() => ({
    pot: new THREE.MeshStandardMaterial({ color: "#efe9df", roughness: 0.4 }),
    soil: new THREE.MeshStandardMaterial({ color: "#3a2a1e", roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: "#3f6b3e", roughness: 0.6, side: THREE.DoubleSide }),
    edge: new THREE.MeshStandardMaterial({ color: "#a9b25a", roughness: 0.6, side: THREE.DoubleSide }),
  }), []);
  const leaves = useMemo(() => {
    const r = rng(31);
    return Array.from({ length: 7 }, (_, i) => ({ yaw: (i / 7) * Math.PI * 2 + r() * 0.4, tilt: 0.08 + r() * 0.22, s: 0.75 + r() * 0.5, edge: r() < 0.3 }));
  }, []);
  return (
    <group position={[-1.02, DESK_Y, -2.14]}>
      <mesh position={[0, 0.055, 0]} castShadow receiveShadow material={m.pot}><cylinderGeometry args={[0.055, 0.045, 0.11, 24]} /></mesh>
      <mesh position={[0, 0.108, 0]} material={m.soil}><cylinderGeometry args={[0.05, 0.05, 0.006, 20]} /></mesh>
      {leaves.map((l, i) => (
        <mesh key={i} geometry={blade} position={[0, 0.1, 0]} rotation={[l.tilt, l.yaw, 0]} scale={[1, l.s, 1]} castShadow material={l.edge ? m.edge : m.leaf} />
      ))}
    </group>
  );
}

export default function Desk() {
  const m = useMemo(() => ({
    top: new THREE.MeshStandardMaterial({ map: woodTexture(4, OAK, [2.2, 1]), roughness: 0.45 }),
    side: new THREE.MeshStandardMaterial({ map: woodTexture(5, "#cda06b", [0.4, 1]), roughness: 0.5 }),
    knob: new THREE.MeshStandardMaterial({ color: "#2b2b2b", roughness: 0.4, metalness: 0.5 }),
  }), []);
  const w = DESK.x1 - DESK.x0, d = DESK.z1 - DESK.z0, legH = DESK_Y - 0.04;
  return (
    <group>
      <mesh position={[(DESK.x0 + DESK.x1) / 2, DESK_Y - 0.02, ZC]} castShadow receiveShadow material={m.top} {...solid}>
        <boxGeometry args={[w, 0.04, d]} />
      </mesh>
      {/* drawers at the left end, a panel at the right */}
      <group position={[DESK.x0 + 0.26, 0, ZC + 0.015]}>
        <mesh position={[0, legH / 2, 0]} castShadow receiveShadow material={m.side}><boxGeometry args={[0.48, legH, d - 0.03]} /></mesh>
        {[0, 1, 2].map((k) => (
          <group key={k} position={[0, 0.12 + k * 0.22, (d - 0.03) / 2]}>
            <mesh position={[0, 0, 0.006]} castShadow material={m.top}><boxGeometry args={[0.45, 0.2, 0.012]} /></mesh>
            <mesh position={[0, 0.05, 0.018]} rotation-z={Math.PI / 2} material={m.knob}><cylinderGeometry args={[0.005, 0.005, 0.12, 8]} /></mesh>
          </group>
        ))}
      </group>
      <mesh position={[DESK.x1 - 0.02, legH / 2, ZC]} castShadow receiveShadow material={m.side}><boxGeometry args={[0.036, legH, d - 0.02]} /></mesh>

      <Books seed={3} x={-1.27} z={-2.06} n={5} rot={0.2} />
      <Books seed={9} x={1.04} z={-2.07} n={3} rot={-0.3}>{(top) => <group position={[0, top, 0]}><Glasses /></group>}</Books>
      <Books seed={17} x={1.3} z={-1.82} n={2} rot={0.6} />
      <Notebook />
      <PencilCup />
      <SnakePlant />
    </group>
  );
}
