"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { builds, jobs } from "@/content/profile";
import { registerStation } from "../camera/stations";
import { clickable } from "../lib/interact";
import { canvasTexture, corkTexture, FONT, fontsReady, rng, woodTexture } from "../lib/textures";
import { useRoom } from "../store";
import { ROOM } from "./Room";

// Work: a cork board on the left wall. A sticky note per job, an index card per build (tied to AusyncLab with red
// string), a polaroid. Local coordinates: x across the board as the camera sees it, y up, z out of the cork.

type Item = { kind: "job" | "build"; i: number; x: number; y: number; w: number; h: number; rot: number; label: string };

const ITEMS: Item[] = [
  ...jobs.map((j, i) => {
    const pos: [number, number][] = [[-0.215, 0.2], [-0.02, 0.205], [0.175, 0.195], [0.37, 0.205], [-0.415, -0.035]];
    const r = rng(40 + i);
    return { kind: "job" as const, i, x: pos[i][0], y: pos[i][1], w: 0.16, h: 0.16, rot: (r() - 0.5) * 0.12, label: `${j.title.toUpperCase()} · ${j.years}` };
  }),
  ...builds.map((b, i) => {
    const pos: [number, number][] = [[-0.17, -0.045], [0.06, -0.055], [-0.17, -0.22], [0.06, -0.232]];
    const r = rng(60 + i);
    return { kind: "build" as const, i, x: pos[i][0], y: pos[i][1], w: 0.19, h: 0.125, rot: (r() - 0.5) * 0.08, label: `${b.title.toUpperCase()} · ${b.at.toUpperCase()}` };
  }),
];

/** how far below the top edge the pin goes: sticky notes in their glue strip, index cards right at the edge, above the title */
const pinInset = (it: Item) => (it.kind === "job" ? 0.016 : 0.001);

function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: string, size: number, family: string, maxW: number) {
  let s = size;
  do { ctx.font = `${weight} ${s}px ${family}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > 12);
}

function drawNote(ctx: CanvasRenderingContext2D, item: Item) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (item.kind === "job") {
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
  } else {
    const b = builds[item.i];
    ctx.fillStyle = "#f6f1e6";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(70,120,200,.35)";
    ctx.lineWidth = 2;
    for (let y = 88; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.strokeStyle = "rgba(210,60,60,.6)";
    ctx.beginPath(); ctx.moveTo(0, 60); ctx.lineTo(W, 60); ctx.stroke();
    ctx.fillStyle = "#1b2a4a";
    fitFont(ctx, b.title, "400", 40, FONT.hand(), W - 36);
    ctx.fillText(b.title, 18, 54);
    ctx.font = `400 28px ${FONT.hand()}`;
    ctx.fillStyle = "rgba(27,42,74,.8)";
    ctx.fillText(`at ${b.at} · ${b.years}`, 18, 113);
    ctx.font = `400 24px ${FONT.hand()}`;
    ctx.fillText(b.tech.slice(0, 3).join(", "), 18, 143);
  }
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
    notes: ITEMS.map((it) => canvasTexture(it.kind === "job" ? 256 : 320, it.kind === "job" ? 256 : 210, (ctx) => drawNote(ctx, it))),
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
    frame: new THREE.MeshStandardMaterial({ map: woodTexture(12, "#b98a58", [2, 1]), roughness: 0.5 }),
    notes: tex.notes.map((t) => new THREE.MeshStandardMaterial({ map: t.texture, roughness: 0.85 })),
    title: new THREE.MeshStandardMaterial({ map: tex.title.texture, roughness: 0.9 }),
    polaroid: new THREE.MeshStandardMaterial({ map: tex.polaroid.texture, roughness: 0.6 }),
    pins: ["#e84545", "#2f7de1", "#f2c230", "#3bb273", "#ffffff"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 0.1 })),
    yarn: new THREE.MeshStandardMaterial({ color: "#c0262d", roughness: 0.7 }),
  }), [tex]);

  // red string from AusyncLab's pin to each build's
  const yarn = useMemo(() => {
    const a = ITEMS[0], from = new THREE.Vector3(a.x, a.y + a.h / 2 - 0.018, 0.022);
    return ITEMS.filter((it) => it.kind === "build").map((b) => {
      const to = new THREE.Vector3(b.x, b.y + b.h / 2 - pinInset(b), 0.022);
      const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, -0.035, 0.006));
      return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from, mid, to), 24, 0.0016, 5, false);
    });
  }, []);

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
    notes.current.forEach((g, i) => {
      if (!g) return;
      const sel = page === "work" && workSel === i, hov = hovered.current === i;
      const z = sel ? 0.03 : hov ? 0.012 : 0;
      g.position.z += (0.014 + i * 0.0004 + z - g.position.z) * Math.min(1, dt * 10);
      const s = sel ? 1.07 : 1;
      g.scale.setScalar(g.scale.x + (s - g.scale.x) * Math.min(1, dt * 10));
      (m.notes[i] as THREE.MeshStandardMaterial).emissive.setScalar(sel ? 0.06 : 0);
    });
  });

  return (
    <group ref={ref} position={[ROOM.x0 + 0.02, 1.5, 1.3]} rotation-y={Math.PI / 2}>
      <group {...clickable("CORK BOARD · WORK", () => useRoom.getState().go("work"))}>
        <mesh position={[0, 0, -0.005]} castShadow receiveShadow material={m.frame}><boxGeometry args={[1.14, 0.79, 0.03]} /></mesh>
        <mesh position={[0, 0, 0.0105]} receiveShadow material={m.cork}><planeGeometry args={[1.08, 0.73]} /></mesh>
        <mesh position={[-0.42, 0.225, 0.013]} rotation-z={0.05} material={m.title}><planeGeometry args={[0.18, 0.12]} /></mesh>
        <mesh position={[0.36, -0.13, 0.013]} rotation-z={-0.07} material={m.polaroid}><planeGeometry args={[0.15, 0.176]} /></mesh>
        <mesh position={[0.36, -0.13 + 0.075, 0.02]} material={m.pins[4]}><sphereGeometry args={[0.008, 12, 10]} /></mesh>
        {yarn.map((g, i) => <mesh key={i} geometry={g} material={m.yarn} />)}
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
            <mesh position={[0, it.h / 2 - pinInset(it), 0.016]} castShadow material={m.pins[i % 4]}><sphereGeometry args={[0.0085, 14, 10]} /></mesh>
          </group>
        );
      })}
    </group>
  );
}
