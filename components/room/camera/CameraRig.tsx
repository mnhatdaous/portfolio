"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { cardWidth, layout, narrow, pageFromHash, reduceMotion, useRoom, type Page } from "../store";
import { STATIONS, stationBox } from "./stations";

// Two cameras. `rig` is moved by the orbit controls and by flights; R3F's default camera (`view`) is what renders:
// the rig's pose, kept inside the room, nudged sideways so the object sits beside the card, plus a slow handheld drift.
// At home the orbit target sits just in front of the eye, so a drag turns the head: the visitor can look all the way
// round the room.

type V3 = THREE.Vector3;
type Frame = { tgt: V3; pos: V3 };
type Flight = { t: number; start: number; dur: number; fromT: V3; fromP: V3; toT: V3; toP: V3; via?: Frame; soft?: boolean; land?: () => void };

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const BASE_FOV = 36;
// the walls, less a hand's width: the rendered camera never passes them
const ROOM = { x0: -3.06, x1: 3.06, y0: 0.25, y1: 2.86, z0: -2.2, z1: 3.16 };
// where the camera stands before ENTER: the back of the room, the desk and the big window in view
export const INTRO: Frame = { pos: V(1.1, 1.85, 2.95), tgt: V(0, 1.2, -2.1) };
// home: the middle of the room at eye height, with the orbit target LOOK in front of the eye
const HOME = V(0, 1.42, 0.55);
const LOOK = 0.15;
const FORWARD = V(0, -0.09, -1).normalize();
// turns between walls pass near here
const EYE = V(0, 1.5, 0.4);
// looking out: the camera turns about a point on the glass, so a drag moves your head
const GLASS = V(0, 1.68, -2.3);

/** which way the visitor faces at home: the desk at first, then wherever they last looked or came back from */
const homeFacing = FORWARD.clone();
function homeFrame(): Frame {
  return { pos: HOME.clone(), tgt: HOME.clone().addScaledVector(homeFacing, LOOK) };
}
/** at home the eye stays level, a touch below the horizon on a wide screen (toward the desk) and a touch above on a
 * tall one (toward the view); it never tilts up at the ceiling or down at the floor */
function levelled(dir: V3) {
  dir.y = 0;
  dir.normalize();
  dir.y = narrow() ? 0.04 : -0.09;
  return dir.normalize();
}

/** the view is about to turn under a still pointer: drop the hover label until the pointer moves again */
function dropHover() {
  if (useRoom.getState().hover) useRoom.getState().setHover(null);
  document.body.style.cursor = "";
}

/** the arrow keys turn the head at home; set by the rig */
export const look = { turn: (a: number) => void a };

const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const sineIn = (a: number, b: number, x: number) => (x <= a ? 0 : x >= b ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * (x - a)) / (b - a)));

/** a 36° lens, widened on tall screens so they see about the width a wide one does */
export function lensFov(aspect: number) {
  const t = Math.tan(THREE.MathUtils.degToRad(BASE_FOV / 2));
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(t, Math.min(0.62, (t * 1.45) / aspect))));
}

/** looking around the room (and out of the window) wants a wider lens: about 76° across, 50–74° tall */
export function wideFov(aspect: number) {
  const v = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(38)) / aspect);
  return THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(v), 50, 74);
}

function windowFrame(): Frame {
  return { tgt: GLASS.clone(), pos: GLASS.clone().add(V(0, 0.16, 0.95)) };
}

/** where to stand for a page: back away along the station's direction until its box fits the free part of the screen */
export function frameFor(page: Page, W: number, H: number, fov: number): Frame {
  if (page === "home") return homeFrame();
  if (page === "window") return windowFrame();
  const def = STATIONS[page];
  const box = stationBox(page);
  if (!box) return homeFrame();
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
  // at home: all the way round, and level
  if (page === "home") return { minAz: -Infinity, maxAz: Infinity, minPol: sph.phi, maxPol: sph.phi, minDist: LOOK, maxDist: LOOK };
  const win = page === "window", spread = STATIONS[page].spread;
  return {
    minAz: sph.theta - spread,
    maxAz: sph.theta + spread,
    // only a little up and down, so neither the ceiling nor the floor takes over the picture
    minPol: Math.max(0.3, sph.phi - (win ? 0.06 : 0.14)),
    maxPol: Math.min(2.3, sph.phi + (win ? 0.06 : 0.12)),
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
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const rig = useMemo(() => {
    const c = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.03, 240);
    c.position.copy(INTRO.pos);
    return c;
  }, []);
  // made detached and connected in an effect: React may run a memo twice in development, and a second set of
  // listeners on the canvas would fight this one
  const controls = useMemo(() => {
    const c = new OrbitControls(rig);
    Object.assign(c, { enableDamping: true, dampingFactor: 0.06, enablePan: false, rotateSpeed: 0.45, zoomSpeed: 0.6 });
    c.target.copy(INTRO.tgt);
    c.update();
    return c;
  }, [rig]);
  useEffect(() => {
    controls.connect(gl.domElement);
    return () => controls.disconnect();
  }, [controls, gl]);

  const fly = useRef<Flight | null>(null);
  const shift = useRef({ x: 0, y: 0 });
  const fovRef = useRef(lensFov(size.width / size.height));
  const wideRef = useRef(wideFov(size.width / size.height));
  const curFov = useRef(wideRef.current);
  // the lens zoom as shown, easing toward the store's; and how fast a drag turns things before the zoom slows it
  const zoomCur = useRef(1);
  const baseRotate = useRef(0.45);
  const turn = useRef(0);
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const reduce = useMemo(() => reduceMotion(), []);

  const frame = (page: Page) => frameFor(page, sizeRef.current.width, sizeRef.current.height, fovRef.current);

  const loose = () => Object.assign(controls, { minAzimuthAngle: -Infinity, maxAzimuthAngle: Infinity, minPolarAngle: 0.1, maxPolarAngle: Math.PI - 0.1, minDistance: 0.05, maxDistance: 50 });
  const settle = (page: Page, f: Frame) => {
    const l = limitsFor(page, f);
    baseRotate.current = page === "home" ? -0.32 : 0.45;
    Object.assign(controls, {
      minAzimuthAngle: l.minAz, maxAzimuthAngle: l.maxAz, minPolarAngle: l.minPol, maxPolarAngle: l.maxPol, minDistance: l.minDist, maxDistance: l.maxDist,
      // at home a drag grabs the room and pulls it round, like a panorama; elsewhere it orbits the object (the frame loop
      // slows it while zoomed in)
      rotateSpeed: baseRotate.current,
      enableZoom: page !== "home",
    });
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
    // back home from a station: face the thing you were just looking at
    if (page === "home" && opts.prev) {
      const box = opts.prev === "window" ? null : stationBox(opts.prev);
      homeFacing.copy(levelled(box ? box.getCenter(V()).sub(HOME) : FORWARD.clone()));
    }
    const dest = frame(page);
    if (opts.instant || reduce) {
      place(page, dest);
      opts.land?.();
      return;
    }
    // a big turn (to the board or the bookshelf) turns the head first, then walks over
    const a = rig.position.clone().sub(controls.target).setY(0).normalize();
    const b = dest.pos.clone().sub(dest.tgt).setY(0).normalize();
    const turnAngle = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
    const prev = opts.prev ?? "home";
    let via: Frame | undefined, dur = opts.dur ?? 1.35;
    if (!opts.dur && turnAngle > 0.9 && page !== "window" && prev !== "window") {
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
        homeFacing.copy(levelled(FORWARD.clone()));
        const start = pageFromHash();
        flyTo("home", {
          dur: 2.8, soft: true,
          land: () => { if (start !== "home") useRoom.getState().go(start, { fromHistory: true }); },
        });
      } else if (s.page !== p.page && s.entered) flyTo(s.page, { prev: p.page });
    });
    look.turn = (a) => {
      const pg = useRoom.getState().page;
      if (pg !== "home" && pg !== "window") return;
      dropHover();
      turn.current += a;
    };
    return unsub;
    // flyTo reads everything through refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // at home a scroll turns the room as well as a drag, and looking out of the window it pans the view: a mouse wheel's
  // notches, a trackpad's swipe either way
  useEffect(() => {
    const el = gl.domElement;
    const wheel = (e: WheelEvent) => {
      const s = useRoom.getState();
      if (!s.entered || (s.page !== "home" && s.page !== "window") || fly.current) return;
      e.preventDefault();
      dropHover();
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      turn.current -= (d * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1) * 0.0022) / zoomCur.current;
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [gl]);

  // zoom: a trackpad pinch (browsers send it as ctrl + scroll), ctrl/⌘ + scroll, Safari's pinch gestures, and a
  // two-finger pinch on a touch screen at home (elsewhere the orbit controls' own pinch moves the camera in and out).
  // The + and − keys and the HUD's buttons zoom too.
  useEffect(() => {
    const el = gl.domElement, box = el.parentElement ?? el;
    const can = () => useRoom.getState().entered && !fly.current;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      // over the room it's our zoom: not the browser's page zoom, nor the controls' dolly or the turn at home
      e.preventDefault();
      e.stopPropagation();
      if (!can()) return;
      const d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      useRoom.getState().zoomBy(Math.exp(-THREE.MathUtils.clamp(d, -30, 30) * 0.008));
    };
    let pinched = 1;
    const gestureStart = (e: Event) => {
      e.preventDefault();
      pinched = 1;
    };
    const gestureChange = (e: Event) => {
      e.preventDefault();
      const scale = (e as Event & { scale: number }).scale;
      if (can() && scale > 0) useRoom.getState().zoomBy(scale / pinched);
      pinched = scale;
    };
    const touches = new Map<number, { x: number; y: number }>();
    let spread = 0;
    const apart = () => {
      const [a, b] = [...touches.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      spread = touches.size === 2 ? apart() : 0;
    };
    const move = (e: PointerEvent) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size !== 2 || useRoom.getState().page !== "home" || !can()) return;
      const d = apart();
      if (spread > 0 && d > 0) useRoom.getState().zoomBy(d / spread);
      spread = d;
    };
    const up = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      spread = touches.size === 2 ? apart() : 0;
    };
    box.addEventListener("wheel", wheel, { capture: true, passive: false });
    box.addEventListener("gesturestart", gestureStart);
    box.addEventListener("gesturechange", gestureChange);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      box.removeEventListener("wheel", wheel, { capture: true });
      box.removeEventListener("gesturestart", gestureStart);
      box.removeEventListener("gesturechange", gestureChange);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [gl]);

  // a resize re-frames the page in one step
  useEffect(() => {
    fovRef.current = lensFov(size.width / size.height);
    wideRef.current = wideFov(size.width / size.height);
    rig.fov = fovRef.current;
    rig.aspect = size.width / size.height;
    rig.updateProjectionMatrix();
    const s = useRoom.getState();
    if (s.page === "home") levelled(homeFacing);
    if (s.entered && !fly.current) place(s.page, frame(s.page));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  // for poking at the camera from the console while developing
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") (window as unknown as Record<string, unknown>).__rig = { rig, controls, view, frame, flyTo, gl, scene };
  });

  const drift = useMemo(() => V(), []);
  const aim = useMemo(() => V(), []);
  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const T = state.clock.elapsedTime;
    const page = useRoom.getState().page;
    const atHome = page === "home" && !fly.current && useRoom.getState().entered;
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
    // a scroll or the arrow keys: at home turn the head about the eye; at the window swing the eye about the point on
    // the glass, which the controls keep inside the view's limits; easing out either way
    const atWindow = page === "window" && !fly.current;
    if ((atHome || atWindow) && turn.current) {
      const a = Math.abs(turn.current) < 0.002 || reduce ? turn.current : turn.current * Math.min(1, dt * 7);
      turn.current -= a;
      if (atHome) controls.target.sub(rig.position).applyAxisAngle(UP, a).add(rig.position);
      else rig.position.sub(controls.target).applyAxisAngle(UP, a).add(controls.target);
    } else if (!atHome && !atWindow) turn.current = 0;
    controls.update();
    if (atHome) homeFacing.copy(controls.target).sub(rig.position).normalize();

    // the rendered view: a slow handheld drift, which at home moves the eye and what it looks at together
    view.position.copy(rig.position);
    aim.copy(controls.target);
    if (!reduce) {
      const k = page === "online" || page === "about" ? 0.35 : 1;
      drift.set(Math.sin(T * 0.23) * 0.005 * k, Math.sin(T * 0.31 + 1) * 0.0035 * k, 0);
      view.position.add(drift);
      if (page === "home" || page === "window") aim.add(drift);
    }
    keepInRoom(view.position, aim);
    view.lookAt(aim);

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
    // the lens widens at home and at the window, and narrows again on the way to a station
    const want = page === "home" || page === "window" ? wideRef.current : fovRef.current;
    curFov.current = reduce ? want : curFov.current + (want - curFov.current) * Math.min(1, dt * 2.4);
    // the zoom narrows (or widens) the same lens, and slows a drag to match so the room still turns under the pointer
    const zoom = useRoom.getState().zoom;
    zoomCur.current = reduce || Math.abs(zoom - zoomCur.current) < 1e-3 ? zoom : zoomCur.current + (zoom - zoomCur.current) * Math.min(1, dt * 9);
    controls.rotateSpeed = baseRotate.current / zoomCur.current;
    const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(curFov.current) / 2) / zoomCur.current);
    view.fov = Math.min(100, THREE.MathUtils.radToDeg(2 * half));
    view.updateProjectionMatrix();
  });

  return null;
}
