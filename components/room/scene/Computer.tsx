"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { jobs, profile } from "@/content/profile";
import { registerStation } from "../camera/stations";
import { clickable } from "../lib/interact";
import { canvasTexture, FONT, fontsReady, rng, roundRect } from "../lib/textures";
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
    const keys = canvasTexture(512, 176, (ctx, w, h) => {
      ctx.fillStyle = "#c9ccd2";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#f5f5f7";
      const kw = 31, gap = 4.6;
      [14, 14, 13, 12].forEach((n, r) => {
        const y = 8 + r * 33, x0 = (w - (n * kw + (n - 1) * gap)) / 2;
        for (let i = 0; i < n; i++) { roundRect(ctx, x0 + i * (kw + gap), y, kw, 27, 5); ctx.fill(); }
      });
      const y = 8 + 4 * 33;
      for (let i = 0; i < 3; i++) { roundRect(ctx, 22 + i * (kw + gap), y, kw, 27, 5); ctx.fill(); roundRect(ctx, w - 22 - kw - i * (kw + gap), y, kw, 27, 5); ctx.fill(); }
      roundRect(ctx, 22 + 3 * (kw + gap), y, w - 44 - 6 * (kw + gap) - gap, 27, 5);
      ctx.fill();
    }).texture;
    const scr = new THREE.MeshBasicMaterial({ map: screen.texture, toneMapped: true });
    scr.color.setScalar(1.05);
    return {
      alu: new THREE.MeshStandardMaterial({ color: "#d6d8dc", roughness: 0.32, metalness: 0.6 }),
      keys: new THREE.MeshStandardMaterial({ map: keys, roughness: 0.55 }),
      glass: new THREE.MeshStandardMaterial({ color: "#0b0c0f", roughness: 0.12 }),
      mouse: new THREE.MeshStandardMaterial({ color: "#f3f3f5", roughness: 0.3 }),
      screen: scr,
    };
  }, [screen]);
  const geo = useMemo(() => ({
    body: new RoundedBoxGeometry(0.64, 0.47, 0.022, 3, 0.008),
    keyboard: new RoundedBoxGeometry(0.29, 0.009, 0.105, 2, 0.004),
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
      {/* the screen on its stand: what the About page frames */}
      <group ref={ref} position={[0, DESK_Y, -2.06]} {...props}>
        <mesh position={[0, 0.0035, -0.01]} castShadow receiveShadow material={m.alu}><boxGeometry args={[0.19, 0.007, 0.16]} /></mesh>
        <mesh position={[0, 0.13, -0.075]} rotation-x={0.18} castShadow material={m.alu}><boxGeometry args={[0.15, 0.26, 0.012]} /></mesh>
        <group position={[0, 0.345, -0.03]} rotation-x={-0.04}>
          <mesh geometry={geo.body} castShadow receiveShadow material={m.alu} />
          <mesh position={[0, 0.03, 0.0112]} material={m.glass}><planeGeometry args={[0.624, 0.392]} /></mesh>
          <mesh position={[0, 0.03, 0.0116]} material={m.screen}><planeGeometry args={[0.6, 0.375]} /></mesh>
        </group>
      </group>
      <group {...props}>
        <mesh geometry={geo.keyboard} position={[-0.02, DESK_Y + 0.0045, -1.81]} castShadow receiveShadow material={m.alu} />
        <mesh position={[-0.02, DESK_Y + 0.0092, -1.81]} rotation-x={-Math.PI / 2} material={m.keys}><planeGeometry args={[0.278, 0.096]} /></mesh>
        <mesh position={[0.25, DESK_Y + 0.009, -1.8]} scale={[0.032, 0.012, 0.055]} castShadow material={m.mouse}><sphereGeometry args={[1, 20, 12]} /></mesh>
      </group>
    </group>
  );
}
