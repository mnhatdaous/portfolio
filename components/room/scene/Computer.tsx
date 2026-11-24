"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { jobs, profile } from "@/content/profile";
import { registerStation } from "../camera/stations";
import { clickable } from "../lib/interact";
import { canvasTexture, FONT, fontsReady, rng, roundRect } from "../lib/textures";
import { soft } from "../lib/shapes";
import { useRoom } from "../store";
import { DESK_Y } from "./Desk";

const SW = 1024, SH = 640;
const TZ = profile.timeZone;
export const saigonTime = (d = new Date()) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
const saigonDate = (d = new Date()) => new Intl.DateTimeFormat("vi-VN", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" }).format(d);

// what the terminal types at About: commands type out, their output appears line by line
const COLS = 62;
const wrapCols = (s: string) => {
  const out: string[] = [];
  let line = "";
  for (const w of s.split(" ")) {
    if ((line + " " + w).trim().length > COLS && line) { out.push(line); line = w; } else line = (line + " " + w).trim();
  }
  out.push(line);
  return out;
};
const SCRIPT: { cmd: string; out: string[] }[] = [
  { cmd: "whoami", out: [`${profile.name} · ${profile.role}`, profile.location] },
  { cmd: "cat about.txt", out: [...wrapCols(profile.about[0]), ...wrapCols(profile.about[1])] },
  { cmd: "ls work/", out: [jobs.map((j) => `${j.id}/`).join("  ")] },
  { cmd: "cat education.txt", out: [profile.education.school, `Bachelor's, Information Technology · ${profile.education.years}`] },
];
const PROMPT = "nhat@saigon ~ % ";
const TYPE_CPS = 30, LINE_GAP = 0.07, PAUSE = 0.45;

/** the lines visible `t` seconds into the session, and whether the last one is still being typed */
function termAt(t: number) {
  const lines: { kind: "cmd" | "out"; text: string }[] = [];
  let clock = 0.3;
  for (const step of SCRIPT) {
    const typed = Math.floor((t - clock) * TYPE_CPS);
    if (typed < 0) { lines.push({ kind: "cmd", text: "" }); return { lines, typing: false }; }
    if (typed < step.cmd.length) { lines.push({ kind: "cmd", text: step.cmd.slice(0, typed) }); return { lines, typing: true }; }
    lines.push({ kind: "cmd", text: step.cmd });
    clock += step.cmd.length / TYPE_CPS + 0.25;
    for (const o of step.out) {
      if (t < clock) return { lines, typing: false };
      lines.push({ kind: "out", text: o });
      clock += LINE_GAP;
    }
    lines.push({ kind: "out", text: "" });
    clock += PAUSE;
  }
  lines.push({ kind: "cmd", text: "" });
  return { lines, typing: false };
}

/** the wallpaper: the same view, simplified, with the time over it */
function drawLock(ctx: CanvasRenderingContext2D) {
  const horizon = SH * 0.66;
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, "#6f9fd2");
  g.addColorStop(1, "#d8e5ef");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SW, horizon);
  const lake = ctx.createLinearGradient(0, horizon, 0, SH);
  lake.addColorStop(0, "#b5cbdd");
  lake.addColorStop(1, "#7d9fbe");
  ctx.fillStyle = lake;
  ctx.fillRect(0, horizon, SW, SH - horizon);
  // a snowy ridge: rock, then snow wherever it rises above a line
  const r = rng(5), ridge: [number, number][] = [];
  for (let x = 0, y = horizon - 60; x <= SW + 40; x += 28) {
    y = Math.max(horizon - 190, Math.min(horizon - 20, y + (r() - 0.5) * 70));
    ridge.push([x, y]);
  }
  const mountains = () => { ctx.beginPath(); ctx.moveTo(0, horizon); ridge.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.lineTo(SW, horizon); ctx.closePath(); };
  ctx.fillStyle = "#8494b0";
  mountains();
  ctx.fill();
  ctx.save();
  mountains();
  ctx.clip();
  ctx.fillStyle = "#f1f4f8";
  ctx.fillRect(0, 0, SW, horizon - 110);
  ctx.restore();
  ctx.fillStyle = "rgba(60,90,80,.55)";
  ctx.fillRect(0, horizon - 6, SW, 8);

  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(30,50,80,.35)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 168px ${FONT.display()}`;
  ctx.fillText(saigonTime(), SW / 2, 230);
  ctx.font = `500 34px ${FONT.display()}`;
  const date = saigonDate();
  ctx.fillText(date.charAt(0).toUpperCase() + date.slice(1), SW / 2, 286);
  ctx.font = `700 30px ${FONT.display()}`;
  ctx.fillText(profile.name, SW / 2, 548);
  ctx.font = `400 21px ${FONT.mono()}`;
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.fillText("click to open · about", SW / 2, 592);
  ctx.shadowBlur = 0;
  ctx.textAlign = "left";
}

function drawTerm(ctx: CanvasRenderingContext2D, t: number, blink: boolean) {
  ctx.fillStyle = "#14161c";
  ctx.fillRect(0, 0, SW, SH);
  // title bar
  ctx.fillStyle = "#22252d";
  ctx.fillRect(0, 0, SW, 46);
  for (const [i, c] of ["#ff5f57", "#febc2e", "#28c840"].entries()) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(28 + i * 26, 23, 8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#8d919c";
  ctx.font = `500 19px ${FONT.mono()}`;
  ctx.textAlign = "center";
  ctx.fillText("nhat — zsh — 80×24", SW / 2, 30);
  ctx.textAlign = "left";
  const { lines, typing } = termAt(t);
  const LH = 31, max = Math.floor((SH - 70) / LH), from = Math.max(0, lines.length - max);
  ctx.font = `400 24px ${FONT.mono()}`;
  let y = 84;
  lines.slice(from).forEach((l, i, arr) => {
    let x = 30;
    if (l.kind === "cmd") {
      ctx.fillStyle = "#7ee787"; ctx.fillText("nhat@saigon", x, y); x += ctx.measureText("nhat@saigon").width;
      ctx.fillStyle = "#79c0ff"; ctx.fillText(" ~ ", x, y); x += ctx.measureText(" ~ ").width;
      ctx.fillStyle = "#e6e1d6"; ctx.fillText("% " + l.text, x, y); x += ctx.measureText("% " + l.text).width;
      if (i === arr.length - 1 && (typing || blink)) { ctx.fillStyle = "#ffb35a"; ctx.fillRect(x + 2, y - 21, 13, 27); }
    } else {
      ctx.fillStyle = "#c9c2b4"; ctx.fillText(l.text, x, y);
    }
    y += LH;
  });
}

export default function Computer() {
  const ref = useRef<THREE.Group>(null);
  useEffect(() => { registerStation("about", ref.current); return () => registerStation("about", null); }, []);

  const screen = useMemo(() => canvasTexture(SW, SH), []);
  const m = useMemo(() => {
    // a mechanical keyboard from above: cream keycaps on a graphite case, the edge keys grey, Esc and Enter in orange
    const keys = canvasTexture(640, 220, (ctx, w, h) => {
      ctx.fillStyle = "#2a2c30";
      ctx.fillRect(0, 0, w, h);
      const kw = 38, gap = 4.5, cap = (x: number, y: number, kw2: number, c: string) => {
        ctx.fillStyle = "rgba(0,0,0,.35)";
        roundRect(ctx, x + 1, y + 3, kw2, 34, 6); ctx.fill();
        ctx.fillStyle = c;
        roundRect(ctx, x, y, kw2, 33, 6); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.18)";
        roundRect(ctx, x + 4, y + 3, kw2 - 8, 12, 4); ctx.fill();
      };
      [14, 14, 13, 12].forEach((n, r) => {
        const y = 10 + r * 41, x0 = (w - (n * kw + (n - 1) * gap)) / 2;
        for (let i = 0; i < n; i++) {
          const edge = i === 0 || i === n - 1;
          cap(x0 + i * (kw + gap), y, kw, r === 0 && i === 0 ? "#d9773b" : r === 2 && i === n - 1 ? "#d9773b" : edge ? "#9a9ca2" : "#ece6d8");
        }
      });
      const y = 10 + 4 * 41;
      for (let i = 0; i < 3; i++) { cap(26 + i * (kw + gap), y, kw, "#9a9ca2"); cap(w - 26 - kw - i * (kw + gap), y, kw, "#9a9ca2"); }
      cap(26 + 3 * (kw + gap), y, w - 52 - 6 * (kw + gap) - gap, "#ece6d8");
    }).texture;
    const scr = new THREE.MeshBasicMaterial({ map: screen.texture, toneMapped: true });
    scr.color.setScalar(1.05);
    return {
      graphite: new THREE.MeshStandardMaterial({ color: "#34373c", roughness: 0.35, metalness: 0.65 }),
      keys: new THREE.MeshStandardMaterial({ map: keys, roughness: 0.5 }),
      glass: new THREE.MeshStandardMaterial({ color: "#0b0c0f", roughness: 0.12 }),
      mouse: new THREE.MeshStandardMaterial({ color: "#2e3035", roughness: 0.35, metalness: 0.3 }),
      mat: new THREE.MeshPhysicalMaterial({ color: "#7a4528", roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
      speaker: new THREE.MeshStandardMaterial({ color: "#2b2d31", roughness: 0.55, metalness: 0.2 }),
      cone: new THREE.MeshStandardMaterial({ color: "#4a4d53", roughness: 0.7 }),
      ring: new THREE.MeshStandardMaterial({ color: "#a9adb4", roughness: 0.25, metalness: 0.9 }),
      screen: scr,
    };
  }, [screen]);
  const geo = useMemo(() => ({
    body: new RoundedBoxGeometry(0.8, 0.51, 0.026, 3, 0.012),
    keyboard: new RoundedBoxGeometry(0.36, 0.028, 0.125, 3, 0.009),
    mat: new RoundedBoxGeometry(0.9, 0.004, 0.36, 2, 0.0019),
    speaker: new RoundedBoxGeometry(0.1, 0.16, 0.12, 3, 0.012),
  }), []);

  const st = useRef({ mode: "", key: "", openedAt: 0, ready: false });
  useEffect(() => { fontsReady().then(() => { st.current.ready = true; st.current.key = ""; }); }, []);

  useFrame(({ clock }) => {
    const s = st.current, T = clock.elapsedTime;
    const about = useRoom.getState().page === "about";
    const mode = about ? "term" : "lock";
    if (mode !== s.mode) { s.mode = mode; s.openedAt = T; s.key = ""; }
    // redraw only when something on the screen changed
    let key: string;
    if (mode === "lock") key = saigonTime() + s.ready;
    else {
      const t = T - s.openedAt, blink = Math.floor(T * 1.9) % 2 === 0;
      key = `${termAt(t).lines.reduce((n, l) => n + l.text.length + 1, 0)}|${blink}|${s.ready}`;
      if (key !== s.key) drawTerm(screen.ctx, t, blink);
    }
    if (key === s.key) return;
    if (mode === "lock") drawLock(screen.ctx);
    s.key = key;
    screen.texture.needsUpdate = true;
  });

  const props = clickable("COMPUTER · ABOUT", () => useRoom.getState().go("about"));
  return (
    <group>
      {/* a 32-inch display on its stand: what the About page frames */}
      <group ref={ref} position={[0, DESK_Y, -2.1]} {...props}>
        <mesh position={[0, 0.006, 0]} castShadow receiveShadow material={m.graphite}><primitive object={soft(0.26, 0.012, 0.2)} attach="geometry" /></mesh>
        <mesh position={[0, 0.17, -0.07]} rotation-x={0.16} castShadow material={m.graphite}><primitive object={soft(0.16, 0.34, 0.016)} attach="geometry" /></mesh>
        <group position={[0, 0.42, -0.035]} rotation-x={-0.05}>
          <mesh geometry={geo.body} castShadow receiveShadow material={m.graphite} />
          <mesh position={[0, 0, 0.0132]} material={m.glass}><planeGeometry args={[0.79, 0.5]} /></mesh>
          <mesh position={[0, 0, 0.0136]} material={m.screen}><planeGeometry args={[0.77, 0.48125]} /></mesh>
        </group>
      </group>
      {/* a leather mat, the keyboard and the mouse */}
      <mesh geometry={geo.mat} position={[0.05, DESK_Y + 0.002, -1.8]} receiveShadow material={m.mat} />
      <group {...props}>
        <mesh geometry={geo.keyboard} position={[-0.05, DESK_Y + 0.018, -1.79]} rotation-x={0.04} castShadow receiveShadow material={m.graphite} />
        <mesh position={[-0.05, DESK_Y + 0.0325, -1.79]} rotation-x={-Math.PI / 2 + 0.04} material={m.keys}><planeGeometry args={[0.35, 0.117]} /></mesh>
        <mesh position={[0.27, DESK_Y + 0.016, -1.79]} scale={[0.034, 0.018, 0.06]} castShadow material={m.mouse}><sphereGeometry args={[1, 24, 14]} /></mesh>
      </group>
      {/* a pair of desk speakers either side, turned in a little */}
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * 0.48, DESK_Y, -2.2]} rotation-y={-sx * 0.2}>
          <mesh geometry={geo.speaker} position={[0, 0.08, 0]} castShadow receiveShadow material={m.speaker} />
          <mesh position={[0, 0.06, 0.0605]} rotation-x={Math.PI / 2} material={m.ring}><cylinderGeometry args={[0.034, 0.034, 0.004, 28]} /></mesh>
          <mesh position={[0, 0.06, 0.063]} rotation-x={Math.PI / 2} material={m.cone}><cylinderGeometry args={[0.028, 0.02, 0.004, 28]} /></mesh>
          <mesh position={[0, 0.125, 0.0605]} rotation-x={Math.PI / 2} material={m.ring}><cylinderGeometry args={[0.013, 0.013, 0.004, 20]} /></mesh>
        </group>
      ))}
    </group>
  );
}
