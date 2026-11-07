"use client";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { liveLinks, profile } from "@/content/profile";
import { registerStation } from "../camera/stations";
import { clickable } from "../lib/interact";
import { canvasTexture, FONT, fontsReady, roundRect, wrap } from "../lib/textures";
import { useRoom } from "../store";
import { DESK_Y } from "./Desk";
import { saigonTime } from "./Computer";

const PW = 540, PH = 1170;
type Hit = { x: number; y: number; w: number; h: number; href: string };

function statusBar(ctx: CanvasRenderingContext2D, light = true) {
  ctx.fillStyle = light ? "#f4eee2" : "#111";
  ctx.font = `700 26px ${FONT.display()}`;
  ctx.fillText(saigonTime(), 44, 52);
  ctx.textAlign = "right";
  ctx.font = `500 22px ${FONT.mono()}`;
  ctx.fillText("5G  82%", PW - 40, 50);
  ctx.textAlign = "left";
}

function drawLock(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, 0, PH);
  g.addColorStop(0, "#241638");
  g.addColorStop(1, "#071a24");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PW, PH);
  statusBar(ctx);
  ctx.textAlign = "center";
  ctx.fillStyle = "#f4eee2";
  ctx.font = `800 150px ${FONT.display()}`;
  ctx.fillText(saigonTime(), PW / 2, 300);
  // one notification
  ctx.fillStyle = "rgba(255,255,255,.14)";
  roundRect(ctx, 34, 400, PW - 68, 150, 30);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.fillStyle = "#45e6d4";
  ctx.beginPath(); ctx.arc(92, 475, 30, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#0b0b0d";
  ctx.font = `800 30px ${FONT.display()}`;
  ctx.fillText("N", 82, 486);
  ctx.fillStyle = "#f4eee2";
  ctx.font = `700 28px ${FONT.display()}`;
  ctx.fillText(profile.short, 142, 462);
  ctx.font = `400 26px ${FONT.display()}`;
  ctx.fillStyle = "rgba(244,238,226,.8)";
  ctx.fillText("Chào bạn! Tap to find me online.", 142, 504);
  ctx.textAlign = "center";
  ctx.font = `400 22px ${FONT.mono()}`;
  ctx.fillStyle = "rgba(244,238,226,.5)";
  ctx.fillText("click · online", PW / 2, PH - 70);
  ctx.textAlign = "left";
}

/** the chat at Online; `shown` messages have arrived so far. Returns where the link bubbles are. */
function drawChat(ctx: CanvasRenderingContext2D, shown: number, dots: number): Hit[] {
  ctx.fillStyle = "#0f1116";
  ctx.fillRect(0, 0, PW, PH);
  statusBar(ctx);
  // header
  ctx.fillStyle = "#171a21";
  ctx.fillRect(0, 76, PW, 110);
  ctx.fillStyle = "#45e6d4";
  ctx.beginPath(); ctx.arc(80, 131, 32, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#0b0b0d";
  ctx.font = `800 32px ${FONT.display()}`;
  ctx.fillText("N", 69, 143);
  ctx.fillStyle = "#f4eee2";
  ctx.font = `700 30px ${FONT.display()}`;
  ctx.fillText(profile.short, 130, 124);
  ctx.fillStyle = "#7ee787";
  ctx.beginPath(); ctx.arc(138, 152, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(244,238,226,.6)";
  ctx.font = `400 22px ${FONT.display()}`;
  ctx.fillText("Đang hoạt động · Saigon", 152, 160);

  const links = liveLinks();
  const msgs: ({ text: string } | { label: string; value: string; href: string })[] = [
    { text: "Chào bạn! I'm Nhat." },
    { text: "Where to find me:" },
    ...links.map((l) => ({ label: l.label, value: l.value, href: l.href })),
    { text: `It's ${saigonTime()} here in Saigon (GMT+7).` },
  ];
  const hits: Hit[] = [];
  let y = 230;
  const maxW = PW - 150;
  msgs.slice(0, shown).forEach((msg) => {
    if ("text" in msg) {
      ctx.font = `400 28px ${FONT.display()}`;
      const lines = wrap(ctx, msg.text, maxW - 48);
      const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 48), h = lines.length * 38 + 28;
      ctx.fillStyle = "#232731";
      roundRect(ctx, 34, y, w, h, 26);
      ctx.fill();
      ctx.fillStyle = "#ece6da";
      lines.forEach((l, i) => ctx.fillText(l, 58, y + 46 + i * 38));
      y += h + 14;
    } else {
      const h = 104, w = maxW;
      ctx.fillStyle = "#1f3b3a";
      roundRect(ctx, 34, y, w, h, 26);
      ctx.fill();
      ctx.strokeStyle = "rgba(69,230,212,.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#45e6d4";
      ctx.font = `700 26px ${FONT.mono()}`;
      ctx.fillText(msg.label.toUpperCase() + "  ↗", 60, y + 42);
      ctx.fillStyle = "#ece6da";
      ctx.font = `400 25px ${FONT.display()}`;
      let v = msg.value;
      while (ctx.measureText(v).width > w - 52 && v.length > 4) v = v.slice(0, -2);
      ctx.fillText(v === msg.value ? v : v + "…", 60, y + 80);
      hits.push({ x: 34, y, w, h, href: msg.href });
      y += h + 14;
    }
  });
  // still typing
  if (shown < msgs.length || dots >= 0) {
    ctx.fillStyle = "#232731";
    roundRect(ctx, 34, y, 110, 58, 29);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = `rgba(236,230,218,${i === dots % 3 ? 0.95 : 0.35})`;
      ctx.beginPath(); ctx.arc(66 + i * 23, y + 29, 7, 0, Math.PI * 2); ctx.fill();
    }
  }
  // the reply box
  ctx.fillStyle = "#171a21";
  ctx.fillRect(0, PH - 120, PW, 120);
  ctx.fillStyle = "#232731";
  roundRect(ctx, 30, PH - 96, PW - 60, 62, 31);
  ctx.fill();
  ctx.fillStyle = "rgba(236,230,218,.4)";
  ctx.font = `400 25px ${FONT.display()}`;
  ctx.fillText("Aa", 60, PH - 55);
  return hits;
}

export default function Phone() {
  const ref = useRef<THREE.Group>(null);
  useEffect(() => { registerStation("online", ref.current); return () => registerStation("online", null); }, []);
  const screen = useMemo(() => canvasTexture(PW, PH), []);
  const m = useMemo(() => {
    const scr = new THREE.MeshBasicMaterial({ map: screen.texture });
    scr.color.setScalar(1.1);
    return {
      body: new THREE.MeshStandardMaterial({ color: "#14161b", roughness: 0.35, metalness: 0.4 }),
      stand: new THREE.MeshStandardMaterial({ color: "#c9c3b6", roughness: 0.5, metalness: 0.3 }),
      screen: scr,
    };
  }, [screen]);
  const body = useMemo(() => new RoundedBoxGeometry(0.074, 0.156, 0.008, 3, 0.009), []);
  const st = useRef({ key: "", mode: "", at: 0, hits: [] as Hit[], ready: false });
  useEffect(() => { fontsReady().then(() => { st.current.ready = true; st.current.key = ""; }); }, []);

  useFrame(({ clock }) => {
    const s = st.current, T = clock.elapsedTime;
    const mode = useRoom.getState().page === "online" ? "chat" : "lock";
    if (mode !== s.mode) { s.mode = mode; s.at = T; s.key = ""; }
    const t = T - s.at, total = liveLinks().length + 3;
    const shown = mode === "chat" ? Math.min(total, Math.floor((t - 0.5) / 0.55) + 1) : 0;
    const dots = shown < total ? Math.floor(T * 3) : -1;
    const key = `${mode}|${shown}|${dots}|${saigonTime()}|${s.ready}`;
    if (key === s.key) return;
    s.key = key;
    if (mode === "lock") drawLock(screen.ctx);
    else s.hits = drawChat(screen.ctx, Math.max(0, shown), dots);
    screen.texture.needsUpdate = true;
  });

  // at Online a click on a link bubble opens it; anywhere else the click falls through to the phone (go to Online)
  const onScreen = (e: ThreeEvent<MouseEvent>) => {
    if (useRoom.getState().page !== "online" || !e.uv || e.delta > 6) return;
    e.stopPropagation();
    const x = e.uv.x * PW, y = (1 - e.uv.y) * PH;
    const hit = st.current.hits.find((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h);
    if (hit) window.open(hit.href, hit.href.startsWith("mailto:") ? "_self" : "_blank", "noopener");
  };

  return (
    <group ref={ref} position={[0.6, DESK_Y, -2.0]} rotation-y={-0.22} {...clickable("PHONE · ONLINE", () => useRoom.getState().go("online"))}>
      {/* a folding stand */}
      <mesh position={[0, 0.004, 0.005]} castShadow receiveShadow material={m.stand}><boxGeometry args={[0.07, 0.008, 0.08]} /></mesh>
      <mesh position={[0, 0.045, -0.025]} rotation-x={-0.35} castShadow material={m.stand}><boxGeometry args={[0.06, 0.09, 0.006]} /></mesh>
      <mesh position={[0, 0.014, 0.03]} castShadow material={m.stand}><boxGeometry args={[0.07, 0.012, 0.01]} /></mesh>
      <group position={[0, 0.088, -0.006]} rotation-x={-0.36}>
        <mesh geometry={body} castShadow material={m.body} />
        <mesh position={[0, 0, 0.0042]} material={m.screen} onClick={onScreen}><planeGeometry args={[0.068, 0.149]} /></mesh>
      </group>
    </group>
  );
}
