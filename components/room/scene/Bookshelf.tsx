"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { allSkills } from "@/content/profile";
import { registerStation } from "../camera/stations";
import { clickable } from "../lib/interact";
import { canvasTexture, FONT, fontsReady, rng } from "../lib/textures";
import { soft } from "../lib/shapes";
import { useRoom } from "../store";
import { Pothos } from "./Props";
import { ROOM } from "./Room";

// Stack: a bookshelf on the right wall, one book a skill. Local coordinates: x along the wall as the camera sees it,
// y up, z out of the shelf into the room.
const WIDTH = 0.95, DEPTH = 0.3, BOARDS = [0.05, 0.47, 0.89, 1.31, 1.73];
// which shelf each group stands on, bottom to top
const ROWS: string[][] = [
  ["Data & caching", "Cloud & infrastructure"],
  ["Backend", "Messaging"],
  ["Frontend", "Delivery & testing"],
  ["Languages", "AI tools", "Architecture"],
];
const COLORS = ["#7b2d26", "#1f3a5f", "#2e5e4e", "#b8892d", "#3a3a44", "#5d4691", "#cbbd9f", "#8c3b5a", "#2a6f86", "#56682c", "#a4512b", "#e0d7c3"];

type Book = { i: number; name: string; x: number; y: number; w: number; h: number; d: number; color: string; ink: string; tilt: number; push: number };

/** a book w wide and h tall that has slid out at the bottom and leans back (top toward -x) by `a` onto a neighbour
 * whose right face is at xn, hn tall: its bottom corner on the board, its face against the neighbour's top edge (or
 * its own top corner against the neighbour's face, when the neighbour is the taller). Returns its centre, y measured
 * from the board, and how far right it reaches. */
export function leanOn(xn: number, hn: number, w: number, h: number, a: number) {
  const px = xn + Math.min(hn / Math.cos(a), h) * Math.sin(a), c = Math.cos(a), s = Math.sin(a);
  return { x: px + (w / 2) * c - (h / 2) * s, y: (w / 2) * s + (h / 2) * c, right: px + w * c };
}

function layoutBooks(): Book[] {
  const r = rng(101), loose = rng(131), books: Book[] = [];
  ROWS.forEach((groups, row) => {
    const y0 = BOARDS[row] + 0.0125, first = books.length;
    let x = -WIDTH / 2 + 0.035;
    groups.forEach((g, gi) => {
      if (gi) x += 0.035;
      allSkills.forEach((s, i) => {
        if (s.group !== g) return;
        const w = 0.03 + r() * 0.022, h = 0.24 + r() * 0.09, d = 0.17 + r() * 0.06;
        const color = COLORS[Math.floor(r() * COLORS.length)];
        const light = ["#cbbd9f", "#e0d7c3", "#b8892d"].includes(color);
        // not every book is pushed right to the front
        const push = loose() < 0.4 ? loose() * 0.014 : 0;
        books.push({ i, name: s.name, x: x + w / 2, y: y0 + h / 2, w, h, d, color, ink: light ? "#1d1a16" : "#efe6d2", tilt: 0, push });
        x += w + 0.003;
      });
    });
    // with room to spare, the last book of the row has slid out at the bottom and leans back on its neighbour
    if (books.length - first < 2) return;
    const [prev, last] = books.slice(-2), a = 0.16 + loose() * 0.1;
    const at = leanOn(prev.x + prev.w / 2, prev.h, last.w, last.h, a);
    if (at.right < WIDTH / 2 - 0.04) Object.assign(last, { x: at.x, y: y0 + at.y, tilt: a });
  });
  return books;
}

/** a schoolroom globe: pale sea, sandy and green blobs for land */
function globeTexture() {
  return canvasTexture(512, 256, (ctx, w, h) => {
    const r = rng(88);
    ctx.fillStyle = "#9cc3d5";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = r() * w, y = h * (0.2 + r() * 0.6), rad = 10 + r() * 34;
      ctx.fillStyle = r() < 0.5 ? "#c9b98a" : "#9db27a";
      for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        ctx.ellipse(x + (r() - 0.5) * rad * 1.6, y + (r() - 0.5) * rad, rad * (0.4 + r() * 0.5), rad * (0.3 + r() * 0.4), r() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = "rgba(60,80,100,.25)";
    for (let y = 1; y < 6; y++) { ctx.beginPath(); ctx.moveTo(0, (y * h) / 6); ctx.lineTo(w, (y * h) / 6); ctx.stroke(); }
    for (let x = 0; x < 12; x++) { ctx.beginPath(); ctx.moveTo((x * w) / 12, 0); ctx.lineTo((x * w) / 12, h); ctx.stroke(); }
  }).texture;
}

function drawSpine(ctx: CanvasRenderingContext2D, b: Book) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.fillStyle = b.color;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,.07)";
  ctx.fillRect(0, 0, W * 0.3, H);
  ctx.fillStyle = b.ink === "#1d1a16" ? "rgba(60,40,10,.55)" : "rgba(214,178,94,.8)";
  for (const y of [26, 34, H - 38, H - 30]) ctx.fillRect(6, y, W - 12, 3);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = b.ink;
  let s = 34;
  do { ctx.font = `700 ${s}px ${FONT.display()}`; s -= 1; } while (ctx.measureText(b.name.toUpperCase()).width > H - 110 && s > 12);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(b.name.toUpperCase(), 0, 1);
  ctx.restore();
}

export default function Bookshelf() {
  const ref = useRef<THREE.Group>(null);
  useEffect(() => { registerStation("stack", ref.current); return () => registerStation("stack", null); }, []);
  const books = useMemo(layoutBooks, []);
  const spines = useMemo(() => books.map((b) => canvasTexture(64, 400, (ctx) => drawSpine(ctx, b))), [books]);
  useEffect(() => {
    fontsReady().then(() => spines.forEach((t, k) => { drawSpine(t.ctx, books[k]); t.texture.needsUpdate = true; }));
  }, [spines, books]);

  const m = useMemo(() => {
    const pages = new THREE.MeshStandardMaterial({ color: "#e9dfc9", roughness: 0.9 });
    return {
      wood: new THREE.MeshStandardMaterial({ color: "#efeeea", roughness: 0.55 }),
      steel: new THREE.MeshStandardMaterial({ color: "#1f2124", roughness: 0.38, metalness: 0.6 }),
      back: new THREE.MeshStandardMaterial({ color: "#e4e2dd", roughness: 0.85 }),
      books: books.map((b, k) => {
        const cover = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.7 });
        const spine = new THREE.MeshStandardMaterial({ map: spines[k].texture, roughness: 0.65 });
        return [cover, cover, pages, pages, spine, cover];
      }),
      globe: new THREE.MeshStandardMaterial({ map: globeTexture(), roughness: 0.45 }),
      brass: new THREE.MeshStandardMaterial({ color: "#b8925a", roughness: 0.3, metalness: 0.8 }),
    };
  }, [books, spines]);

  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const hovered = useRef(-1);
  const globe = useRef<THREE.Mesh>(null);
  const spin = useRef(0.15);
  useFrame(({ clock }, dt) => {
    const { stackSel, page } = useRoom.getState();
    books.forEach((b, k) => {
      const o = refs.current[k];
      if (!o) return;
      const sel = page === "stack" && stackSel === b.i, hov = hovered.current === k;
      const z = (DEPTH / 2 - b.d / 2 - 0.01 - b.push) + (sel ? 0.075 : hov ? 0.02 : 0);
      o.position.z += (z - o.position.z) * Math.min(1, dt * 9);
      o.rotation.y += ((sel ? -0.1 : 0) - o.rotation.y) * Math.min(1, dt * 9);
    });
    // a spun globe slows back to a lazy turn
    spin.current += (0.15 - spin.current) * Math.min(1, dt * 0.6);
    if (globe.current) globe.current.rotation.y += spin.current * dt;
  });

  const top = BOARDS[BOARDS.length - 1] + 0.0125;
  return (
    <group ref={ref} position={[ROOM.x1 - DEPTH / 2, 0, 1.7]} rotation-y={-Math.PI / 2}>
      <group {...clickable("BOOKSHELF · STACK", () => useRoom.getState().go("stack"))}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (WIDTH / 2 - 0.0125), top / 2, 0]} castShadow receiveShadow material={m.steel}>
            <primitive object={soft(0.025, top, DEPTH)} attach="geometry" />
          </mesh>
        ))}
        {BOARDS.map((y) => (
          <mesh key={y} position={[0, y, 0]} castShadow receiveShadow material={m.wood}><primitive object={soft(WIDTH - 0.05, 0.025, DEPTH)} attach="geometry" /></mesh>
        ))}
        <mesh position={[0, top / 2, -DEPTH / 2 + 0.005]} receiveShadow material={m.back}><primitive object={soft(WIDTH - 0.05, top, 0.01)} attach="geometry" /></mesh>
      </group>

      {books.map((b, k) => {
        const props = clickable(b.name.toUpperCase(), () => {
          const s = useRoom.getState();
          s.selectStack(b.i);
          s.go("stack");
        });
        return (
          <mesh
            key={k}
            ref={(o) => { refs.current[k] = o; }}
            position={[b.x, b.y, DEPTH / 2 - b.d / 2 - 0.01 - b.push]}
            rotation-z={b.tilt}
            castShadow
            receiveShadow
            material={m.books[k]}
            {...props}
            onPointerOver={(e) => { hovered.current = k; props.onPointerOver(e); }}
            onPointerOut={() => { hovered.current = -1; props.onPointerOut(); }}
          >
            <primitive object={soft(b.w, b.h, b.d)} attach="geometry" />
          </mesh>
        );
      })}

      {/* on top: a globe that spins when you give it a push, and a pothos trailing down the front */}
      <group position={[-0.2, top, 0]} {...clickable("GLOBE · GIVE IT A SPIN", () => { spin.current = 9; })}>
        <mesh position={[0, 0.008, 0]} castShadow material={m.brass}><cylinderGeometry args={[0.05, 0.06, 0.016, 24]} /></mesh>
        <mesh position={[0, 0.05, 0]} material={m.brass}><cylinderGeometry args={[0.006, 0.006, 0.07, 8]} /></mesh>
        <group position={[0, 0.17, 0]} rotation-z={0.41}>
          <mesh ref={globe} castShadow material={m.globe}><sphereGeometry args={[0.1, 40, 24]} /></mesh>
          <mesh rotation-y={Math.PI / 2} material={m.brass}><torusGeometry args={[0.108, 0.0035, 6, 48, Math.PI * 1.3]} /></mesh>
        </group>
      </group>
      <Pothos position={[0.24, top, -0.02]} vines={3} length={8} edge={DEPTH / 2 + 0.02} />
    </group>
  );
}

// ---------------------------------------------------------------- the built-in shelves on the back wall
// Decoration for when you turn round: two bays of shelves either side of a middle upright, the books one instanced
// mesh. On each shelf of each bay, a run of books, one thing (a vase, a photo, a box, a pot on a couple of books, or
// just a stack of books lying down), then more books. Local coordinates as for Stack: x along the wall as you face
// it, z out into the room.
const LIB = { x0: ROOM.x0 + 0.08, x1: 0.3, h: 2.3, d: 0.3, boards: 6 };
const LIB_COLORS = ["#f1ece2", "#e9e2d2", "#2f4a6b", "#c4733c", "#20242b", "#a9b8a4", "#d9b55c", "#7b8ea3", "#efe6d2", "#8c4b38", "#5b6f60"];

/** what stands in the gap on a shelf: 0 a vase, 1 a photo, 2 a box, 3 a pot on two books, 4 a stack of books */
type Gap = { x: number; y: number; kind: number; lift: number };

/** a bulging pot with a narrow neck, for the lathe */
const POT = [[0.001, 0], [0.034, 0], [0.04, 0.006], [0.062, 0.045], [0.066, 0.075], [0.055, 0.115], [0.03, 0.15], [0.026, 0.165], [0.031, 0.172], [0.027, 0.174]].map(([x, y]) => new THREE.Vector2(x, y));

export function Library() {
  const W = LIB.x1 - LIB.x0, step = (LIB.h - 0.05) / (LIB.boards - 1);
  const m = useMemo(() => ({
    wood: new THREE.MeshStandardMaterial({ color: "#efeeea", roughness: 0.6 }),
    books: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.75 }),
    vase: new THREE.MeshStandardMaterial({ color: "#f3efe8", roughness: 0.3 }),
    clay: new THREE.MeshStandardMaterial({ color: "#c98a5e", roughness: 0.8 }),
    box: new THREE.MeshStandardMaterial({ color: "#8a9a8a", roughness: 0.8 }),
    frame: new THREE.MeshStandardMaterial({ color: "#2b2b2b", roughness: 0.5 }),
    photo: new THREE.MeshStandardMaterial({ color: "#c9d8e4", roughness: 0.6 }),
  }), []);
  const pot = useMemo(() => new THREE.LatheGeometry(POT, 28), []);

  const { mesh, gaps } = useMemo(() => {
    const r = rng(203), o = new THREE.Object3D(), list: { m: THREE.Matrix4; c: THREE.Color }[] = [], gaps: Gap[] = [];
    const add = (x: number, y: number, z: number, rz: number, ry: number, w: number, h: number, d: number) => {
      o.position.set(x, y, z);
      o.rotation.set(0, ry, rz);
      o.scale.set(w, h, d);
      o.updateMatrix();
      list.push({ m: o.matrix.clone(), c: new THREE.Color(LIB_COLORS[Math.floor(r() * LIB_COLORS.length)]).offsetHSL(0, 0, (r() - 0.5) * 0.06) });
    };
    // most books are pushed to the front, a few sit a little further back
    const front = (d: number) => LIB.d / 2 - d / 2 - 0.012 - (r() < 0.35 ? r() * 0.015 : 0);
    /** upright books from x0 toward x1; now and then the run stops short and its last book leans back on the one before */
    const run = (x0: number, x1: number, y0: number, room: number) => {
      const slack = r() < 0.55 ? 0.1 : 0, books: { x: number; w: number; h: number; d: number }[] = [];
      for (let x = x0; ; ) {
        const w = 0.022 + r() * 0.028, h = Math.min(room, 0.2 + r() * 0.14), d = 0.15 + r() * 0.08;
        if (x + w > x1 - slack) break;
        books.push({ x, w, h, d });
        x += w + 0.002;
      }
      books.forEach((b, k) => {
        if (slack && k > 0 && k === books.length - 1) {
          const p = books[k - 1], a = 0.16 + r() * 0.1, at = leanOn(p.x + p.w, p.h, b.w, b.h, a);
          if (at.right < x1) return add(at.x, y0 + at.y, front(b.d), a, 0, b.w, b.h, b.d);
        }
        add(b.x + b.w / 2, y0 + b.h / 2, front(b.d), 0, 0, b.w, b.h, b.d);
      });
    };
    /** books lying flat, the biggest at the bottom, each a little askew; returns the height of the pile */
    const stack = (xc: number, y0: number, n: number) => {
      const pile = Array.from({ length: n }, () => ({ l: 0.19 + r() * 0.08, t: 0.022 + r() * 0.022, d: 0.15 + r() * 0.07 })).sort((a, b) => b.l - a.l);
      let y = y0;
      for (const b of pile) {
        add(xc + (r() - 0.5) * 0.02, y + b.t / 2, LIB.d / 2 - b.d / 2 - 0.015 - r() * 0.01, 0, (r() - 0.5) * 0.09, b.l, b.t, b.d);
        y += b.t;
      }
      return y - y0;
    };
    for (let row = 0; row < LIB.boards - 1; row++) {
      const y0 = 0.025 + row * step + 0.0125, room = step - 0.045;
      // the bays: between the outer uprights and the middle one
      for (const [a, b] of [[-W / 2 + 0.028, -0.016], [0.016, W / 2 - 0.028]]) {
        const gw = 0.28, g0 = a + 0.22 + r() * (b - a - 0.44 - gw), kind = Math.floor(r() * 5), xc = g0 + gw / 2;
        run(a, g0, y0, room);
        const lift = kind === 3 ? stack(xc, y0, 2) : kind === 4 ? stack(xc, y0, 3 + Math.floor(r() * 3)) : 0;
        gaps.push({ x: xc, y: y0, kind, lift });
        run(g0 + gw, b, y0, room);
      }
    }
    const mesh = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.06), m.books, list.length);
    list.forEach((b, i) => { mesh.setMatrixAt(i, b.m); mesh.setColorAt(i, b.c); });
    mesh.castShadow = mesh.receiveShadow = true;
    return { mesh, gaps };
  }, [W, step, m]);

  // the photo leans back against the wall at the back of the shelf
  const tilt = 0.12, ph = 0.2, back = -LIB.d / 2 + Math.sin(tilt) * ph + 0.012;
  const topBoard = 0.025 + (LIB.boards - 1) * step + 0.0125;
  return (
    <group
      position={[(LIB.x0 + LIB.x1) / 2, 0, ROOM.z1 - LIB.d / 2]}
      rotation-y={Math.PI}
      {...clickable(() => (useRoom.getState().page === "library" ? "SHELVES" : "SHELVES · LOOK CLOSER"), () => useRoom.getState().go("library"))}
    >
      {[-1, 0, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 - 0.0125), LIB.h / 2, 0]} castShadow receiveShadow material={m.wood}><primitive object={soft(0.025, LIB.h, LIB.d)} attach="geometry" /></mesh>
      ))}
      {Array.from({ length: LIB.boards }, (_, i) => (
        <mesh key={i} position={[0, 0.025 + i * step, 0]} castShadow receiveShadow material={m.wood}><primitive object={soft(W, 0.025, LIB.d)} attach="geometry" /></mesh>
      ))}
      <primitive object={mesh} />
      {gaps.map((g, i) => (
        <group key={i} position={[g.x, g.y + g.lift, 0]}>
          {g.kind === 0 && <mesh position={[0, 0.09, 0.02]} castShadow material={m.vase}><cylinderGeometry args={[0.035, 0.05, 0.18, 24]} /></mesh>}
          {g.kind === 1 && (
            <group position={[0, 0, back]} rotation-y={0.12} rotation-x={-tilt}>
              <mesh position={[0, ph / 2, 0]} castShadow material={m.frame}><primitive object={soft(0.16, ph, 0.012)} attach="geometry" /></mesh>
              <mesh position={[0, ph / 2, 0.0065]} material={m.photo}><planeGeometry args={[0.13, 0.17]} /></mesh>
            </group>
          )}
          {g.kind === 2 && <mesh position={[0, 0.07, 0.01]} castShadow material={m.box}><primitive object={soft(0.2, 0.14, 0.2)} attach="geometry" /></mesh>}
          {g.kind === 3 && <mesh geometry={pot} position={[0, 0, 0.03]} castShadow material={m.clay} />}
        </group>
      ))}
      <Pothos position={[-W / 4, topBoard, -0.02]} vines={4} length={9} edge={LIB.d / 2 + 0.02} />
    </group>
  );
}
