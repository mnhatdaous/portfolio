import * as THREE from "three";
import type { Page } from "../store";

// A station is a thing in the room that a page flies to. The camera frames it from its bounding box, so moving an
// object re-frames its page with no other change.
export type StationDef = {
  /** the side the camera looks from: camera = target + dir * distance */
  dir: [number, number, number];
  /** padding around the object: 1 fits it exactly */
  fit: number;
  /** the same on a narrow (portrait) screen, where fitting the width alone leaves a lot of floor and ceiling */
  fitNarrow?: number;
  /** how far the visitor may orbit either side, in radians */
  spread: number;
  /** a fixed box, for a station that frames part of the room instead of one object */
  box?: THREE.Box3;
  /** whether the card opens beside it (and the camera frames the space the card leaves) */
  card: boolean;
};

export const STATIONS: Record<Page, StationDef> = {
  // the desk under the window, the window and a little of the walls either side
  home: {
    dir: [-0.1, 0.2, 1],
    fit: 1.0,
    fitNarrow: 0.8,
    spread: 0.5,
    box: new THREE.Box3(new THREE.Vector3(-0.85, 0.72, -0.6), new THREE.Vector3(1.25, 2.05, 0.15)),
    card: false,
  },
  about: { dir: [0.02, 0.5, 1], fit: 1.3, spread: 0.32, card: true },
  online: { dir: [-0.25, 0.32, 1], fit: 1.12, spread: 0.32, card: true },
  work: { dir: [1, 0.06, 0.1], fit: 1.04, spread: 0.3, card: true },
  // a little from the side, so the desk chair isn't between the camera and the lower shelves
  stack: { dir: [-1, 0.07, 0.38], fit: 1.04, spread: 0.3, card: true },
  // looking out: the camera stands at the glass and turns about a point on it (see windowFrame)
  window: { dir: [0, 0.16, 1], fit: 1, spread: 0.55, card: false },
};

const objects = new Map<Page, THREE.Object3D>();

/** stations register their object from a ref; the camera measures it on demand */
export function registerStation(page: Page, obj: THREE.Object3D | null) {
  if (obj) objects.set(page, obj);
  else objects.delete(page);
}

export function stationBox(page: Page): THREE.Box3 | null {
  const def = STATIONS[page];
  if (def.box) return def.box;
  const o = objects.get(page);
  if (!o) return null;
  o.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(o);
  return box.isEmpty() ? null : box;
}
