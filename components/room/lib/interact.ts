import type { ThreeEvent } from "@react-three/fiber";
import { useRoom } from "../store";
import { sound } from "./audio";

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

/** for big surfaces (the desk, the walls): they stop the pointer from reaching clickable things behind them */
export const solid = {
  onPointerOver: (e: ThreeEvent<PointerEvent>) => e.stopPropagation(),
  onClick: (e: ThreeEvent<MouseEvent>) => e.stopPropagation(),
};
