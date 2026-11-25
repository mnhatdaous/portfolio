"use client";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { ParametricGeometry } from "three/addons/geometries/ParametricGeometry.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { BACK_LABEL, clickable, clickOutside, solid } from "../lib/interact";
import { concreteTexture, plasterTexture, rugTexture } from "../lib/textures";
import { soft } from "../lib/shapes";
import { useRoom } from "../store";

// The study: one room on a hill above the lake. Over the desk the glass runs corner to corner and on up into a glazed
// roof between slim black steel rafters, like a sunroom; the side windows, on the same sill, run back to the middle of
// the room, their tops climbing with the roof. From the middle the view fills half the circle and the sky shows overhead; the back half of
// the room is walls under a flat ceiling, with the board, the bookshelf, the pictures and the door.
// Metres; y up; the window wall is at z = -2.3 and the camera starts in the middle, facing it.
export const ROOM = { x0: -3.2, x1: 3.2, z0: -2.3, z1: 3.3, h: 3.35 };
/** the walls are this thick, built outward from the room's inner faces */
export const WALL_T = 0.16;
/** the windows' sill, the big window's and the side windows' alike; the side windows run back to z = sideZ1 */
export const WIN = { y0: 0.8, sideY0: 0.8, sideZ1: 0.35 };
/** the glass roof: it rises from the eave over the big window, `pitch` from level, until it meets the flat ceiling */
export const ROOF = { eave: 2.3, pitch: THREE.MathUtils.degToRad(38) };
const TAN = Math.tan(ROOF.pitch), COS = Math.cos(ROOF.pitch), SIN = Math.sin(ROOF.pitch);
/** the glass stands in the middle of the walls' thickness: the big window's at GLASS_Z, the side windows' at ±GLASS_X;
 * the roof glass starts from the top of the big window's */
export const GLASS_Z = ROOM.z0 - WALL_T / 2, GLASS_X = ROOM.x1 + WALL_T / 2;
/** where the slope meets the flat ceiling */
export const ROOF_Z = GLASS_Z + (ROOM.h - ROOF.eave) / TAN;
/** the glass overhead at z: on the slope, or the flat ceiling behind it */
export const roofAt = (z: number) => Math.min(ROOM.h, ROOF.eave + (z - GLASS_Z) * TAN);

type V3 = [number, number, number];
const W = ROOM.x1 - ROOM.x0, D = ROOM.z1 - ROOM.z0, H = ROOM.h, T = WALL_T, CZ = (ROOM.z0 + ROOM.z1) / 2;
const SIDE_LEN = WIN.sideZ1 - ROOM.z0, BACK_LEN = ROOM.z1 + T - WIN.sideZ1, SIDE_MID = (ROOM.z0 + WIN.sideZ1) / 2;
const SIDES = [-1, 1].map((s) => ({ s, x: s * GLASS_X }));

/** the door in the back wall, in an opening lined with a jamb on both sides and across the top */
export const DOOR = { x: 1.9, w: 0.86, h: 2.05, jamb: 0.025 };
const OPEN = { x0: DOOR.x - DOOR.w / 2 - DOOR.jamb, x1: DOOR.x + DOOR.w / 2 + DOOR.jamb, h: DOOR.h + DOOR.jamb };
/** the casing round the opening on the room side: a leg either side down to the floor and a head across them, each
 * lapping `lap` over the jamb */
const CASING = { w: 0.06, d: 0.02, lap: 0.005 };
const CASE_X0 = OPEN.x0 + CASING.lap - CASING.w, CASE_X1 = OPEN.x1 - CASING.lap + CASING.w;

/** wall pieces around the windows and the door, and the size of the face each shows the room (for the plaster's scale) */
const WALLS: { p: V3; s: V3; face: [number, number] }[] = [
  { p: [0, WIN.y0 / 2, GLASS_Z], s: [W + 2 * T, WIN.y0, T], face: [W, WIN.y0] },
  ...SIDES.flatMap(({ x }) => [
    { p: [x, WIN.sideY0 / 2, SIDE_MID] as V3, s: [T, WIN.sideY0, SIDE_LEN] as V3, face: [SIDE_LEN, WIN.sideY0] as [number, number] },
    { p: [x, H / 2, WIN.sideZ1 + BACK_LEN / 2] as V3, s: [T, H, BACK_LEN] as V3, face: [BACK_LEN, H] as [number, number] },
  ]),
  // the back wall: either side of the door's opening, and over it
  { p: [(ROOM.x0 - T + OPEN.x0) / 2, H / 2, ROOM.z1 + T / 2], s: [OPEN.x0 - ROOM.x0 + T, H, T], face: [OPEN.x0 - ROOM.x0, H] },
  { p: [(OPEN.x1 + ROOM.x1 + T) / 2, H / 2, ROOM.z1 + T / 2], s: [ROOM.x1 + T - OPEN.x1, H, T], face: [ROOM.x1 - OPEN.x1, H] },
  { p: [DOOR.x, (OPEN.h + H) / 2, ROOM.z1 + T / 2], s: [OPEN.x1 - OPEN.x0, H - OPEN.h, T], face: [OPEN.x1 - OPEN.x0, H - OPEN.h] },
];

type Box = { p: V3; s: V3; rx?: number };
// ---------------------------------------------------------------- thin black steel frames, stone sills, the roof's bones
// Every bar stands in the plane of the glass it holds, and runs into the bars it meets, so the frames join up smoothly
// with no ends showing. The rafters, and the big window's mullions under them, line up across the room; the two outer
// rafters are the side windows' sloping heads.
const RAFTER_X = [-GLASS_X, -2.08, -0.95, 0.95, 2.08, GLASS_X];
/** the glazing bars' depth below the glass; the transom over the big window and the head beam where the slope meets the
 * ceiling are tall enough that a bar coming in at the pitch lands wholly on their faces */
const RAFTER_D = 0.035, SLOPE = (ROOF_Z - GLASS_Z) / COS, RAIL = 0.025;
const TRANSOM = { h: 0.05, d: 0.06 }, HEAD = { h: 0.08, d: 0.08 }, PURLIN = 0.03;
/** a point on the glass line at z, moved `d` in from the glass (toward the room) */
const under = (z: number, d: number): [number, number] => [ROOF.eave + (z - GLASS_Z) * TAN - d * COS, z + d * SIN];
/** the purlin across the middle of the slope, a hair shallower than the bars it crosses; the pendant over the desk
 * hangs from it */
const PURLIN_Z = -1.7, PURLIN_IN = 0.002 + PURLIN / 2;
export const HANG = { y: under(PURLIN_Z, PURLIN_IN + PURLIN / 2)[0], z: under(PURLIN_Z, PURLIN_IN + PURLIN / 2)[1] };
/** the middle of the rail along each sill, where the upright bars start */
const FRONT_RAIL = WIN.y0 + 0.024 + RAIL / 2, SIDE_RAIL = WIN.sideY0 + 0.024 + RAIL / 2;

/** the big window's sill reaches 3 cm into the room; the side windows' sills start there */
const SILL_Z1 = GLASS_Z + T / 2 + 0.03;
const SILLS: Box[] = [
  { p: [0, WIN.y0 + 0.012, (GLASS_Z - T / 2 + SILL_Z1) / 2], s: [W + 2 * T, 0.024, SILL_Z1 - GLASS_Z + T / 2] },
  ...SIDES.map(({ s, x }) => ({ p: [x - s * 0.015, WIN.sideY0 + 0.012, (SILL_Z1 + WIN.sideZ1) / 2] as V3, s: [T + 0.03, 0.024, WIN.sideZ1 - SILL_Z1] as V3 })),
];
const FRAMES: Box[] = [
  // the big window: a post at each corner running up flush with the transom's top; the transom at the eave and the
  // rail along the sill between the posts, their ends inside them; mullions between the rail and the transom
  ...SIDES.map(({ x }) => ({ p: [x, (WIN.y0 + ROOF.eave + TRANSOM.h / 2) / 2, GLASS_Z] as V3, s: [0.045, ROOF.eave + TRANSOM.h / 2 - WIN.y0, 0.045] as V3 })),
  { p: [0, ROOF.eave, GLASS_Z], s: [2 * GLASS_X, TRANSOM.h, TRANSOM.d] },
  { p: [0, FRONT_RAIL, GLASS_Z], s: [2 * GLASS_X, RAIL, 0.05] },
  ...RAFTER_X.slice(1, -1).map((x) => ({ p: [x, (FRONT_RAIL + ROOF.eave) / 2, GLASS_Z] as V3, s: [0.028, ROOF.eave - FRONT_RAIL, 0.05] as V3 })),
  // the roof: glazing bars from the transom up to the head beam, each end buried in them (the outer two are the side
  // windows' sloping heads); the purlin across them; the head beam
  ...RAFTER_X.map((x, i) => {
    const [y, z] = under((GLASS_Z + ROOF_Z) / 2, RAFTER_D / 2), edge = i === 0 || i === RAFTER_X.length - 1;
    return { p: [x, y, z] as V3, s: [edge ? 0.04 : 0.03, RAFTER_D, SLOPE] as V3, rx: -ROOF.pitch };
  }),
  (() => {
    const [y, z] = under(PURLIN_Z, PURLIN_IN);
    return { p: [0, y, z] as V3, s: [2 * GLASS_X, PURLIN, PURLIN] as V3, rx: -ROOF.pitch };
  })(),
  { p: [0, H - HEAD.h / 2, ROOF_Z], s: [W + 2 * T, HEAD.h, HEAD.d] },
  // the side windows, in their glass's plane (a touch slimmer than the edge bar their mullions run up into): mullions,
  // a post at the back, a rail along the sill, and a plate under the flat ceiling
  ...SIDES.flatMap(({ x }) => [
    ...[ROOM.z0 + SIDE_LEN / 3, ROOM.z0 + (2 * SIDE_LEN) / 3].map((z) => ({ p: [x, (SIDE_RAIL + roofAt(z)) / 2, z] as V3, s: [0.036, roofAt(z) - SIDE_RAIL, 0.028] as V3 })),
    { p: [x, (SIDE_RAIL + H) / 2, WIN.sideZ1 - 0.0125] as V3, s: [0.036, H - SIDE_RAIL, 0.025] as V3 },
    { p: [x, SIDE_RAIL, SIDE_MID] as V3, s: [0.036, RAIL, SIDE_LEN] as V3 },
    { p: [x, H - 0.0175, (ROOF_Z + WIN.sideZ1) / 2] as V3, s: [0.036, 0.035, WIN.sideZ1 - ROOF_Z] as V3 },
  ]),
];

/** skirting boards round every wall at the floor: the big window's wall, both sides from end to end, and the back
 * wall up to the door's casing either side; at the corners they run into each other */
const SKIRT = { h: 0.07, d: 0.016 };
const SKIRTING: Box[] = [
  { p: [0, SKIRT.h / 2, ROOM.z0 + SKIRT.d / 2], s: [W, SKIRT.h, SKIRT.d] },
  ...SIDES.map(({ s }) => ({ p: [s * (ROOM.x1 - SKIRT.d / 2), SKIRT.h / 2, CZ] as V3, s: [SKIRT.d, SKIRT.h, D] as V3 })),
  { p: [(ROOM.x0 + CASE_X0) / 2, SKIRT.h / 2, ROOM.z1 - SKIRT.d / 2], s: [CASE_X0 - ROOM.x0, SKIRT.h, SKIRT.d] },
  { p: [(CASE_X1 + ROOM.x1) / 2, SKIRT.h / 2, ROOM.z1 - SKIRT.d / 2], s: [ROOM.x1 - CASE_X1, SKIRT.h, SKIRT.d] },
];

/** the side windows' glass, in the wall's (z, y): from the big window's glass at the front back to the post, from the
 * sill up to the slope, then level under the flat ceiling */
function sideGlass() {
  const g = new THREE.Shape();
  g.moveTo(GLASS_Z, WIN.sideY0);
  g.lineTo(WIN.sideZ1, WIN.sideY0);
  g.lineTo(WIN.sideZ1, H);
  g.lineTo(ROOF_Z, H);
  g.lineTo(GLASS_Z, ROOF.eave);
  g.closePath();
  return new THREE.ShapeGeometry(g);
}

const bars = new Map<string, RoundedBoxGeometry>();
/** a frame bar: rounded over almost to a tube across its thin sides, so the steel reads smooth. Shared; don't dispose. */
function bar(w: number, h: number, d: number) {
  const key = `${w}|${h}|${d}`;
  let g = bars.get(key);
  if (!g) bars.set(key, (g = new RoundedBoxGeometry(w, h, d, 4, Math.min(w, h, d) * 0.45)));
  return g;
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
      // the walls and the ceiling go into the sun's shadow map by the faces nearest it (three.js uses the far ones by
      // default): from inside, their shadows then overlap at every corner instead of meeting it, and no sun leaks in
      walls: WALLS.map((w) => new THREE.MeshStandardMaterial({ map: repeated(plaster, w.face[0] / 1.4, w.face[1] / 1.4), roughness: 0.95, shadowSide: THREE.FrontSide })),
      floor: new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.42 }),
      ceil: new THREE.MeshStandardMaterial({ color: "#f2ebe0", roughness: 1, shadowSide: THREE.FrontSide }),
      trim: new THREE.MeshStandardMaterial({ color: "#f3f0ea", roughness: 0.75 }),
      stone: new THREE.MeshStandardMaterial({ color: "#d9d6cf", roughness: 0.45 }),
      // powder-coated steel: matte, so warm sunlight doesn't turn it brown
      frame: new THREE.MeshStandardMaterial({ color: "#232528", roughness: 0.55, metalness: 0.2 }),
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
      {/* the floor runs on under the walls, so nothing shows past its edge (under the door, say) */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, CZ]} receiveShadow material={m.floor} {...solid}>
        <planeGeometry args={[W + 2 * T, D + 2 * T]} />
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
      {([[SKIRTING, m.trim, soft], [SILLS, m.stone, soft], [FRAMES, m.frame, bar]] as const).flatMap(([boxes, mat, shape], k) =>
        boxes.map((b: Box, i) => (
          <mesh key={`${k}-${i}`} position={b.p} rotation-x={b.rx ?? 0} castShadow receiveShadow material={mat}>
            <primitive object={shape(...b.s)} attach="geometry" />
          </mesh>
        )),
      )}

      {/* the glass: barely there, but it's what a click on the view lands on */}
      <group {...lookOut}>
        <mesh position={[0, (WIN.y0 + ROOF.eave) / 2, GLASS_Z]} material={m.glass}>
          <planeGeometry args={[2 * GLASS_X, ROOF.eave - WIN.y0]} />
        </mesh>
        <mesh position={[0, (ROOF.eave + H) / 2, (GLASS_Z + ROOF_Z) / 2]} rotation-x={Math.PI / 2 - ROOF.pitch} material={m.glass}>
          <planeGeometry args={[2 * GLASS_X, SLOPE]} />
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

/** the way out, in the back wall: a charcoal door hung in its opening, the jamb lining it, a white casing round it on
 * the room side, and the light switch beside it */
const SILL_H = 0.012;
function Door({ m }: { m: { trim: THREE.Material; door: THREE.Material; brass: THREE.Material; stone: THREE.Material } }) {
  const { x, w, h, jamb } = DOOR, z = ROOM.z1, handle = x - w / 2 + 0.07;
  return (
    <group>
      {[OPEN.x0 + jamb / 2, OPEN.x1 - jamb / 2].map((jx) => (
        <mesh key={jx} position={[jx, OPEN.h / 2, z + T / 2]} castShadow receiveShadow material={m.trim}><primitive object={soft(jamb, OPEN.h, T)} attach="geometry" /></mesh>
      ))}
      <mesh position={[x, OPEN.h - jamb / 2, z + T / 2]} castShadow receiveShadow material={m.trim}><primitive object={soft(OPEN.x1 - OPEN.x0, jamb, T)} attach="geometry" /></mesh>
      {/* a stone threshold across the opening, and the door standing on it, its face just behind the wall's */}
      <mesh position={[x, SILL_H / 2, z + T / 2]} receiveShadow material={m.stone}><primitive object={soft(OPEN.x1 - OPEN.x0, SILL_H, T)} attach="geometry" /></mesh>
      <mesh position={[x, (h + SILL_H) / 2, z + 0.025]} castShadow receiveShadow material={m.door}><primitive object={soft(w, h - SILL_H, 0.04)} attach="geometry" /></mesh>
      {[CASE_X0 + CASING.w / 2, CASE_X1 - CASING.w / 2].map((cx) => (
        <mesh key={cx} position={[cx, (OPEN.h - CASING.lap) / 2, z - CASING.d / 2]} castShadow receiveShadow material={m.trim}>
          <primitive object={soft(CASING.w, OPEN.h - CASING.lap, CASING.d)} attach="geometry" />
        </mesh>
      ))}
      <mesh position={[x, OPEN.h - CASING.lap + CASING.w / 2, z - CASING.d / 2]} castShadow receiveShadow material={m.trim}>
        <primitive object={soft(CASE_X1 - CASE_X0, CASING.w, CASING.d)} attach="geometry" />
      </mesh>
      {/* the lever on its rose, on the handle side */}
      <mesh position={[handle, 1.02, z - 0.001]} rotation-x={Math.PI / 2} material={m.brass}><cylinderGeometry args={[0.022, 0.022, 0.012, 20]} /></mesh>
      <mesh position={[handle, 1.02, z - 0.02]} rotation-x={Math.PI / 2} material={m.brass}><cylinderGeometry args={[0.007, 0.007, 0.03, 10]} /></mesh>
      <mesh position={[handle + 0.05, 1.02, z - 0.035]} rotation-z={Math.PI / 2} castShadow material={m.brass}><cylinderGeometry args={[0.009, 0.009, 0.12, 12]} /></mesh>
      <LightSwitch x={CASE_X0 - 0.15} y={1.25} z={z} />
    </group>
  );
}

/** the light switch by the door: a square black plate with two rockers, the left for the pendant over the desk and the
 * right for the reading lamp. Each rocks to show which way it's switched, and has a little amber locator light that
 * glows while its lamp is off. */
const LAMPS = [
  { key: "lamp", label: "PENDANT LIGHT", toggle: () => useRoom.getState().toggleLamp() },
  { key: "floorLamp", label: "READING LAMP", toggle: () => useRoom.getState().toggleFloorLamp() },
] as const;
function LightSwitch({ x, y, z }: { x: number; y: number; z: number }) {
  const m = useMemo(() => ({
    // matte black, like the window steel, so it reads from across the room
    plate: new THREE.MeshStandardMaterial({ color: "#2a2b2e", roughness: 0.5, metalness: 0.1 }),
    well: new THREE.MeshStandardMaterial({ color: "#141517", roughness: 0.8 }),
    rocker: new THREE.MeshStandardMaterial({ color: "#38393d", roughness: 0.38, metalness: 0.1 }),
    led: LAMPS.map(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffb347") })),
  }), []);
  const rockers = useRef<(THREE.Group | null)[]>([]);
  useFrame((_, dt) => {
    const s = useRoom.getState();
    LAMPS.forEach((l, i) => {
      const on = s[l.key], r = rockers.current[i];
      // on: the top is pressed in; off: the bottom
      if (r) r.rotation.x += ((on ? 0.15 : -0.15) - r.rotation.x) * Math.min(1, dt * 18);
      m.led[i].color.set("#ffb347").multiplyScalar(on ? 0.25 : 1.8);
    });
  });
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0, -0.0045]} castShadow receiveShadow material={m.plate}><primitive object={soft(0.086, 0.086, 0.009, 0.0035)} attach="geometry" /></mesh>
      <mesh position={[0, 0, -0.0085]} material={m.well}><boxGeometry args={[0.064, 0.064, 0.002]} /></mesh>
      {LAMPS.map((l, i) => (
        <group
          key={l.key}
          ref={(g) => { rockers.current[i] = g; }}
          position={[(i - 0.5) * 0.031, 0, -0.0095]}
          {...clickable(() => `${l.label} · ${useRoom.getState()[l.key] ? "SWITCH OFF" : "SWITCH ON"}`, l.toggle)}
        >
          <mesh position={[0, 0, -0.004]} castShadow material={m.rocker}><primitive object={soft(0.029, 0.06, 0.008, 0.003)} attach="geometry" /></mesh>
          <mesh position={[0, -0.022, -0.0083]} material={m.led[i]}><boxGeometry args={[0.006, 0.0018, 0.0006]} /></mesh>
        </group>
      ))}
    </group>
  );
}

/** a soft cushion: a rounded unit box stretched to size, so the corners round broadly across the face and gently
 * at the edges */
const pillow = (w: number, h: number, d: number, k = 0.25) => new RoundedBoxGeometry(1, 1, 1, 5, k).scale(w, h, d);

/** the desk chair: a swivel barrel chair in deep emerald velvet. One plump shell wraps round the seat, channel-tufted,
 * standing tall at the back and sweeping down into the arms, its ends rounded off; a deep round cushion piped in brass
 * sits inside it, all on a polished brass five-star base on black casters. It's been rolled to the end of the desk and
 * left turned toward it, so nothing on the desk is hidden from the middle of the room. A click spins it round once.
 * Its front is -z. */
const SEAT_Y = 0.47;
const SHELL = { r: 0.265, t: 0.095, arc: 1.95, channels: 13 };
/** the shell: round the arc (v) its cross-section (u) runs up the inside, over the rounded top and down the outside */
function barrelShell() {
  const { r: R, t: T, arc: A, channels: N } = SHELL;
  return new ParametricGeometry((u, v, out) => {
    const th = (v * 2 - 1) * A;
    const end = Math.sin((Math.min(1, (A - Math.abs(th)) / 0.34) * Math.PI) / 2);
    // between the grooves the velvet puffs out, most on the inside you lean against
    const g = Math.pow(Math.abs(Math.sin(v * N * Math.PI)), 0.55);
    const h = (0.05 + (0.15 + 0.25 * Math.pow(Math.cos(th * 0.6), 2)) * end) * (0.985 + 0.015 * g);
    const t = T * (0.3 + 0.7 * end), inner = R - (t / 2) * (0.55 + 0.45 * g), outer = R + (t / 2) * (0.88 + 0.12 * g), top = h - t / 2;
    let rr: number, y: number;
    if (u < 0.35) {
      rr = inner;
      y = (u / 0.35) * top;
    } else if (u < 0.65) {
      const a = Math.PI * (1 - (u - 0.35) / 0.3);
      rr = (inner + outer) / 2 + (Math.cos(a) * (outer - inner)) / 2;
      y = top + (Math.sin(a) * t) / 2;
    } else {
      rr = outer;
      y = (1 - (u - 0.65) / 0.35) * top;
    }
    out.set(Math.sin(th) * rr, y, Math.cos(th) * rr);
  }, 36, 180);
}
/** a deep round seat cushion, its edge rounded over */
const CUSHION = [[0, 0], [0.21, 0], [0.236, 0.014], [0.246, 0.05], [0.236, 0.086], [0.21, 0.1], [0.08, 0.104], [0, 0.104]].map(([x, y]) => new THREE.Vector2(x, y));

function Chair() {
  const m = useMemo(() => ({
    velvet: new THREE.MeshPhysicalMaterial({ color: "#174d39", roughness: 0.78, sheen: 1, sheenColor: new THREE.Color("#8fdcb4"), sheenRoughness: 0.32 }),
    brass: new THREE.MeshStandardMaterial({ color: "#c9a35e", roughness: 0.25, metalness: 0.95 }),
    black: new THREE.MeshStandardMaterial({ color: "#151618", roughness: 0.55, metalness: 0.2 }),
  }), []);
  const g = useMemo(() => ({ shell: barrelShell(), cushion: new THREE.LatheGeometry(CUSHION, 48) }), []);
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
      {/* the base: five polished brass spokes on black twin-wheel casters, a brass column and hub */}
      {[0, 1, 2, 3, 4].map((k) => (
        <group key={k} rotation-y={(k / 5) * Math.PI * 2}>
          <mesh position={[0, 0.07, 0.15]} rotation-x={0.1} castShadow material={m.brass}><primitive object={soft(0.045, 0.026, 0.3, 0.011)} attach="geometry" /></mesh>
          {[-1, 1].map((w) => (
            <mesh key={w} position={[w * 0.013, 0.03, 0.315]} rotation-z={Math.PI / 2} castShadow material={m.black}><cylinderGeometry args={[0.03, 0.03, 0.013, 18]} /></mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 0.09, 0]} castShadow material={m.brass}><cylinderGeometry args={[0.045, 0.055, 0.05, 32]} /></mesh>
      <mesh position={[0, 0.25, 0]} castShadow material={m.brass}><cylinderGeometry args={[0.022, 0.022, 0.3, 20]} /></mesh>
      {/* everything above the column turns */}
      <group ref={top} {...clickable("CHAIR · GIVE IT A SPIN", () => { if (spin.current < 0) spin.current = 0; })}>
        <mesh position={[0, 0.4, 0]} castShadow material={m.black}><cylinderGeometry args={[0.2, 0.17, 0.04, 40]} /></mesh>
        <mesh geometry={g.shell} position={[0, SEAT_Y - 0.06, 0]} castShadow receiveShadow material={m.velvet} />
        <mesh geometry={g.cushion} position={[0, SEAT_Y - 0.052, -0.01]} castShadow receiveShadow material={m.velvet} />
        <mesh position={[0, SEAT_Y + 0.036, -0.01]} rotation-x={Math.PI / 2} castShadow material={m.brass}><torusGeometry args={[0.236, 0.005, 8, 64]} /></mesh>
      </group>
    </group>
  );
}
