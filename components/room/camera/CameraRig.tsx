"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { cardWidth, layout, narrow, pageFromHash, reduceMotion, useRoom, type Page } from "../store";
import { STATIONS, stationBox } from "./stations";

// Two cameras. `rig` is moved by the orbit controls and by flights; R3F's default camera (`view`) is what renders:
// the rig's pose, kept inside the room, nudged sideways so the object sits beside the card, plus a slow handheld drift.

type V3 = THREE.Vector3;
type Frame = { tgt: V3; pos: V3 };
type Flight = { t: number; start: number; dur: number; fromT: V3; fromP: V3; toT: V3; toP: V3; via?: Frame; soft?: boolean; land?: () => void };

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const BASE_FOV = 36;
// the walls, less a hand's width: the rendered camera never passes them
const ROOM = { x0: -1.78, x1: 1.98, y0: 0.25, y1: 2.68, z0: -0.44, z1: 3.68 };
// where the camera stands before ENTER: the back of the room, the whole desk in view
export const INTRO: Frame = { pos: V(0.75, 1.95, 3.45), tgt: V(0.12, 1.2, -0.35) };
// standing in the middle of the room, at eye height: turns between walls pass near here
const EYE = V(0.15, 1.5, 1.75);
// looking out: the camera turns about a point on the glass, so a drag moves your head
const GLASS = V(0.2, 1.62, -0.6);

const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const sineIn = (a: number, b: number, x: number) => (x <= a ? 0 : x >= b ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * (x - a)) / (b - a)));

/** a 36° lens, widened on tall screens so they see about the width a wide one does */
export function lensFov(aspect: number) {
  const t = Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2));
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(t, Math.min(0.62, (t * 1.45) / aspect))));
}

function windowFrame(): Frame {
  return { tgt: GLASS.clone(), pos: GLASS.clone().add(V(0, 0.16, 0.95)) };
}

/** where to stand for a page: back away along the station's direction until its box fits the free part of the screen */
export function frameFor(page: Page, W: number, H: number, fov: number): Frame {
  if (page === "window") return windowFrame();
  const def = STATIONS[page];
  const box = stationBox(page);
  if (!box) return { tgt: INTRO.tgt.clone(), pos: INTRO.pos.clone() };
  const c = box.getCenter(V()), s = box.getSize(V());
  const back = V(...def.dir).normalize();
  const look = back.clone().negate();
  const right = V().crossVectors(look, UP).normalize();
  const up = V().crossVectors(right, look).normalize();
  const ext = (a: V3) => (Math.abs(s.x * a.x) + Math.abs(s.y * a.y) + Math.abs(s.z * a.z)) / 2;
  const tanV = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  let usableW = W, usableH = H - 120; // the top bar and the bottom pills
  if (def.card) {
    if (narrow()) usableH = Math.max(H * 0.3, H - layout.sheetH - 170);
    else usableW = Math.max(W * 0.4, W - cardWidth() - 60);
  }
  const fit = narrow() && def.fitNarrow ? def.fitNarrow : def.fit;
  const d = fit * Math.max(ext(up) / (tanV * (usableH / H)), ext(right) / (tanV * (usableW / H))) + ext(back);
  return { tgt: c, pos: c.clone().addScaledVector(back, d) };
}

/** how far the visitor may orbit at a page, around the pose the flight lands in */
function limitsFor(page: Page, f: Frame) {
  const sph = new THREE.Spherical().setFromVector3(f.pos.clone().sub(f.tgt));
  const win = page === "window", spread = STATIONS[page].spread;
  return {
    minAz: sph.theta - spread,
    maxAz: sph.theta + spread,
    minPol: Math.max(0.3, sph.phi - (win ? 0.5 : 0.28)),
    maxPol: Math.min(2.3, sph.phi + (win ? 0.55 : 0.22)),
    minDist: win ? 0.4 : Math.max(0.18, sph.radius * 0.55),
    maxDist: win ? 1.25 : sph.radius * 1.3,
  };
}

/** slide the camera along its line of sight so it stays inside the walls */
function keepInRoom(p: V3, t: V3) {
  let s = 1;
  const lim = (pv: number, tv: number, lo: number, hi: number) => {
    if (pv < lo && tv > lo) s = Math.min(s, (lo - tv) / (pv - tv));
    else if (pv > hi && tv < hi) s = Math.min(s, (hi - tv) / (pv - tv));
  };
  lim(p.x, t.x, ROOM.x0, ROOM.x1);
  lim(p.y, t.y, ROOM.y0, ROOM.y1);
  lim(p.z, t.z, ROOM.z0, ROOM.z1);
  if (s < 1) p.sub(t).multiplyScalar(Math.max(0.05, s)).add(t);
}

export default function CameraRig() {
  const view = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const rig = useMemo(() => {
    const c = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.03, 220);
    c.position.copy(INTRO.pos);
    return c;
  }, []);
  const controls = useMemo(() => {
    const c = new OrbitControls(rig, gl.domElement);
    Object.assign(c, { enableDamping: true, dampingFactor: 0.06, enablePan: false, rotateSpeed: 0.45, zoomSpeed: 0.6 });
    c.target.copy(INTRO.tgt);
    c.update();
    return c;
  }, [rig, gl]);
  useEffect(() => () => controls.dispose(), [controls]);

  const fly = useRef<Flight | null>(null);
  const shift = useRef({ x: 0, y: 0 });
  const fovRef = useRef(lensFov(size.width / size.height));
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const reduce = useMemo(() => reduceMotion(), []);

  const frame = (page: Page) => frameFor(page, sizeRef.current.width, sizeRef.current.height, fovRef.current);

  const loose = () => Object.assign(controls, { minAzimuthAngle: -Infinity, maxAzimuthAngle: Infinity, minPolarAngle: 0.1, maxPolarAngle: Math.PI - 0.1, minDistance: 0.05, maxDistance: 50 });
  const settle = (page: Page, f: Frame) => {
    const l = limitsFor(page, f);
    Object.assign(controls, { minAzimuthAngle: l.minAz, maxAzimuthAngle: l.maxAz, minPolarAngle: l.minPol, maxPolarAngle: l.maxPol, minDistance: l.minDist, maxDistance: l.maxDist });
  };
  const place = (page: Page, f: Frame) => {
    fly.current = null;
    controls.target.copy(f.tgt);
    rig.position.copy(f.pos);
    settle(page, f);
    controls.update();
    useRoom.getState().setFlying(false);
  };

  const flyTo = (page: Page, opts: { dur?: number; soft?: boolean; instant?: boolean; prev?: Page; land?: () => void } = {}) => {
    const dest = frame(page);
    if (opts.instant || reduce) {
      place(page, dest);
      opts.land?.();
      return;
    }
    // a big turn (to the board or the bookshelf) turns the head first, then walks over
    const a = rig.position.clone().sub(controls.target).setY(0).normalize();
    const b = dest.pos.clone().sub(dest.tgt).setY(0).normalize();
    const turn = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
    const prev = opts.prev ?? "home";
    let via: Frame | undefined, dur = opts.dur ?? 1.35;
    if (!opts.dur && turn > 0.9 && page !== "window" && prev !== "window") {
      const pos = rig.position.clone().lerp(EYE, 0.55);
      pos.y = Math.max(pos.y, 1.45);
      via = { tgt: dest.tgt.clone(), pos };
      dur = 2.6;
    } else if (!opts.dur && (page === "window" || prev === "window")) dur = 1.7;
    loose();
    controls.enabled = false;
    useRoom.getState().setFlying(true);
    fly.current = {
      t: 0, start: performance.now(), dur, via, soft: opts.soft,
      fromT: controls.target.clone(), fromP: rig.position.clone(), toT: dest.tgt, toP: dest.pos,
      land: () => {
        settle(page, dest);
        controls.enabled = true;
        opts.land?.();
      },
    };
  };

  // pages → flights; ENTER → the walk in from the back of the room, then on to a page the URL named
  useEffect(() => {
    const unsub = useRoom.subscribe((s, p) => {
      if (s.entered && !p.entered) {
        const start = pageFromHash();
        flyTo("home", {
          dur: 2.8, soft: true,
          land: () => { if (start !== "home") useRoom.getState().go(start, { fromHistory: true }); },
        });
      } else if (s.page !== p.page && s.entered) flyTo(s.page, { prev: p.page });
    });
    return unsub;
    // flyTo reads everything through refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // a resize re-frames the page in one step
  useEffect(() => {
    fovRef.current = lensFov(size.width / size.height);
    rig.fov = fovRef.current;
    rig.aspect = size.width / size.height;
    rig.updateProjectionMatrix();
    const s = useRoom.getState();
    if (s.entered && !fly.current) place(s.page, frame(s.page));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  // for poking at the camera from the console while developing
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") (window as unknown as Record<string, unknown>).__rig = { rig, controls, view, frame, flyTo, gl };
  });

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const T = state.clock.elapsedTime;
    const f = fly.current;
    if (f) {
      // on the wall clock, so a slow frame rate doesn't slow the flight down
      f.t = Math.min(1, (performance.now() - f.start) / 1000 / f.dur);
      if (f.via) {
        // two overlapping moves on one clock: turn toward the destination, then push in
        const v = f.via, t = f.t, push = sineIn(0.3, 1, t);
        rig.position.copy(f.fromP).addScaledVector(V().subVectors(v.pos, f.fromP), sineIn(0, 0.5, t)).addScaledVector(V().subVectors(f.toP, v.pos), push);
        controls.target.copy(f.fromT).addScaledVector(V().subVectors(v.tgt, f.fromT), sineIn(0, 0.45, t)).addScaledVector(V().subVectors(f.toT, v.tgt), sineIn(0.35, 1, t));
      } else {
        const e = f.soft ? 0.5 - 0.5 * Math.cos(Math.PI * f.t) : easeInOutCubic(f.t);
        controls.target.lerpVectors(f.fromT, f.toT, e);
        rig.position.lerpVectors(f.fromP, f.toP, e);
      }
      if (f.t > 0.72 && useRoom.getState().flying) useRoom.getState().setFlying(false);
      if (f.t >= 1) {
        fly.current = null;
        f.land?.();
      }
    }
    controls.update();

    // the rendered view
    view.position.copy(rig.position);
    keepInRoom(view.position, controls.target);
    const page = useRoom.getState().page;
    if (!reduce) {
      const k = page === "online" || page === "about" ? 0.35 : 1;
      view.position.x += Math.sin(T * 0.23) * 0.005 * k;
      view.position.y += Math.sin(T * 0.31 + 1) * 0.0035 * k;
    }
    view.lookAt(controls.target);

    // slide the picture so the object sits in the space beside (or above) the card
    const { width: W, height: H } = sizeRef.current;
    const def = STATIONS[page];
    let wx = 0, wy = 0;
    if (def.card && useRoom.getState().entered) {
      if (narrow()) wy = (layout.sheetH + 62 - 90) / 2;
      else wx = (cardWidth() + 40) / 2;
    }
    const k = reduce ? 1 : Math.min(1, dt * 4);
    shift.current.x += (wx - shift.current.x) * k;
    shift.current.y += (wy - shift.current.y) * k;
    if (Math.abs(shift.current.x) + Math.abs(shift.current.y) > 0.5) view.setViewOffset(W, H, shift.current.x, shift.current.y, W, H);
    else if (view.view) view.clearViewOffset();
    view.fov = fovRef.current;
    view.updateProjectionMatrix();
  });

  return null;
}
