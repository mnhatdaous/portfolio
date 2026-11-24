import type { ThreeEvent } from "@react-three/fiber";
import { useRoom } from "../store";
import { sound } from "./audio";

export const BACK_LABEL = "BACK TO THE ROOM";

/** at a station, a click on anything that isn't one of the room's things is a click outside it: back to the room */
export function clickOutside() {
  const s = useRoom.getState();
  if (!s.entered || s.page === "home") return;
  sound.click();
  s.go("home");
}

/** pointer props for a clickable thing: a label while hovered, and a click that isn't the end of a drag */
export function clickable(label: string | (() => string), onSelect?: (e: ThreeEvent<MouseEvent>) => void) {
  return {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      useRoom.getState().setHover(typeof label === "function" ? label() : label);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      useRoom.getState().setHover(null);
      document.body.style.cursor = "";
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > 6) return;
      e.stopPropagation();
      sound.click();
      onSelect?.(e);
    },
  };
}

/** for big surfaces (the desk, the walls, the floor): they stop the pointer from reaching clickable things behind
 * them. At a station they count as outside it: hovering one says so, and a click goes back to the room. */
export const solid = {
  onPointerOver: (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (useRoom.getState().page === "home") return;
    useRoom.getState().setHover(BACK_LABEL);
    document.body.style.cursor = "pointer";
  },
  onPointerOut: () => {
    // only clear our own label: the pointer may already be over something in front with its own
    if (useRoom.getState().hover !== BACK_LABEL) return;
    useRoom.getState().setHover(null);
    document.body.style.cursor = "";
  },
  onClick: (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta <= 6) clickOutside();
  },
};
