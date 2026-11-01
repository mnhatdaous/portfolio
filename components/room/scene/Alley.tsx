"use client";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactElement } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { sound } from "../lib/audio";
import { asphaltTexture, canvasTexture, FONT, fontsReady, plasterTexture, rng } from "../lib/textures";

// The alley outside the window, one floor down: the houses across it, the wires, the rain, the city behind.
// The room's floor is y = 0; the street is GROUND; the houses across stand at z = FACADE.
const GROUND = -3.4, FACADE = -5.2, FLOOR0 = 3.6, FLOOR = 3.2;

// ---------------------------------------------------------------- glowing signs
type SignDef = { text: string; color: string; w: number; h: number; box?: string; ink?: string; font?: "hand" | "display" };
function drawSign(ctx: CanvasRenderingContext2D, s: SignDef) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);
  const fam = s.font === "hand" ? FONT.hand() : FONT.display();
  if (s.box) {
    // a lightbox: lit panel, painted letters
    ctx.fillStyle = s.box;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = s.ink ?? "#1b3d8f";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let size = H * 0.62;
    do { ctx.font = `800 ${size}px ${fam}`; size -= 2; } while (ctx.measureText(s.text).width > W * 0.88);
    ctx.fillText(s.text, W / 2, H / 2 + 4);
    return;
  }
  // neon tubes: a soft halo, then the bright core
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = H * 0.72;
  do { ctx.font = `${s.font === "hand" ? 400 : 800} ${size}px ${fam}`; size -= 2; } while (ctx.measureText(s.text).width > W * 0.86);
  ctx.shadowColor = s.color;
  for (const [blur, alpha] of [[40, 0.6], [18, 0.9]] as const) {
    ctx.shadowBlur = blur;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = H * 0.05;
    ctx.strokeText(s.text, W / 2, H / 2);
  }
  // the tube itself: lighter than its glow, still its colour (white would blow out to white)
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 8;
  ctx.fillStyle = "#" + new THREE.Color(s.color).lerp(new THREE.Color("#ffffff"), 0.55).getHexString();
  ctx.fillText(s.text, W / 2, H / 2);
  ctx.shadowBlur = 0;
}

function Sign({ def, position, rotation = [0, 0, 0], glow = 3, flicker = false }: { def: SignDef; position: [number, number, number]; rotation?: [number, number, number]; glow?: number; flicker?: boolean }) {
  const tex = useMemo(() => canvasTexture(1024, Math.round(THREE.MathUtils.clamp((1024 * def.h) / def.w, 128, 1024)), (ctx) => drawSign(ctx, def)), [def]);
  useEffect(() => { fontsReady().then(() => { drawSign(tex.ctx, def); tex.texture.needsUpdate = true; }); }, [tex, def]);
  const mat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ map: tex.texture, transparent: !def.box, depthWrite: !!def.box, toneMapped: true });
    m.color.setScalar(glow);
    return m;
  }, [tex, def, glow]);
  useFrame(({ clock }) => {
    if (!flicker) return;
    const t = clock.elapsedTime;
    // an old tube: steady, then a stutter now and then
    const s = Math.sin(t * 0.7) > 0.96 ? (Math.sin(t * 60) > 0 ? 0.25 : 1) : 1;
    mat.color.setScalar(glow * s);
  });
  return (
    <mesh position={position} rotation={rotation} material={mat}>
      <planeGeometry args={[def.w, def.h]} />
    </mesh>
  );
}

// ---------------------------------------------------------------- the houses across the alley
type House = { x0: number; w: number; floors: number; color: string; shop: "open" | "half" | "shut"; roof?: "tank" | "terrace" };
// From the desk the window frames x ≈ -1.3..2.6 of the far side: the one-storey café sits there, so its neon, its
// string of bulbs and the lit city behind it are what the room looks out on.
const HOUSES: House[] = [
  { x0: -13.4, w: 4.1, floors: 4, color: "#cdb79a", shop: "shut", roof: "tank" },
  { x0: -9.3, w: 4.3, floors: 3, color: "#9fbcc0", shop: "half" },
  { x0: -5.0, w: 4.1, floors: 4, color: "#d6d0c2", shop: "open", roof: "tank" },
  { x0: -0.9, w: 3.0, floors: 1, color: "#dcae98", shop: "open", roof: "terrace" },
  { x0: 2.1, w: 4.2, floors: 3, color: "#e2cd84", shop: "open" },
  { x0: 6.3, w: 3.9, floors: 5, color: "#b4c398", shop: "shut", roof: "tank" },
  { x0: 10.2, w: 4.1, floors: 3, color: "#cbc1b7", shop: "half" },
];

function useFacadeMaterials() {
  return useMemo(() => {
    const plaster = plasterTexture("#ffffff", [1, 1], 19);
    const r = rng(8);
    // lit windows: warm rooms, a TV's blue, blinds; and dark ones
    const lit = ["#ffcf8a", "#ffd9a6", "#8fb6ff", "#ffe2b8"].map((c, k) =>
      canvasTexture(128, 160, (ctx, w, h) => {
        ctx.fillStyle = c;
        ctx.fillRect(0, 0, w, h);
        const g = ctx.createRadialGradient(w * 0.5, h * 0.35, 4, w * 0.5, h * 0.4, h * 0.8);
        g.addColorStop(0, "rgba(255,255,255,.35)");
        g.addColorStop(1, "rgba(0,0,0,.45)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        if (k === 3) for (let y = 6; y < h; y += 10) { ctx.fillStyle = "rgba(90,60,30,.35)"; ctx.fillRect(0, y, w, 4); }
        if (k < 2) { ctx.fillStyle = "rgba(120,60,40,.55)"; ctx.fillRect(0, 0, w * 0.28, h); ctx.fillRect(w * 0.72, 0, w * 0.28, h); }
        if (k === 1 && r() < 0.8) { ctx.fillStyle = "rgba(30,20,20,.55)"; ctx.beginPath(); ctx.ellipse(w * 0.55, h * 0.7, 14, 30, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(w * 0.55, h * 0.42, 11, 0, Math.PI * 2); ctx.fill(); }
      }).texture,
    );
    const shutter = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = "#6d7176"; ctx.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 8) { ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(0, y, w, 2); ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(0, y + 3, w, 1); }
    }).texture;
    const rail = canvasTexture(256, 64, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#1c1d20";
      ctx.fillRect(0, 0, w, 5);
      ctx.fillRect(0, h - 4, w, 4);
      for (let x = 2; x < w; x += 12) ctx.fillRect(x, 0, 3, h);
    }).texture;
    rail.wrapS = THREE.RepeatWrapping;
    return {
      plaster,
      wall: (color: string) => new THREE.MeshStandardMaterial({ color, map: plaster, roughness: 0.92 }),
      dark: new THREE.MeshStandardMaterial({ color: "#121318", roughness: 0.6 }),
      frame: new THREE.MeshStandardMaterial({ color: "#2a2b2f", roughness: 0.5 }),
      lit: lit.map((t) => { const m = new THREE.MeshBasicMaterial({ map: t }); m.color.setScalar(1.25); return m; }),
      unlit: new THREE.MeshStandardMaterial({ color: "#1a1d24", roughness: 0.15, metalness: 0.3 }),
      shop: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffbe73").multiplyScalar(1.6) }),
      shutter: new THREE.MeshStandardMaterial({ map: shutter, roughness: 0.5, metalness: 0.4 }),
      slab: new THREE.MeshStandardMaterial({ color: "#9a958c", roughness: 0.9 }),
      rail: (w: number) => {
        const t = rail.clone();
        t.repeat.set(w / 1.2, 1);
        t.needsUpdate = true;
        return new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.4, roughness: 0.5, side: THREE.DoubleSide });
      },
      ac: new THREE.MeshStandardMaterial({ color: "#c9cbc8", roughness: 0.6 }),
      tank: new THREE.MeshStandardMaterial({ color: "#c4c8cd", roughness: 0.25, metalness: 0.85 }),
      plant: new THREE.MeshStandardMaterial({ color: "#2f5a2b", roughness: 0.8 }),
      cloth: ["#d64b4b", "#f2d16b", "#4b8bd6", "#ececec", "#7cc28e"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide })),
    };
  }, []);
}

function HouseMesh({ h, idx, m }: { h: House; idx: number; m: ReturnType<typeof useFacadeMaterials> }) {
  const r = useMemo(() => rng(200 + idx), [idx]);
  const top = GROUND + FLOOR0 + (h.floors - 1) * FLOOR;
  const cx = h.x0 + h.w / 2;
  const wall = useMemo(() => m.wall(h.color), [m, h.color]);
  const wallH = top - GROUND + 0.7; // with its parapet
  const floors = useMemo(() => {
    const out: { y: number; lit: number; balcony: boolean; laundry: boolean; ac: boolean }[] = [];
    for (let f = 1; f < h.floors; f++) out.push({ y: GROUND + FLOOR0 + (f - 1) * FLOOR, lit: r() < 0.72 ? Math.floor(r() * 4) : -1, balcony: r() < 0.75, laundry: r() < 0.4, ac: r() < 0.6 });
    return out;
  }, [h.floors, r]);
  return (
    <group>
      <mesh position={[cx, GROUND + wallH / 2, FACADE - 0.2]} material={wall}><boxGeometry args={[h.w - 0.04, wallH, 0.4]} /></mesh>
      {/* the shop on the ground floor */}
      <mesh position={[cx, GROUND + 1.45, FACADE + 0.005]} material={h.shop === "shut" ? m.shutter : m.dark}><planeGeometry args={[h.w - 0.6, 2.9]} /></mesh>
      {h.shop !== "shut" && (
        <mesh position={[cx, GROUND + (h.shop === "half" ? 0.6 : 1.2), FACADE + 0.01]} material={m.shop}><planeGeometry args={[h.w - 0.8, h.shop === "half" ? 1.2 : 2.4]} /></mesh>
      )}
      {h.shop === "half" && <mesh position={[cx, GROUND + 2.15, FACADE + 0.012]} material={m.shutter}><planeGeometry args={[h.w - 0.6, 1.5]} /></mesh>}
      {/* the floors above */}
      {floors.map((f, k) => (
        <group key={k}>
          <mesh position={[cx, f.y + 1.55, FACADE + 0.01]} material={m.frame}><planeGeometry args={[h.w * 0.62 + 0.12, 2.12]} /></mesh>
          <mesh position={[cx, f.y + 1.55, FACADE + 0.015]} material={f.lit >= 0 ? m.lit[f.lit] : m.unlit}><planeGeometry args={[h.w * 0.62, 2.0]} /></mesh>
          {f.ac && <mesh position={[cx + h.w * 0.38, f.y + 2.5, FACADE + 0.2]} material={m.ac}><boxGeometry args={[0.75, 0.5, 0.3]} /></mesh>}
          {f.balcony && (
            <group>
              <mesh position={[cx, f.y + 0.06, FACADE + 0.35]} material={m.slab}><boxGeometry args={[h.w - 0.3, 0.12, 0.7]} /></mesh>
              <mesh position={[cx, f.y + 0.6, FACADE + 0.69]} material={m.rail(h.w - 0.3)}><planeGeometry args={[h.w - 0.3, 0.95]} /></mesh>
              {[-0.35, 0.05, 0.3].map((p, j) => (
                <mesh key={j} position={[cx + p * h.w, f.y + 0.32, FACADE + 0.5]} scale={[1, 1.3, 1]} material={m.plant}><sphereGeometry args={[0.22 + j * 0.04, 10, 8]} /></mesh>
              ))}
              {f.laundry && [0, 1, 2, 3].map((j) => (
                <mesh key={`l${j}`} position={[cx - h.w * 0.25 + j * 0.42, f.y + 1.75, FACADE + 0.55]} material={m.cloth[(j + idx) % 5]}><planeGeometry args={[0.32, 0.5]} /></mesh>
              ))}
            </group>
          )}
        </group>
      ))}
      {h.roof === "tank" && (
        <mesh position={[cx + h.w * 0.22, top + 1.25, FACADE - 0.6]} rotation-z={Math.PI / 2} material={m.tank}><cylinderGeometry args={[0.55, 0.55, 1.5, 20]} /></mesh>
      )}
    </group>
  );
}

// a rooftop café on the one-storey house: parapet, plants, a string of bulbs
function Terrace({ h, m }: { h: House; m: ReturnType<typeof useFacadeMaterials> }) {
  const y = GROUND + FLOOR0, cx = h.x0 + h.w / 2;
  const bulbs = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      out.push([h.x0 + 0.3 + t * (h.w - 0.6), y + 2.35 - Math.sin(t * Math.PI) * 0.45, FACADE + 0.2 - t * 0.3]);
    }
    return out;
  }, [h, y]);
  const bulb = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffc46b").multiplyScalar(5) }), []);
  const umbrella = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c43d3d", roughness: 0.8, side: THREE.DoubleSide }), []);
  return (
    <group>
      {[[h.x0 + 0.2, 0], [h.x0 + h.w - 0.2, 0]].map(([x], i) => (
        <mesh key={i} position={[x, y + 1.3, FACADE + 0.2]} material={m.frame}><cylinderGeometry args={[0.035, 0.035, 2.6, 8]} /></mesh>
      ))}
      {bulbs.map((p, i) => <mesh key={i} position={p} material={bulb}><sphereGeometry args={[0.045, 8, 6]} /></mesh>)}
      <mesh position={[cx + 0.6, y + 1.9, FACADE - 0.8]} material={umbrella}><coneGeometry args={[1.2, 0.5, 8, 1, true]} /></mesh>
      <mesh position={[cx + 0.6, y + 1.0, FACADE - 0.8]} material={m.frame}><cylinderGeometry args={[0.03, 0.03, 1.9, 6]} /></mesh>
      {[-1.2, -0.5, 1.4].map((x, i) => (
        <mesh key={i} position={[cx + x, y + 0.75, FACADE - 0.2]} scale={[1, 1.4, 1]} material={m.plant}><sphereGeometry args={[0.3, 10, 8]} /></mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- the city behind: a second row, and the skyline
function City() {
  const winTex = useMemo(() => {
    const r = rng(55);
    return canvasTexture(128, 256, (ctx, w, h) => {
      ctx.fillStyle = "#0b0d14";
      ctx.fillRect(0, 0, w, h);
      for (let y = 4; y < h; y += 8) for (let x = 3; x < w; x += 7) {
        const v = r();
        if (v < 0.22) { ctx.fillStyle = v < 0.05 ? "#9fc4ff" : v < 0.15 ? "#ffcf8a" : "#ffe7b8"; ctx.fillRect(x, y, 4, 4); }
      }
    }).texture;
  }, []);
  const blocks = useMemo(() => {
    const r = rng(91), out: { x: number; z: number; w: number; h: number; d: number }[] = [];
    for (let i = 0; i < 9; i++) out.push({ x: -16 + i * 4 + r() * 1.5, z: -13 - r() * 3, w: 3 + r() * 2, h: 7 + r() * 9, d: 4 });
    for (let i = 0; i < 22; i++) out.push({ x: -70 + i * 6.5 + r() * 3, z: -48 - r() * 18, w: 4 + r() * 5, h: 8 + r() * 16, d: 6 });
    return out;
  }, []);
  const mats = useMemo(() => blocks.map((b) => {
    const t = winTex.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(Math.max(1, b.w / 4), Math.max(1, b.h / 8));
    t.needsUpdate = true;
    const m = new THREE.MeshBasicMaterial({ map: t });
    m.color.setScalar(0.9);
    return m;
  }), [blocks, winTex]);
  const beacon = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (beacon.current) beacon.current.color.setRGB(clock.elapsedTime % 1.6 < 0.25 ? 9 : 0.4, 0, 0);
  });
  const tower = useMemo(() => new THREE.MeshBasicMaterial({ color: "#121522" }), []);
  return (
    <group>
      {blocks.map((b, i) => (
        <mesh key={i} position={[b.x, GROUND + b.h / 2, b.z]} material={mats[i]}><boxGeometry args={[b.w, b.h, b.d]} /></mesh>
      ))}
      {/* the tall tower on the skyline, its light blinking for the planes */}
      <group position={[9, GROUND, -64]} scale={0.45}>
        {[[6, 14], [5, 10], [4, 8], [3, 6], [1.6, 5]].reduce<{ y: number; els: ReactElement[] }>((acc, [w, hh], i) => {
          acc.els.push(<mesh key={i} position={[0, acc.y + hh / 2, 0]} material={i === 2 ? mats[3] : tower}><boxGeometry args={[w, hh, w]} /></mesh>);
          acc.y += hh;
          return acc;
        }, { y: 0, els: [] }).els}
        <mesh position={[0, 46, 0]} material={tower}><cylinderGeometry args={[0.08, 0.25, 6, 6]} /></mesh>
        <mesh position={[0, 49.2, 0]}><sphereGeometry args={[0.35, 10, 8]} /><meshBasicMaterial ref={beacon} color="#ff0000" /></mesh>
      </group>
    </group>
  );
}

function Sky() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    depthWrite: false,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
    fragmentShader: `
      varying vec2 vUv; uniform float uTime;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      void main(){
        float y = vUv.y;
        vec3 top = vec3(.012,.016,.045), mid = vec3(.07,.035,.11), low = vec3(.36,.13,.11);
        vec3 c = mix(low, mid, smoothstep(.0, .32, y));
        c = mix(c, top, smoothstep(.3, .85, y));
        // low clouds, lit orange from below by the city
        float k = n(vUv*vec2(7.,3.) + vec2(uTime*.006, 0.))*.6 + n(vUv*vec2(17.,7.) + vec2(uTime*.012, 3.))*.4;
        c += vec3(.28,.11,.1) * smoothstep(.5, .85, k) * (1. - smoothstep(.15, .6, y));
        gl_FragColor = vec4(c, 1.);
      }`,
  }), []);
  useFrame(({ clock }) => { mat.uniforms.uTime.value = clock.elapsedTime; });
  return <mesh position={[0, 25, -110]} material={mat}><planeGeometry args={[420, 170]} /></mesh>;
}

// ---------------------------------------------------------------- wires, the pole, the street lamp
function Wires() {
  const geo = useMemo(() => {
    const r = rng(303), parts: THREE.BufferGeometry[] = [];
    const pole = new THREE.Vector3(1.25, 0, -1.65);
    const cable = (a: THREE.Vector3, b: THREE.Vector3, sag: number, rad = 0.011) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        pts.push(a.clone().lerp(b, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0)));
      }
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, rad, 4, false));
    };
    // along the alley, both ways
    for (let i = 0; i < 9; i++) {
      const y = 1.5 + r() * 1.5;
      cable(new THREE.Vector3(pole.x, y, pole.z + (r() - 0.5) * 0.15), new THREE.Vector3(-16, y + (r() - 0.5) * 1.2, -1.4 - r() * 0.6), 0.5 + r() * 0.9);
      cable(new THREE.Vector3(pole.x, y, pole.z), new THREE.Vector3(16, y + (r() - 0.5) * 1.2, -1.5 - r() * 0.5), 0.4 + r() * 0.8);
    }
    // across to the houses
    for (let i = 0; i < 6; i++) {
      cable(new THREE.Vector3(pole.x, 1.8 + r() * 1.2, pole.z), new THREE.Vector3(-3 + r() * 9, 0.6 + r() * 2.2, FACADE + 0.1), 0.3 + r() * 0.5, 0.008);
    }
    // the coil of spare cable wound round the pole
    for (let k = 0; k < 3; k++) {
      const t = new THREE.TorusGeometry(0.22 + k * 0.03, 0.03, 6, 20);
      t.rotateX(Math.PI / 2 + (r() - 0.5) * 0.4);
      t.translate(pole.x, 1.2 + k * 0.12, pole.z);
      parts.push(t);
    }
    const p = new THREE.CylinderGeometry(0.11, 0.14, 9.5, 10);
    p.translate(pole.x, GROUND + 4.75, pole.z);
    parts.push(p);
    const arm = new THREE.CylinderGeometry(0.035, 0.035, 1.3, 6);
    arm.rotateX(Math.PI / 2);
    arm.translate(pole.x, 2.45, pole.z - 0.6);
    parts.push(arm);
    return mergeGeometries(parts.map((g) => g.toNonIndexed()));
  }, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#0b0b0d", roughness: 0.6 }), []);
  const lampMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffb05a").multiplyScalar(6) }), []);
  return (
    <group>
      <mesh geometry={geo} material={mat} />
      <mesh position={[1.25, 2.38, -2.3]} material={lampMat}><boxGeometry args={[0.32, 0.06, 0.16]} /></mesh>
      <pointLight position={[1.25, 2.2, -2.4]} color="#ffbf7a" intensity={9} distance={14} decay={2} />
    </group>
  );
}

// ---------------------------------------------------------------- rain, as falling streaks between us and the houses
function Rain() {
  const N = 2600;
  const geo = useMemo(() => {
    const r = rng(9), pos = new Float32Array(N * 6), seed = new Float32Array(N * 2), end = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const x = -7 + r() * 15, z = -0.85 - r() * 4.2, s = r();
      pos.set([x, 0, z, x, 0, z], i * 6);
      seed.set([s, s], i * 2);
      end.set([0, 1], i * 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, -3), 20);
    return g;
  }, []);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.75, 0.8, 0.95) } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime; attribute float aSeed; attribute float aEnd; varying float vA;
      void main(){
        vec3 p = position;
        float speed = 8.5 + aSeed * 4.5, H = 12.0, len = 0.32 + aSeed * 0.2;
        p.y = 8.6 - mod(uTime * speed + aSeed * 173.0, H) + aEnd * len;
        p.x += aEnd * len * 0.12;
        vA = 1.0 - aEnd * 0.85;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: "uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor, vA * 0.28); }",
  }), []);
  useFrame(({ clock }) => { mat.uniforms.uTime.value = clock.elapsedTime; });
  return <lineSegments geometry={geo} material={mat} frustumCulled={false} />;
}

// ---------------------------------------------------------------- the street, wet, with the signs' light in it
function Street() {
  const glow = useMemo(() => canvasTexture(1024, 128, (ctx, w, h) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    // streaks under the lit signs and shops (x from -16 to 16 across the texture)
    const at = (x: number) => ((x + 16) / 32) * w;
    for (const [x, c, s] of [[0.6, "255,70,130", 1], [-2.95, "60,230,210", 1], [4.2, "60,210,120", 0.7], [-7.15, "220,230,255", 0.6], [1.25, "255,160,80", 1.2], [8.25, "180,90,255", 0.6], [12.2, "255,190,110", 0.5]] as const) {
      const g = ctx.createRadialGradient(at(x), h * 0.15, 2, at(x), h * 0.4, h * 0.9);
      g.addColorStop(0, `rgba(${c},${0.55 * s})`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(at(x) - 90, 0, 180, h);
    }
  }), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    map: asphaltTexture(),
    color: "#5a5c66",
    roughness: 0.18,
    metalness: 0.2,
    emissive: new THREE.Color("#ffffff"),
    emissiveMap: glow.texture,
    emissiveIntensity: 1.1,
  }), [glow]);
  const ours = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8e9a8c", map: plasterTexture("#ffffff", [3, 1], 29), roughness: 0.95 }), []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, GROUND, (FACADE - 0.72) / 2]} material={mat}><planeGeometry args={[32, -FACADE + 0.72]} /></mesh>
      {/* our own house, below the window */}
      <mesh position={[0, (GROUND + 0.0) / 2 - 0.02, -0.73]} rotation-y={Math.PI} material={ours}><planeGeometry args={[32, -GROUND + 0.1]} /></mesh>
    </group>
  );
}

// ---------------------------------------------------------------- motorbikes going by
type Bike = { on: boolean; x: number; dir: 1 | -1; z: number; v: number; passed: boolean; hue: number };
function Bikes() {
  const pool = useRef<Bike[]>([0, 1, 2].map(() => ({ on: false, x: 0, dir: 1, z: -2.4, v: 7, passed: false, hue: 0 })));
  const refs = useRef<(THREE.Group | null)[]>([]);
  const next = useRef(2);
  const m = useMemo(() => ({
    body: new THREE.MeshStandardMaterial({ color: "#16171b", roughness: 0.5 }),
    rider: new THREE.MeshStandardMaterial({ color: "#2a2c33", roughness: 0.8 }),
    helmets: ["#d13b3b", "#f0c43a", "#2f7de1", "#f2f2f2"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3 })),
    head: new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff3d6").multiplyScalar(8) }),
    tail: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff2a2a").multiplyScalar(5) }),
    pool: new THREE.MeshBasicMaterial({ map: canvasTexture(128, 64, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w * 0.3, h / 2, 2, w * 0.4, h / 2, w * 0.6);
      g.addColorStop(0, "rgba(255,240,210,.7)");
      g.addColorStop(1, "rgba(255,240,210,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }).texture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  }), []);
  useFrame(({ clock }, dt) => {
    const T = clock.elapsedTime;
    if (T > next.current) {
      const b = pool.current.find((p) => !p.on);
      if (b) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        Object.assign(b, { on: true, dir, x: -dir * 17, z: dir > 0 ? -2.6 : -3.7, v: 6 + Math.random() * 4, passed: false, hue: Math.floor(Math.random() * 4) });
      }
      next.current = T + 3 + Math.random() * 7;
    }
    pool.current.forEach((b, i) => {
      const g = refs.current[i];
      if (!g) return;
      g.visible = b.on;
      if (!b.on) return;
      b.x += b.dir * b.v * Math.min(dt, 0.05);
      g.position.set(b.x, GROUND, b.z);
      g.rotation.y = b.dir > 0 ? 0 : Math.PI;
      (g.children[2] as THREE.Mesh).material = m.helmets[b.hue];
      // the sound peaks halfway through its 3.2 s, so it starts while the bike is 1.6 s from the window
      if (!b.passed && b.dir * b.x > -b.v * 1.6) { b.passed = true; sound.bike(b.dir); }
      if (Math.abs(b.x) > 18) b.on = false;
    });
  });
  return (
    <group>
      {pool.current.map((_, i) => (
        <group key={i} ref={(g) => { refs.current[i] = g; }} visible={false}>
          <mesh position={[0, 0.45, 0]} material={m.body}><boxGeometry args={[1.7, 0.5, 0.36]} /></mesh>
          <mesh position={[-0.15, 1.05, 0]} material={m.rider}><boxGeometry args={[0.38, 0.75, 0.42]} /></mesh>
          <mesh position={[-0.12, 1.55, 0]} material={m.helmets[0]}><sphereGeometry args={[0.15, 12, 10]} /></mesh>
          <mesh position={[0.88, 0.72, 0]} material={m.head}><sphereGeometry args={[0.07, 10, 8]} /></mesh>
          <mesh position={[-0.88, 0.62, 0]} material={m.tail}><sphereGeometry args={[0.045, 8, 6]} /></mesh>
          <mesh position={[2.4, 0.02, 0]} rotation-x={-Math.PI / 2} material={m.pool}><planeGeometry args={[3.6, 1.6]} /></mesh>
        </group>
      ))}
    </group>
  );
}

export default function Alley() {
  const m = useFacadeMaterials();
  const terraced = HOUSES[3];
  return (
    <group>
      <Sky />
      <City />
      {HOUSES.map((h, i) => <HouseMesh key={i} h={h} idx={i} m={m} />)}
      <Terrace h={terraced} m={m} />
      <Street />
      <Wires />
      <Rain />
      <Bikes />
      {/* signs, placed where the window frames them */}
      <Sign def={{ text: "Cà Phê", color: "#ff4f8b", w: 2.2, h: 0.85, font: "hand" }} position={[terraced.x0 + terraced.w / 2, GROUND + FLOOR0 + 0.72, FACADE + 0.25]} glow={2.1} />
      <Sign def={{ text: "CƠM TẤM", color: "#3fe6d6", w: 2.6, h: 0.6 }} position={[-2.95, GROUND + FLOOR0 - 0.45, FACADE + 0.3]} glow={2.2} flicker />
      <Sign def={{ text: "TẠP HÓA", color: "#ffffff", w: 2.8, h: 0.6, box: "#f4f6fb", ink: "#1b3d8f" }} position={[-7.15, GROUND + FLOOR0 - 0.4, FACADE + 0.3]} glow={1.6} />
      <Sign def={{ text: "NHÀ THUỐC", color: "#ffffff", w: 2.4, h: 0.5, box: "#1f9d55", ink: "#ffffff" }} position={[4.2, GROUND + FLOOR0 - 0.4, FACADE + 0.3]} glow={1.5} />
      <Sign def={{ text: "✚", color: "#2cff8a", w: 0.8, h: 0.8 }} position={[2.3, GROUND + FLOOR0 + 1.45, FACADE + 0.85]} rotation={[0, 0.6, 0]} glow={3.4} />
      <Sign def={{ text: "KARAOKE", color: "#b65cff", w: 2.4, h: 0.55 }} position={[8.25, GROUND + FLOOR0 + 1.0, FACADE + 0.4]} glow={3} />
    </group>
  );
}
