"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { ParametricGeometry } from "three/addons/geometries/ParametricGeometry.js";
import { clickable } from "../lib/interact";
import { sdRoundBox, sdTrapezoid, smin, smoothstep, surfaceNets, type SDF } from "../lib/sdf";
import { SKY } from "../lib/sky";
import { canvasTexture, rng } from "../lib/textures";
import { useRoom } from "../store";

// The desk chair: a swivel office chair in dark charcoal bouclé. One upholstered shell wraps round the seat: a tall
// back, leaning back a little, its top corners rounded off and its sides sweeping down into thick padded arms, and
// the arms' rounded fronts curving back under into a bowl. A deep cushion sits inside, pressed in between the arms.
// Below, a black gas lift in a polished brass sleeve, a brass five-star base and black twin-wheel casters. It's been
// rolled to the end of the desk and left turned toward it, so nothing on the desk is hidden from the middle of the
// room. A click spins it round once. Its front is -z; all sizes in metres.

// ---------------------------------------------------------------- the shape, as signed distances

// In plan the shell's wall follows a U: straight along each arm, round a corner, and across the back in a gentle arc.
const A = 0.2775, R = 0.0525; // the arms' centre lines (45 cm of seat between them), and half the wall's thickness
const RB = 0.5, RC = 0.14, ZB = 0.2325; // the back's arc and the corners' radii, and where the back's centre line is
const SIN_P = (A - RC) / (RB - RC), PHI = Math.asin(SIN_P);
const C1Z = ZB - RB, C2X = (RB - RC) * SIN_P, C2Z = C1Z + (RB - RC) * Math.cos(PHI);
const LB = RB * PHI, S_ARM = LB + RC * (Math.PI / 2 - PHI);

/** where a point (|x|, z) is against the U: `s`, how far along it from the middle of the back, and `n`, how far out
 * from it (negative inside) */
const U = { s: 0, n: 0 };
function alongU(ax: number, z: number) {
  let best = Infinity;
  // across the back
  let dx = ax, dz = z - C1Z, th = Math.atan2(dx, dz);
  if (th <= PHI) {
    const n = Math.hypot(dx, dz) - RB;
    best = Math.abs(n);
    U.s = RB * th;
    U.n = n;
  }
  // round the corner
  dx = ax - C2X;
  dz = z - C2Z;
  th = Math.atan2(dx, dz);
  if (th >= PHI && th <= Math.PI / 2) {
    const n = Math.hypot(dx, dz) - RC;
    if (Math.abs(n) < best) {
      best = Math.abs(n);
      U.s = LB + RC * (th - PHI);
      U.n = n;
    }
  }
  // along the arm
  if (z <= C2Z && Math.abs(ax - A) < best) {
    best = Math.abs(ax - A);
    U.s = S_ARM + C2Z - z;
    U.n = ax - A;
  }
  if (best === Infinity) {
    U.s = S_ARM;
    U.n = Math.hypot(ax - A, z - C2Z);
  }
}

// The wall's outline, unrolled along the U (s, y): the back is a trapezoid whose top corners round off and whose
// sides slope down and out into the arm, a long low box whose front top corner rounds over and whose front bottom
// curves back under. The wall is everything within R of that outline, so its edges are round all over.
const BACK = { yc: 0.636, he: 0.166, r1: 0.4, r2: 0.25, round: 0.07 };
const ARM = { s0: 0.3, s1: S_ARM + C2Z + 0.2225, y0: 0.4, y1: 0.6125 }; // its nose comes to z = -0.275, its top to 0.665
const ARM_C = { s: (ARM.s0 + ARM.s1) / 2, y: (ARM.y0 + ARM.y1) / 2, hs: (ARM.s1 - ARM.s0) / 2, hy: (ARM.y1 - ARM.y0) / 2 };
const ARM_CORNERS = [0.035, 0.09, 0, 0] as const;
function outline(s: number, y: number) {
  const back = sdTrapezoid(s, y - BACK.yc, BACK.r1, BACK.r2, BACK.he) - BACK.round;
  const arm = sdRoundBox(s - ARM_C.s, y - ARM_C.y, ARM_C.hs, ARM_C.hy, ARM_CORNERS);
  return smin(back, arm, 0.07);
}

const RECLINE = Math.tan((8 * Math.PI) / 180);
function wall(x: number, y: number, z: number) {
  // the back leans back above the seat; the arms stand straight
  alongU(Math.abs(x), z - RECLINE * Math.max(0, y - 0.45) * smoothstep(-0.12, 0.2, z));
  const o = outline(U.s, y), out = Math.max(o, 0);
  // the padding swells a little away from the edges
  return Math.sqrt(out * out + U.n * U.n) - (R + 0.006 * smoothstep(0, -0.07, o));
}

/** the shell: the wall, flowing into a shallow bowl under the seat that closes it at the front, under the cushion */
const shell: SDF = (x, y, z) => {
  const w = wall(x, y, z);
  const region = Math.max(U.n + 0.03, -0.17 - z), out = Math.max(region, 0), dy = y - 0.405;
  return smin(w, Math.sqrt(out * out + dy * dy) - 0.055, 0.05);
};

/** the seat cushion: a deep pad with a round (bullnose) front edge, filling the U and pressing a centimetre into its
 * sides. The front bows out a little, the top slopes back a little and crowns in the middle, the underside is flat. */
const cushion: SDF = (x, y, z) => {
  alongU(Math.abs(x), z);
  const front = -0.235 - 0.01 * Math.max(0, 1 - (x / 0.22) ** 2);
  const region = Math.max(U.n + 0.0955, front - z), out = Math.max(region, 0);
  const top = 0.48 - 0.05 * (z + 0.29) + 0.012 * smoothstep(0, -0.12, region), bottom = 0.375;
  const dy = y - (top + bottom) / 2;
  return Math.sqrt(out * out + dy * dy) - (top - bottom) / 2;
};

// ---------------------------------------------------------------- the base

/** a spoke, along +z from inside the hub to the caster's socket: a flat bar with round edges, slimmer toward its tip,
 * curving gently down */
function spokeGeometry() {
  return new ParametricGeometry((u, v, out) => {
    const t = v, m = 1 - t, a = u * Math.PI * 2;
    const r = m * m * 0.03 + 2 * m * t * 0.17 + t * t * 0.29, y = m * m * 0.1 + 2 * m * t * 0.1 + t * t * 0.072;
    const tr = 2 * m * 0.14 + 2 * t * 0.12, ty = -2 * t * 0.028, l = Math.hypot(tr, ty);
    const c = Math.cos(a), s = Math.sin(a);
    const ex = Math.sign(c) * Math.sqrt(Math.abs(c)), ey = Math.sign(s) * Math.sqrt(Math.abs(s));
    const w = 0.019 - 0.0065 * t, hh = 0.0125 - 0.0035 * t;
    out.set(ex * w, y + (ey * hh * tr) / l, r - (ey * hh * ty) / l);
  }, 20, 12);
}

const lathe = (pts: number[][], segments = 32) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segments);
const HUB = [[0, 0.068], [0.034, 0.068], [0.041, 0.071], [0.045, 0.079], [0.046, 0.09], [0.046, 0.106], [0.043, 0.114], [0.036, 0.12], [0.029, 0.123], [0, 0.123]];
const SLEEVE = [[0, 0.12], [0.028, 0.12], [0.029, 0.124], [0.0285, 0.13], [0.0258, 0.133], [0.0255, 0.24], [0, 0.24]];
const COLLAR = [[0.0145, 0.238], [0.028, 0.238], [0.0312, 0.241], [0.032, 0.248], [0.0312, 0.255], [0.028, 0.258], [0.0145, 0.258]];
const SOCKET = [[0, 0.05], [0.0122, 0.05], [0.0135, 0.0525], [0.0135, 0.083], [0.0125, 0.087], [0.009, 0.089], [0, 0.0895]];

/** one wheel of a twin-wheel caster: half of a 56 mm ball, along +x, with a thin gap at the middle */
function wheelGeometry() {
  const b = 0.028, pts = [[0.006, 0.003]];
  for (let i = 0; i <= 6; i++) {
    const y = 0.003 + (0.0185 * i) / 6;
    pts.push([Math.sqrt(b * b - y * y) - 0.0005, y]);
  }
  pts.push([0.008, 0.0215], [0, 0.0215]);
  return lathe(pts, 16).rotateZ(-Math.PI / 2);
}
const CASTER_TURN = [0.4, 2.1, -1.2, 3, 1.1];

// ---------------------------------------------------------------- the materials

/** bouclé: little curls of yarn crowded together, as a tiling height map (bright = standing up) */
function loopsTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const r = rng(23);
    ctx.fillStyle = "#4a4a4a";
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = "round";
    for (let i = 0; i < 1400; i++) {
      // each curl a little squashed and turned its own way, and seldom a full circle
      const x = r() * w, y = r() * h, rad = 3.5 + r() * 3.5, squash = 0.5 + r() * 0.5, turn = r() * Math.PI;
      const a0 = r() * Math.PI * 2, sweep = Math.PI * (1.1 + r() * 0.9);
      const c = Math.round(150 + r() * 105);
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
        const cx = x + ox, cy = y + oy;
        if (cx < -12 || cx > w + 12 || cy < -12 || cy > h + 12) continue;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rad, rad * squash, turn, a0, a0 + sweep);
        // a shadow round each curl, then the yarn
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = 4.4;
        ctx.stroke();
        ctx.strokeStyle = `rgb(${c},${c},${c})`;
        ctx.lineWidth = 2.3;
        ctx.stroke();
      }
    }
  }, { color: false, repeat: [1, 1] }).texture;
}

/** the bouclé fabric. The curls go on from all three sides at once, blended by which way the surface faces (the shell
 * has no texture coordinates), every 14 cm: they bump the surface (a bump map worked out in millimetres, so it reads
 * the same near and far) and shade it, the crevices darker and the curls' tops lighter. A soft sheen at the edges. */
function boucle(color: string) {
  const loops = loopsTexture();
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.95, sheen: 0.45, sheenColor: new THREE.Color("#7b756d"), sheenRoughness: 0.8 });
  m.onBeforeCompile = (s) => {
    s.uniforms.uLoops = { value: loops };
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLoopP;\nvarying vec3 vLoopN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLoopP = position;\nvLoopN = normal;");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", `#include <common>
        uniform sampler2D uLoops;
        varying vec3 vLoopP;
        varying vec3 vLoopN;
        float loopsAt(vec3 p, vec3 w) {
          return texture2D(uLoops, p.zy * 7.0).r * w.x + texture2D(uLoops, p.xz * 7.0 + 0.37).r * w.y + texture2D(uLoops, p.xy * 7.0 + 0.71).r * w.z;
        }`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec3 loopW = pow(abs(normalize(vLoopN)), vec3(4.0));
        loopW /= loopW.x + loopW.y + loopW.z;
        float loopH = loopsAt(vLoopP, loopW);
        float loopHx = loopsAt(vLoopP + dFdx(vLoopP), loopW);
        float loopHy = loopsAt(vLoopP + dFdy(vLoopP), loopW);
        diffuseColor.rgb *= mix(0.4, 1.6, loopH);`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        {
          vec3 sx = dFdx(-vViewPosition) * 1000.0, sy = dFdy(-vViewPosition) * 1000.0;
          vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
          float det = dot(sx, r1) * faceDirection;
          vec3 grad = sign(det) * 1.5 * ((loopHx - loopH) * r1 + (loopHy - loopH) * r2);
          normal = normalize(abs(det) * normal - grad);
        }`);
  };
  m.customProgramCacheKey = () => "boucle";
  return m;
}

/** what the brass and the black steel see round them: a soft picture of the room, the ceiling and walls pale, the floor
 * darker, and the windows bright across the front and down the sides. (The scene has no environment of its own, and
 * polished metal with nothing to reflect goes dull brown.) three.js blurs it to suit each finish. */
function roomGlow() {
  const { texture } = canvasTexture(256, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#e6e0d6");
    g.addColorStop(0.42, "#d8d1c6");
    g.addColorStop(0.5, "#a39b90");
    g.addColorStop(0.56, "#7c766f");
    g.addColorStop(1, "#3f3b37");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // u = 0.25 looks to the front (-z), 0.5 to +x, 0 and 1 to -x
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(w * 0.08, h * 0.16, w * 0.5, h * 0.33);
    ctx.fillRect(w * 0.94, h * 0.16, w * 0.06, h * 0.33);
    ctx.fillRect(0, h * 0.16, w * 0.02, h * 0.33);
  });
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}

const SHELL_BOX = [-0.36, 0.32, -0.32, 0.36, 0.96, 0.39];
const CUSHION_BOX = [-0.27, 0.355, -0.33, 0.27, 0.515, 0.22];

export default function Chair() {
  const m = useMemo(() => {
    const env = roomGlow();
    return {
      boucle: boucle("#33302c"),
      brass: new THREE.MeshStandardMaterial({ color: "#d1ab66", roughness: 0.22, metalness: 1, envMap: env }),
      steel: new THREE.MeshStandardMaterial({ color: "#26272a", roughness: 0.3, metalness: 0.85, envMap: env }),
      plastic: new THREE.MeshStandardMaterial({ color: "#151517", roughness: 0.42 }),
    };
  }, []);
  // meshing the shell and the cushion takes about 30 ms, once (about 32k triangles; the base adds 8k)
  const g = useMemo(() => {
    return {
      shell: surfaceNets(shell, SHELL_BOX, 0.0125, cushion),
      cushion: surfaceNets(cushion, CUSHION_BOX, 0.011, shell),
      spoke: spokeGeometry(),
      hub: lathe(HUB),
      sleeve: lathe(SLEEVE),
      collar: lathe(COLLAR),
      socket: lathe(SOCKET, 16),
      wheel: wheelGeometry(),
    };
  }, []);
  const top = useRef<THREE.Group>(null), spin = useRef(-1);
  useFrame((_, dt) => {
    // the metal reflects the room as bright as the room is
    m.brass.envMapIntensity = m.steel.envMapIntensity = 0.12 + 0.55 * SKY.winK + (useRoom.getState().lamp ? 0.2 * SKY.night : 0);
    const o = top.current;
    if (!o || spin.current < 0) return;
    spin.current = Math.min(1, spin.current + dt / 1.4);
    const k = spin.current, e = 1 - Math.pow(1 - k, 3);
    o.rotation.y = e * Math.PI * 2;
    if (k >= 1) {
      o.rotation.y = 0;
      spin.current = -1;
    }
  });
  return (
    <group position={[1.85, 0, -1.25]} rotation-y={0.86}>
      {/* the base: a brass hub, sleeve and collar, five brass spokes, and the casters, each swivelled its own way */}
      <mesh geometry={g.hub} castShadow material={m.brass} />
      <mesh geometry={g.sleeve} castShadow material={m.brass} />
      <mesh geometry={g.collar} castShadow material={m.brass} />
      {CASTER_TURN.map((turn, k) => (
        <group key={k} rotation-y={(k / 5) * Math.PI * 2}>
          <mesh geometry={g.spoke} castShadow material={m.brass} />
          <mesh geometry={g.socket} position={[0, 0, 0.29]} castShadow material={m.brass} />
          <group position={[0, 0, 0.29]} rotation-y={turn}>
            <group position={[0, 0.028, 0.014]}>
              <mesh geometry={g.wheel} castShadow material={m.plastic} />
              <mesh geometry={g.wheel} rotation-y={Math.PI} castShadow material={m.plastic} />
              <mesh rotation-z={Math.PI / 2} material={m.plastic}><cylinderGeometry args={[0.019, 0.019, 0.007, 16]} /></mesh>
            </group>
          </group>
        </group>
      ))}
      {/* everything above the collar turns */}
      <group ref={top} {...clickable("CHAIR · GIVE IT A SPIN", () => { if (spin.current < 0) spin.current = 0; })}>
        <mesh position={[0, 0.31, 0]} castShadow material={m.steel}><cylinderGeometry args={[0.0145, 0.0145, 0.12, 24]} /></mesh>
        <mesh geometry={g.shell} castShadow receiveShadow material={m.boucle} />
        <mesh geometry={g.cushion} castShadow receiveShadow material={m.boucle} />
      </group>
    </group>
  );
}
