import { create } from "zustand";
import { allSkills, jobs } from "@/content/profile";

// Pages are stations in the room. "window" and "calendar" are close-ups with no card of their own.
export type Page = "home" | "about" | "work" | "stack" | "online" | "window" | "calendar";
export const MENU: { page: Exclude<Page, "home" | "window">; label: string; key: string }[] = [
  { page: "about", label: "About", key: "1" },
  { page: "work", label: "Work", key: "2" },
  { page: "stack", label: "Stack", key: "3" },
  { page: "online", label: "Online", key: "4" },
];
const PAGES: Page[] = ["home", "about", "work", "stack", "online", "window", "calendar"];
/** the lens zoom: 1 frames each view as it was made to be seen; up to 3 looks closer, down to 0.8 a little wider */
export const ZOOM = { min: 0.8, max: 3 };
const clampZoom = (z: number) => {
  const c = Math.min(ZOOM.max, Math.max(ZOOM.min, z));
  return Math.abs(c - 1) < 0.01 ? 1 : c;
};

export function pageFromHash(hash = typeof location !== "undefined" ? location.hash : ""): Page {
  const h = hash.replace(/^#/, "") as Page;
  return PAGES.includes(h) ? h : "home";
}

type RoomState = {
  page: Page;
  /** the visitor clicked ENTER: audio may start, the camera may fly */
  entered: boolean;
  /** the scene has drawn its first frames */
  ready: boolean;
  sound: boolean;
  hover: string | null;
  workSel: number;
  stackSel: number;
  /** the pendant over the desk, the lamp on it, and the reading lamp: all off in the daytime */
  lamp: boolean;
  deskLamp: boolean;
  floorLamp: boolean;
  /** cards are hidden while the camera flies to their station */
  flying: boolean;
  /** the lens zoom (see ZOOM); every page starts at 1 */
  zoom: number;
  go: (page: Page, opts?: { replace?: boolean; fromHistory?: boolean }) => void;
  setHover: (label: string | null) => void;
  enter: () => void;
  setReady: () => void;
  setSound: (on: boolean) => void;
  selectWork: (i: number) => void;
  selectStack: (i: number) => void;
  toggleLamp: () => void;
  toggleDeskLamp: () => void;
  toggleFloorLamp: () => void;
  setFlying: (v: boolean) => void;
  zoomBy: (f: number) => void;
  setZoom: (z: number) => void;
};

export const useRoom = create<RoomState>((set, get) => ({
  page: "home",
  entered: false,
  ready: false,
  sound: true,
  hover: null,
  workSel: 0,
  stackSel: -1,
  lamp: false,
  deskLamp: false,
  floorLamp: false,
  flying: false,
  zoom: 1,
  go: (page, opts = {}) => {
    if (get().page === page) return;
    // the camera is about to move out from under the pointer: drop the hover label until it moves again
    set({ page, hover: null, zoom: 1 });
    if (typeof document !== "undefined") document.body.style.cursor = "";
    if (!opts.fromHistory) {
      const url = page === "home" ? location.pathname + location.search : `#${page}`;
      try {
        if (opts.replace) history.replaceState(null, "", url);
        else history.pushState(null, "", url);
      } catch {}
    }
  },
  setHover: (hover) => set({ hover }),
  enter: () => set({ entered: true }),
  setReady: () => set({ ready: true }),
  setSound: (sound) => set({ sound }),
  // the board's notes, one per job
  selectWork: (i) => set({ workSel: (i + jobs.length) % jobs.length }),
  selectStack: (i) => set({ stackSel: (i + allSkills.length) % allSkills.length }),
  toggleLamp: () => set((s) => ({ lamp: !s.lamp })),
  toggleDeskLamp: () => set((s) => ({ deskLamp: !s.deskLamp })),
  toggleFloorLamp: () => set((s) => ({ floorLamp: !s.floorLamp })),
  setFlying: (flying) => set({ flying }),
  zoomBy: (f) => set((s) => ({ zoom: clampZoom(s.zoom * f) })),
  setZoom: (z) => set({ zoom: clampZoom(z) }),
}));

// for poking at the room from the console while developing
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") (window as unknown as Record<string, unknown>).__room = useRoom;

export const reduceMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
export const isPhone = () =>
  typeof matchMedia !== "undefined" && matchMedia("(hover: none) and (pointer: coarse)").matches && Math.min(innerWidth, innerHeight) < 540;
export const narrow = () => typeof innerWidth !== "undefined" && innerWidth < 760;
/** the card's width on a wide screen, also used by the camera to frame beside it */
export const cardWidth = () => Math.round(Math.min(440, Math.max(340, innerWidth * 0.3)));
/** measured by the HUD: how tall the card is when it docks to the bottom of a phone */
export const layout = { sheetH: 320 };
