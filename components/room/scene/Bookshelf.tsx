"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { allSkills } from "@/content/profile";
import { registerStation } from "../camera/stations";
import { clickable } from "../lib/interact";
import { canvasTexture, FONT, fontsReady, rng, woodTexture } from "../lib/textures";
import { useRoom } from "../store";
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

type Book = { i: number; name: string; x: number; y: number; w: number; h: number; d: number; color: string; ink: string; tilt: number };

function layoutBooks(): Book[] {
  const r = rng(101), books: Book[] = [];
  ROWS.forEach((groups, row) => {
    let x = -WIDTH / 2 + 0.035;
    groups.forEach((g, gi) => {
      if (gi) x += 0.035;
      allSkills.forEach((s, i) => {
        if (s.group !== g) return;
        const w = 0.03 + r() * 0.022, h = 0.24 + r() * 0.09, d = 0.17 + r() * 0.06;
        const color = COLORS[Math.floor(r() * COLORS.length)];
        const light = ["#cbbd9f", "#e0d7c3", "#b8892d"].includes(color);
        books.push({ i, name: s.name, x: x + w / 2, y: BOARDS[row] + 0.0125 + h / 2, w, h, d, color, ink: light ? "#1d1a16" : "#efe6d2", tilt: 0 });
        x += w + 0.003;
      });
    });
    // the last book of a row leans on the side if there's room
    const last = books[books.length - 1];
    if (last && x < WIDTH / 2 - 0.12) last.tilt = -0.12;
  });
  return books;
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
      wood: new THREE.MeshStandardMaterial({ map: woodTexture(17, "#6b4429", [1, 1]), roughness: 0.55 }),
      back: new THREE.MeshStandardMaterial({ color: "#3b2a1e", roughness: 0.8 }),
      books: books.map((b, k) => {
        const cover = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.7 });
        const spine = new THREE.MeshStandardMaterial({ map: spines[k].texture, roughness: 0.65 });
        return [cover, cover, pages, pages, spine, cover];
      }),
      helmet: new THREE.MeshStandardMaterial({ color: "#b8322a", roughness: 0.22, metalness: 0.1 }),
      visor: new THREE.MeshStandardMaterial({ color: "#1b1e24", roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 }),
      rim: new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.6 }),
      pot: new THREE.MeshStandardMaterial({ color: "#a65a3a", roughness: 0.8 }),
      green: new THREE.MeshStandardMaterial({ color: "#4f7f3a", roughness: 0.7 }),
    };
  }, [books, spines]);

  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const hovered = useRef(-1);
  const helmet = useRef<THREE.Group>(null);
  const wobble = useRef(0);
  useFrame(({ clock }, dt) => {
    const { stackSel, page } = useRoom.getState();
    books.forEach((b, k) => {
      const o = refs.current[k];
      if (!o) return;
      const sel = page === "stack" && stackSel === b.i, hov = hovered.current === k;
      const z = (DEPTH / 2 - b.d / 2 - 0.01) + (sel ? 0.075 : hov ? 0.02 : 0);
      o.position.z += (z - o.position.z) * Math.min(1, dt * 9);
      o.rotation.y += ((sel ? -0.1 : 0) - o.rotation.y) * Math.min(1, dt * 9);
    });
    if (helmet.current) {
      wobble.current = Math.max(0, wobble.current - dt * 0.7);
      helmet.current.rotation.z = Math.sin(clock.elapsedTime * 14) * 0.06 * wobble.current;
    }
  });

  const top = BOARDS[BOARDS.length - 1] + 0.0125;
  return (
    <group ref={ref} position={[ROOM.x1 - DEPTH / 2, 0, 0.95]} rotation-y={-Math.PI / 2}>
      <group {...clickable("BOOKSHELF · STACK", () => useRoom.getState().go("stack"))}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (WIDTH / 2 - 0.0125), top / 2, 0]} castShadow receiveShadow material={m.wood}>
            <boxGeometry args={[0.025, top, DEPTH]} />
          </mesh>
        ))}
        {BOARDS.map((y) => (
          <mesh key={y} position={[0, y, 0]} castShadow receiveShadow material={m.wood}><boxGeometry args={[WIDTH - 0.05, 0.025, DEPTH]} /></mesh>
        ))}
        <mesh position={[0, top / 2, -DEPTH / 2 + 0.005]} receiveShadow material={m.back}><boxGeometry args={[WIDTH - 0.05, top, 0.01]} /></mesh>
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
            position={[b.x, b.y, DEPTH / 2 - b.d / 2 - 0.01]}
            rotation-z={b.tilt}
            castShadow
            receiveShadow
            material={m.books[k]}
            {...props}
            onPointerOver={(e) => { hovered.current = k; props.onPointerOver(e); }}
            onPointerOut={() => { hovered.current = -1; props.onPointerOut(); }}
          >
            <boxGeometry args={[b.w, b.h, b.d]} />
          </mesh>
        );
      })}

      {/* on top: the helmet for the ride home, and a small cactus */}
      <group
        ref={helmet}
        position={[-0.18, top, 0.02]}
        {...clickable("HELMET · FOR THE RIDE HOME", () => { wobble.current = 1; })}
      >
        <mesh position={[0, 0.005, 0]} scale={[1, 0.92, 1.15]} castShadow material={m.helmet}>
          <sphereGeometry args={[0.125, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh position={[0, 0.006, 0]} rotation-x={Math.PI / 2} scale={[1, 1.15, 1]} material={m.rim}><torusGeometry args={[0.125, 0.008, 8, 40]} /></mesh>
        <mesh position={[0, 0.03, 0.03]} rotation-x={-0.25} scale={[1, 0.9, 1.15]} material={m.visor}>
          <sphereGeometry args={[0.129, 32, 10, -1.1, 2.2, 1.0, 0.45]} />
        </mesh>
      </group>
      <group position={[0.25, top, 0]}>
        <mesh position={[0, 0.04, 0]} castShadow material={m.pot}><cylinderGeometry args={[0.05, 0.04, 0.08, 20]} /></mesh>
        <mesh position={[0, 0.115, 0]} scale={[1, 1.5, 1]} castShadow material={m.green}><sphereGeometry args={[0.04, 16, 12]} /></mesh>
        <mesh position={[0.035, 0.1, 0]} rotation-z={-0.6} scale={[1, 1.4, 1]} castShadow material={m.green}><sphereGeometry args={[0.02, 12, 10]} /></mesh>
      </group>
    </group>
  );
}
