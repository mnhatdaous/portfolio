"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
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
function leanOn(xn: number, hn: number, w: number, h: number, a: number) {
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
    <group position={[ROOM.x1 - DEPTH / 2, 0, 1.7]} rotation-y={-Math.PI / 2}>
      {/* the station frames the shelf itself, not the globe and the plant on top, so the camera comes in close */}
      <group ref={ref} {...clickable("BOOKSHELF · STACK", () => useRoom.getState().go("stack"))}>
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
