"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { jobs } from "@/content/profile";
import { registerStation } from "../camera/stations";
import { clickable } from "../lib/interact";
import { canvasTexture, corkTexture, FONT, fontsReady, rng } from "../lib/textures";
import { soft } from "../lib/shapes";
import { useRoom } from "../store";
import { ROOM } from "./Room";

// Work: a cork board on the left wall. A sticky note per job and a polaroid, in two loose rows under the title card.
// Local coordinates: x across the board as the camera sees it, y up, z out of the cork.

type Item = { i: number; x: number; y: number; w: number; h: number; rot: number; label: string };

/** where each job's note goes, in the order of `jobs`: three along the top beside the title, the rest below */
const SPOTS: [number, number][] = [[-0.12, 0.18], [0.11, 0.19], [0.34, 0.175], [-0.25, -0.12], [-0.02, -0.13]];
const NOTE = 0.17;

const ITEMS: Item[] = jobs.map((j, i) => {
  const r = rng(40 + i);
  return { i, x: SPOTS[i][0], y: SPOTS[i][1], w: NOTE, h: NOTE, rot: (r() - 0.5) * 0.12, label: `${j.title.toUpperCase()} · ${j.years}` };
});

/** the pin goes through the note's glue strip, a little below its top edge */
const PIN_INSET = 0.017;
/** the polaroid finishes the lower row */
const POLAROID = { x: 0.25, y: -0.115, w: 0.15, h: 0.176, rot: -0.07 };

function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: string, size: number, family: string, maxW: number) {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${family}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > 12);
}

function drawNote(ctx: CanvasRenderingContext2D, item: Item) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  const j = jobs[item.i];
  ctx.fillStyle = j.note;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "rgba(255,255,255,.12)");
  g.addColorStop(1, "rgba(0,0,0,.12)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(0,0,0,.06)";
  ctx.fillRect(0, 0, W, 34);
  ctx.fillStyle = "rgba(0,0,0,.45)";
  ctx.font = `500 22px ${FONT.mono()}`;
  ctx.fillText(String(item.i + 1).padStart(2, "0"), 18, 64);
  ctx.fillStyle = "#1d1a16";
  fitFont(ctx, j.title, "400", 62, FONT.hand(), W - 34);
  ctx.fillText(j.title, 18, 134);
  ctx.font = `400 30px ${FONT.hand()}`;
  ctx.fillStyle = "rgba(29,26,22,.75)";
  if (j.org) ctx.fillText(j.org, 18, 172);
  ctx.textAlign = "right";
  ctx.font = `400 32px ${FONT.hand()}`;
  ctx.fillStyle = "#1d1a16";
  ctx.fillText(j.years, W - 18, H - 22);
  ctx.textAlign = "left";
}

function drawTitle(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const r = rng(9);
  ctx.fillStyle = "#c7a070";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 1500; i++) { ctx.fillStyle = `rgba(80,50,20,${r() * 0.18})`; ctx.fillRect(r() * w, r() * h, 2, 2); }
  ctx.fillStyle = "#2a1d10";
  ctx.font = `400 92px ${FONT.hand()}`;
  ctx.fillText("Work", 26, 104);
  ctx.font = `400 38px ${FONT.hand()}`;
  ctx.fillText("2018 → now", 30, 160);
}

function drawPolaroid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#f3efe6";
  ctx.fillRect(0, 0, w, h);
  const px = 16, py = 16, pw = w - 32, ph = pw;
  const g = ctx.createLinearGradient(0, py, 0, py + ph);
  g.addColorStop(0, "#1a1236");
  g.addColorStop(0.7, "#5a2a4a");
  g.addColorStop(1, "#c9643a");
  ctx.fillStyle = g;
  ctx.fillRect(px, py, pw, ph);
  const r = rng(77);
  let x = px;
  while (x < px + pw) {
    const bw = 14 + r() * 26, bh = 40 + r() * 120;
    ctx.fillStyle = "#0d0b16";
    ctx.fillRect(x, py + ph - bh, bw, bh);
    for (let k = 0; k < bh / 9; k++) if (r() < 0.35) { ctx.fillStyle = r() < 0.5 ? "#ffd27a" : "#9fd6ff"; ctx.fillRect(x + 3 + r() * (bw - 7), py + ph - bh + 4 + k * 8, 3, 3); }
    x += bw + 1;
  }
  ctx.fillStyle = "#0d0b16";
  ctx.fillRect(px + pw * 0.62, py + ph * 0.18, 12, ph * 0.82);
  ctx.fillStyle = "#ff3b3b";
  ctx.beginPath(); ctx.arc(px + pw * 0.62 + 6, py + ph * 0.17, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#26211a";
  ctx.font = `400 36px ${FONT.hand()}`;
  ctx.fillText("Sài Gòn, 2026", 22, h - 22);
}

export default function CorkBoard() {
  const ref = useRef<THREE.Group>(null);
  useEffect(() => { registerStation("work", ref.current); return () => registerStation("work", null); }, []);

  const tex = useMemo(() => ({
    notes: ITEMS.map((it) => canvasTexture(256, 256, (ctx) => drawNote(ctx, it))),
    title: canvasTexture(300, 200, drawTitle),
    polaroid: canvasTexture(256, 300, drawPolaroid),
  }), []);
  useEffect(() => {
    // the handwriting font may arrive after the first paint
    fontsReady().then(() => {
      tex.notes.forEach((t, i) => { drawNote(t.ctx, ITEMS[i]); t.texture.needsUpdate = true; });
      drawTitle(tex.title.ctx, 300, 200); tex.title.texture.needsUpdate = true;
      drawPolaroid(tex.polaroid.ctx, 256, 300); tex.polaroid.texture.needsUpdate = true;
    });
  }, [tex]);

  const m = useMemo(() => ({
    cork: new THREE.MeshStandardMaterial({ map: corkTexture(), roughness: 0.95 }),
    frame: new THREE.MeshStandardMaterial({ color: "#26282b", roughness: 0.5, metalness: 0.3 }),
    notes: tex.notes.map((t) => new THREE.MeshStandardMaterial({ map: t.texture, roughness: 0.85 })),
    title: new THREE.MeshStandardMaterial({ map: tex.title.texture, roughness: 0.9 }),
    polaroid: new THREE.MeshStandardMaterial({ map: tex.polaroid.texture, roughness: 0.6 }),
    pins: ["#e84545", "#2f7de1", "#f2c230", "#3bb273", "#ffffff"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.1 })),
  }), [tex]);

  // a string of fairy lights along the top of the frame, which is also what lights the board
  const fairy = useMemo(() => {
    const pts: THREE.Vector3[] = [], bulbs: THREE.Vector3[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, x = -0.58 + t * 1.16;
      // two loops hanging between three hooks
      const sag = 0.07 * Math.sin(Math.PI * ((t * 2) % 1));
      pts.push(new THREE.Vector3(x, 0.4 - sag, 0.03));
      if (i % 2 === 1) bulbs.push(new THREE.Vector3(x, 0.4 - sag - 0.012, 0.035));
    }
    return { wire: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.0012, 4, false), bulbs };
  }, []);
  const bulbMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffd99a").multiplyScalar(4) }), []);
  const wireMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2a2620", roughness: 0.6 }), []);

  const notes = useRef<(THREE.Group | null)[]>([]);
  const hovered = useRef(-1);
  useFrame(({ clock }) => {
    // a slow, uneven shimmer
    const t = clock.elapsedTime;
    bulbMat.color.setRGB(1, 0.85, 0.6).multiplyScalar(3.4 + Math.sin(t * 1.7) * 0.4 + Math.sin(t * 4.3) * 0.2);
  });
  useFrame((_, dt) => {
    const { workSel, page } = useRoom.getState();
    // the picked note lifts off the cork and grows a little; no glow, which pushed the bright yellow note past the
    // bloom threshold and fogged its writing
    notes.current.forEach((g, i) => {
      if (!g) return;
      const sel = page === "work" && workSel === i, hov = hovered.current === i;
      const z = sel ? 0.03 : hov ? 0.012 : 0;
      g.position.z += (0.014 + i * 0.0004 + z - g.position.z) * Math.min(1, dt * 10);
      const s = sel ? 1.07 : 1;
      g.scale.setScalar(g.scale.x + (s - g.scale.x) * Math.min(1, dt * 10));
    });
  });

  return (
    <group ref={ref} position={[ROOM.x0 + 0.02, 1.5, 1.7]} rotation-y={Math.PI / 2}>
      <group {...clickable("CORK BOARD · WORK", () => useRoom.getState().go("work"))}>
        <mesh position={[0, 0, -0.005]} castShadow receiveShadow material={m.frame}><primitive object={soft(1.14, 0.79, 0.03)} attach="geometry" /></mesh>
        <mesh position={[0, 0, 0.0105]} receiveShadow material={m.cork}><planeGeometry args={[1.08, 0.73]} /></mesh>
        <mesh position={[-0.37, 0.205, 0.013]} rotation-z={0.05} material={m.title}><planeGeometry args={[0.18, 0.12]} /></mesh>
        <mesh position={[POLAROID.x, POLAROID.y, 0.013]} rotation-z={POLAROID.rot} material={m.polaroid}><planeGeometry args={[POLAROID.w, POLAROID.h]} /></mesh>
        <mesh position={[POLAROID.x, POLAROID.y + 0.075, 0.02]} material={m.pins[4]}><sphereGeometry args={[0.008, 12, 10]} /></mesh>
      </group>
      <mesh geometry={fairy.wire} material={wireMat} />
      {fairy.bulbs.map((p, i) => <mesh key={i} position={p} material={bulbMat}><sphereGeometry args={[0.006, 8, 6]} /></mesh>)}
      <pointLight position={[0, 0.2, 0.45]} color="#ffe4bd" intensity={1.1} distance={2.2} decay={2} />
      {ITEMS.map((it, i) => {
        const act = () => {
          const s = useRoom.getState();
          s.selectWork(i);
          s.go("work");
        };
        const props = clickable(it.label, act);
        return (
          <group
            key={i}
            ref={(g) => { notes.current[i] = g; }}
            position={[it.x, it.y, 0.014]}
            rotation-z={it.rot}
            {...props}
            onPointerOver={(e) => { hovered.current = i; props.onPointerOver(e); }}
            onPointerOut={() => { hovered.current = -1; props.onPointerOut(); }}
          >
            <mesh castShadow receiveShadow material={m.notes[i]}><planeGeometry args={[it.w, it.h]} /></mesh>
            <mesh position={[0, it.h / 2 - PIN_INSET, 0.016]} castShadow material={m.pins[i % 4]}><sphereGeometry args={[0.0085, 14, 10]} /></mesh>
          </group>
        );
      })}
    </group>
  );
}
