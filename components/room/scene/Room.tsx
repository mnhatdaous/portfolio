"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { BACK_LABEL, clickable, clickOutside, solid } from "../lib/interact";
import { concreteTexture, plasterTexture, rugTexture } from "../lib/textures";
import { soft } from "../lib/shapes";
import { useRoom } from "../store";

// The study: one room on a hill above the lake. Over the desk the glass runs corner to corner and on up into a glazed
// roof between slim black steel rafters, like a sunroom; the side windows run back to the middle of the room, their tops
// climbing with the roof. From the middle the view fills half the circle and the sky shows overhead; the back half of
// the room is walls under a flat ceiling, with the board, the bookshelf, the pictures and the door.
// Metres; y up; the window wall is at z = -2.3 and the camera starts in the middle, facing it.
export const ROOM = { x0: -3.2, x1: 3.2, z0: -2.3, z1: 3.3, h: 3.35 };
/** the walls are this thick, built outward from the room's inner faces */
export const WALL_T = 0.16;
/** the big window's sill; the side windows start lower and run back to z = sideZ1 */
export const WIN = { y0: 0.8, sideY0: 0.5, sideZ1: 0.35 };
/** the glass roof: it rises from the eave over the big window, `pitch` from level, until it meets the flat ceiling */
export const ROOF = { eave: 2.3, pitch: THREE.MathUtils.degToRad(38) };
const TAN = Math.tan(ROOF.pitch), COS = Math.cos(ROOF.pitch), SIN = Math.sin(ROOF.pitch);
/** where the slope meets the flat ceiling */
export const ROOF_Z = ROOM.z0 + (ROOM.h - ROOF.eave) / TAN;
/** the glass overhead at z: on the slope, or the flat ceiling behind it */
export const roofAt = (z: number) => Math.min(ROOM.h, ROOF.eave + (z - ROOM.z0) * TAN);

type V3 = [number, number, number];
const W = ROOM.x1 - ROOM.x0, D = ROOM.z1 - ROOM.z0, H = ROOM.h, T = WALL_T, CZ = (ROOM.z0 + ROOM.z1) / 2;
const SIDE_LEN = WIN.sideZ1 - ROOM.z0, BACK_LEN = ROOM.z1 + T - WIN.sideZ1, SIDE_MID = (ROOM.z0 + WIN.sideZ1) / 2;
const SIDES = [-1, 1].map((s) => ({ s, x: s < 0 ? ROOM.x0 - T / 2 : ROOM.x1 + T / 2 }));

/** wall pieces around the windows, and the size of the face each shows the room (for the plaster's scale) */
const WALLS: { p: V3; s: V3; face: [number, number] }[] = [
  { p: [0, WIN.y0 / 2, ROOM.z0 - T / 2], s: [W + 2 * T, WIN.y0, T], face: [W, WIN.y0] },
  ...SIDES.flatMap(({ x }) => [
    { p: [x, WIN.sideY0 / 2, SIDE_MID] as V3, s: [T, WIN.sideY0, SIDE_LEN] as V3, face: [SIDE_LEN, WIN.sideY0] as [number, number] },
    { p: [x, H / 2, WIN.sideZ1 + BACK_LEN / 2] as V3, s: [T, H, BACK_LEN] as V3, face: [BACK_LEN, H] as [number, number] },
  ]),
  { p: [0, H / 2, ROOM.z1 + T / 2], s: [W + 2 * T, H, T], face: [W, H] },
];

type Box = { p: V3; s: V3; rx?: number };
// ---------------------------------------------------------------- thin black steel frames, stone sills, the roof's bones
// the rafters, and the big window's mullions under them, line up across the room
const RAFTER_X = [ROOM.x0 + 0.02, -2.08, -0.95, 0.95, 2.08, ROOM.x1 - 0.02];
const RAFTER_D = 0.07, SLOPE = (ROOF_Z - ROOM.z0) / COS;
/** a point on the glass line at z, moved `d` in from the glass (toward the room) */
const under = (z: number, d: number): [number, number] => [ROOF.eave + (z - ROOM.z0) * TAN - d * COS, z + d * SIN];
/** the purlin across the middle of the slope; the pendant over the desk hangs from it */
const PURLIN_Z = -1.7;
export const HANG = { y: under(PURLIN_Z, RAFTER_D)[0], z: under(PURLIN_Z, RAFTER_D)[1] };

const SILLS: Box[] = [
  { p: [0, WIN.y0 + 0.012, ROOM.z0 - T / 2 + 0.015], s: [W, 0.024, T + 0.03] },
  ...SIDES.map(({ s, x }) => ({ p: [x - s * 0.015, WIN.sideY0 + 0.012, SIDE_MID] as V3, s: [T + 0.03, 0.024, SIDE_LEN] as V3 })),
];
const FRAMES: Box[] = [
  // the big window: a thin transom at the eave where the roof starts, mullions under the rafters, a rail along the sill
  { p: [0, ROOF.eave, ROOM.z0 - T / 2], s: [W + 2 * T, 0.045, 0.1] },
  ...RAFTER_X.slice(1, -1).map((x) => ({ p: [x, (WIN.y0 + 0.049 + ROOF.eave - 0.0225) / 2, ROOM.z0 - T / 2] as V3, s: [0.028, ROOF.eave - 0.0225 - WIN.y0 - 0.049, 0.05] as V3 })),
  { p: [0, WIN.y0 + 0.024 + 0.0125, ROOM.z0 - T / 2], s: [W, 0.025, 0.05] },
  // the roof: rafters up the slope, the purlin across it, a beam where it meets the ceiling
  ...RAFTER_X.map((x) => {
    const [y, z] = under((ROOM.z0 + ROOF_Z) / 2, RAFTER_D / 2);
    return { p: [x, y, z] as V3, s: [0.03, RAFTER_D, SLOPE] as V3, rx: -ROOF.pitch };
  }),
  (() => {
    const [y, z] = under(PURLIN_Z, RAFTER_D / 2);
    return { p: [0, y, z] as V3, s: [W - 0.06, RAFTER_D, 0.03] as V3, rx: -ROOF.pitch };
  })(),
  { p: [0, H - 0.03, ROOF_Z], s: [W + 2 * T, 0.06, 0.08] },
  // the side windows: a post in the front corner, mullions, a post at the back, a rail along the sill, a plate under
  // the flat ceiling (the edge rafter carries the sloped top)
  ...SIDES.flatMap(({ s, x }) => [
    // the corner post stands 1 cm proud of the wall under the big window: that wall's end shows through the side
    // window below the big sill, and on the same plane the two would flicker
    { p: [s < 0 ? ROOM.x0 - 0.025 : ROOM.x1 + 0.025, (WIN.sideY0 + ROOF.eave) / 2, ROOM.z0 - 0.02] as V3, s: [0.05, ROOF.eave - WIN.sideY0, 0.06] as V3 },
    ...[ROOM.z0 + SIDE_LEN / 3, ROOM.z0 + (2 * SIDE_LEN) / 3].map((z) => ({ p: [x, (WIN.sideY0 + roofAt(z)) / 2, z] as V3, s: [0.04, roofAt(z) - WIN.sideY0, 0.028] as V3 })),
    { p: [x, (WIN.sideY0 + H) / 2, WIN.sideZ1 - 0.0125] as V3, s: [0.04, H - WIN.sideY0, 0.025] as V3 },
    { p: [x, WIN.sideY0 + 0.024 + 0.0125, SIDE_MID] as V3, s: [0.04, 0.025, SIDE_LEN] as V3 },
    { p: [x, H - 0.0175, (ROOF_Z + WIN.sideZ1) / 2] as V3, s: [0.04, 0.035, WIN.sideZ1 - ROOF_Z] as V3 },
  ]),
];

/** skirting boards along the solid walls */
const SKIRTING: Box[] = [
  { p: [0, 0.035, ROOM.z1 - 0.008], s: [W, 0.07, 0.016] },
  { p: [0, 0.035, ROOM.z0 + 0.008], s: [W, 0.07, 0.016] },
  ...SIDES.map(({ s }) => ({ p: [s < 0 ? ROOM.x0 + 0.008 : ROOM.x1 - 0.008, 0.035, (WIN.sideZ1 + ROOM.z1) / 2] as V3, s: [0.016, 0.07, ROOM.z1 - WIN.sideZ1] as V3 })),
];

/** the side windows' glass: from the sill up to the slope, then level under the flat ceiling (in the wall's z, y) */
function sideGlass() {
  const g = new THREE.Shape();
  g.moveTo(ROOM.z0, WIN.sideY0);
  g.lineTo(WIN.sideZ1, WIN.sideY0);
  g.lineTo(WIN.sideZ1, H);
  g.lineTo(ROOF_Z, H);
  g.lineTo(ROOM.z0, ROOF.eave);
  g.closePath();
  return new THREE.ShapeGeometry(g);
}

function repeated(t: THREE.Texture, rx: number, ry: number) {
  const c = t.clone();
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(rx, ry);
  c.needsUpdate = true;
  return c;
}

export default function Room() {
  const m = useMemo(() => {
    const plaster = plasterTexture("#efe7da", [1, 1], 7);
    return {
      walls: WALLS.map((w) => new THREE.MeshStandardMaterial({ map: repeated(plaster, w.face[0] / 1.4, w.face[1] / 1.4), roughness: 0.95 })),
      floor: new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.42 }),
      ceil: new THREE.MeshStandardMaterial({ color: "#f2ebe0", roughness: 1 }),
      trim: new THREE.MeshStandardMaterial({ color: "#f3f0ea", roughness: 0.75 }),
      stone: new THREE.MeshStandardMaterial({ color: "#d9d6cf", roughness: 0.45 }),
      frame: new THREE.MeshStandardMaterial({ color: "#1f2124", roughness: 0.4, metalness: 0.55 }),
      glass: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.025, depthWrite: false, side: THREE.DoubleSide }),
      rug: new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 0.95 }),
      door: new THREE.MeshStandardMaterial({ color: "#4a4d52", roughness: 0.6 }),
      brass: new THREE.MeshStandardMaterial({ color: "#1f2124", roughness: 0.38, metalness: 0.6 }),
    };
  }, []);
  const side = useMemo(sideGlass, []);
  // at home the glass takes you to the window; from anywhere else a click on the view is a click outside
  const lookOut = clickable(
    () => (useRoom.getState().page === "home" ? "LOOK OUTSIDE" : BACK_LABEL),
    () => (useRoom.getState().page === "home" ? useRoom.getState().go("window") : clickOutside()),
  );

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, CZ]} receiveShadow material={m.floor} {...solid}>
        <planeGeometry args={[W, D]} />
      </mesh>
      {/* the flat ceiling over the back of the room is a slab, so the sun only comes in through the glass */}
      <mesh position={[0, H + 0.06, (ROOF_Z + ROOM.z1 + T) / 2]} castShadow receiveShadow material={m.ceil}>
        <boxGeometry args={[W + 2 * T, 0.12, ROOM.z1 + T - ROOF_Z]} />
      </mesh>
      {WALLS.map((w, i) => (
        <mesh key={i} position={w.p} castShadow receiveShadow material={m.walls[i]} {...solid}>
          <boxGeometry args={w.s} />
        </mesh>
      ))}
      {([[SKIRTING, m.trim], [SILLS, m.stone], [FRAMES, m.frame]] as const).flatMap(([boxes, mat], k) =>
        boxes.map((b: Box, i) => (
          <mesh key={`${k}-${i}`} position={b.p} rotation-x={b.rx ?? 0} castShadow receiveShadow material={mat}>
            <primitive object={soft(...b.s)} attach="geometry" />
          </mesh>
        )),
      )}

      {/* the glass: barely there, but it's what a click on the view lands on */}
      <group {...lookOut}>
        <mesh position={[0, (WIN.y0 + ROOF.eave) / 2, ROOM.z0 - T / 2]} material={m.glass}>
          <planeGeometry args={[W, ROOF.eave - WIN.y0]} />
        </mesh>
        <mesh position={[0, (ROOF.eave + H) / 2, (ROOM.z0 + ROOF_Z) / 2]} rotation-x={Math.PI / 2 - ROOF.pitch} material={m.glass}>
          <planeGeometry args={[W, SLOPE]} />
        </mesh>
        {SIDES.map(({ s, x }) => (
          <mesh key={s} position={[x, 0, 0]} rotation-y={-Math.PI / 2} geometry={side} material={m.glass} />
        ))}
      </group>

      <mesh rotation-x={-Math.PI / 2} position={[0, 0.003, 0.75]} receiveShadow material={m.rug}>
        <planeGeometry args={[3.2, 2.2]} />
      </mesh>

      <Door m={m} />
      <Chair />
    </group>
  );
}

/** the way out, in the back wall: a charcoal door in a white casing, the light switch beside it */
function Door({ m }: { m: { trim: THREE.Material; door: THREE.Material; brass: THREE.Material } }) {
  const x = 1.9, w = 0.86, h = 2.05, z = ROOM.z1;
  return (
    <group>
      <mesh position={[x, h / 2, z - 0.014]} castShadow receiveShadow material={m.door}><primitive object={soft(w, h, 0.03)} attach="geometry" /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[x + s * (w / 2 + 0.03), h / 2 + 0.03, z - 0.012]} castShadow material={m.trim}><primitive object={soft(0.06, h + 0.06, 0.026)} attach="geometry" /></mesh>
      ))}
      <mesh position={[x, h + 0.06, z - 0.012]} castShadow material={m.trim}><primitive object={soft(w + 0.12, 0.06, 0.026)} attach="geometry" /></mesh>
      <mesh position={[x - w / 2 + 0.08, 1.02, z - 0.045]} rotation-z={Math.PI / 2} castShadow material={m.brass}>
        <cylinderGeometry args={[0.009, 0.009, 0.12, 12]} />
      </mesh>
      <mesh position={[x - w / 2 + 0.08 - 0.05, 1.02, z - 0.035]} rotation-x={Math.PI / 2} material={m.brass}>
        <cylinderGeometry args={[0.022, 0.022, 0.012, 20]} />
      </mesh>
      {/* the light switch, on the handle side */}
      <mesh position={[x - w / 2 - 0.2, 1.15, z - 0.005]} castShadow material={m.trim}><primitive object={soft(0.08, 0.12, 0.01, 0.004)} attach="geometry" /></mesh>
      <mesh position={[x - w / 2 - 0.2, 1.15, z - 0.0115]} rotation-x={0.06} material={m.trim}><primitive object={soft(0.034, 0.056, 0.006, 0.002)} attach="geometry" /></mesh>
    </group>
  );
}

/** a soft cushion: a rounded unit box stretched to size, so the corners round broadly across the face and gently
 * at the edges */
const pillow = (w: number, h: number, d: number, k = 0.25) => new RoundedBoxGeometry(1, 1, 1, 5, k).scale(w, h, d);

/** the desk chair: a velvet barrel chair, its back curving round the seat in plump channel-tufted pleats that step down
 * into arms, on a brushed brass five-star base. It's been rolled to the end of the desk and left turned toward it, so
 * nothing on the desk is hidden from the middle of the room. A click spins it round once. Its front is -z. */
const SEAT_Y = 0.47;
const CHANNELS = Array.from({ length: 11 }, (_, i) => {
  const a = -1.85 + (i / 10) * 3.7, h = 0.17 + 0.19 * Math.pow(Math.cos(a * 0.62), 2);
  return { a, h };
});

function Chair() {
  const m = useMemo(() => ({
    velvet: new THREE.MeshPhysicalMaterial({ color: "#3d5a47", roughness: 0.8, sheen: 1, sheenColor: new THREE.Color("#a9c9ad"), sheenRoughness: 0.35 }),
    brass: new THREE.MeshStandardMaterial({ color: "#c2a061", roughness: 0.28, metalness: 0.9 }),
    black: new THREE.MeshStandardMaterial({ color: "#1b1d20", roughness: 0.45, metalness: 0.3 }),
  }), []);
  const g = useMemo(() => ({
    seat: pillow(0.5, 0.11, 0.48, 0.3),
    channel: (h: number) => new THREE.CapsuleGeometry(0.044, Math.max(0.01, h - 0.088), 6, 14),
  }), []);
  const channels = useMemo(() => CHANNELS.map((c) => ({ ...c, geo: g.channel(c.h) })), [g]);
  const top = useRef<THREE.Group>(null), spin = useRef(-1);
  useFrame((_, dt) => {
    const o = top.current;
    if (!o || spin.current < 0) return;
    spin.current = Math.min(1, spin.current + dt / 1.4);
    const k = spin.current, e = 1 - Math.pow(1 - k, 3);
    o.rotation.y = e * Math.PI * 2;
    if (k >= 1) { o.rotation.y = 0; spin.current = -1; }
  });
  return (
    <group position={[1.85, 0, -1.25]} rotation-y={0.86}>
      {/* the base: five brass spokes on black casters, a slim brass column */}
      {[0, 1, 2, 3, 4].map((k) => (
        <group key={k} rotation-y={(k / 5) * Math.PI * 2}>
          <mesh position={[0, 0.07, 0.15]} rotation-x={0.1} castShadow material={m.brass}><primitive object={soft(0.03, 0.022, 0.3, 0.01)} attach="geometry" /></mesh>
          <mesh position={[0, 0.026, 0.3]} castShadow material={m.black}><sphereGeometry args={[0.026, 14, 10]} /></mesh>
        </group>
      ))}
      <mesh position={[0, 0.085, 0]} castShadow material={m.brass}><cylinderGeometry args={[0.04, 0.045, 0.04, 24]} /></mesh>
      <mesh position={[0, 0.25, 0]} castShadow material={m.brass}><cylinderGeometry args={[0.02, 0.02, 0.3, 16]} /></mesh>
      {/* everything above the column turns */}
      <group ref={top} {...clickable("CHAIR · GIVE IT A SPIN", () => { if (spin.current < 0) spin.current = 0; })}>
        <mesh position={[0, 0.4, 0]} castShadow material={m.velvet}><cylinderGeometry args={[0.25, 0.22, 0.08, 40]} /></mesh>
        <mesh geometry={g.seat} position={[0, SEAT_Y, -0.01]} castShadow receiveShadow material={m.velvet} />
        {channels.map((c, i) => (
          // each pleat stands on the seat's rim and leans back a little, the tall ones at the back
          <group key={i} rotation-y={c.a}>
            <mesh geometry={c.geo} position={[0, SEAT_Y - 0.02 + c.h / 2, 0.235]} rotation-x={0.14} castShadow receiveShadow material={m.velvet} />
          </group>
        ))}
      </group>
    </group>
  );
}
