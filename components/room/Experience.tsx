"use client";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useState } from "react";
import { profile } from "@/content/profile";
import { INTRO } from "./camera/CameraRig";
import Hud from "./hud/Hud";
import { sound } from "./lib/audio";
import Scene from "./scene/Scene";
import { cardWidth, MENU, pageFromHash, useRoom } from "./store";

// The 3D room: the canvas, and the HUD over it.
export default function Experience() {
  const ready = useRoom((s) => s.ready);
  const [cw, setCw] = useState(cardWidth);

  useEffect(() => {
    const resize = () => setCw(cardWidth());
    // Back and Forward fly between stations, like links do
    const pop = () => { if (useRoom.getState().entered) useRoom.getState().go(pageFromHash(), { fromHistory: true }); };
    const key = (e: KeyboardEvent) => {
      const s = useRoom.getState();
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!s.entered) {
        if (e.key === " " && s.ready && !(e.target instanceof HTMLButtonElement)) {
          e.preventDefault();
          sound.start(s.sound);
          s.enter();
        }
        return;
      }
      if (e.key === "Escape") return s.go("home");
      const m = MENU.find((x) => x.key === e.key);
      if (m) return s.go(m.page);
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const d = e.key === "ArrowRight" ? 1 : -1;
        if (s.page === "work") s.selectWork(s.workSel + d);
        else if (s.page === "stack") s.selectStack(s.stackSel < 0 && d < 0 ? 0 : s.stackSel + d);
      }
    };
    addEventListener("resize", resize);
    addEventListener("popstate", pop);
    addEventListener("keydown", key);
    return () => {
      removeEventListener("resize", resize);
      removeEventListener("popstate", pop);
      removeEventListener("keydown", key);
    };
  }, []);

  return (
    <div id="room" className={ready ? "ready" : undefined} style={{ ["--card-w" as string]: `${cw}px` }}>
      <Canvas
        shadows="percentage"
        dpr={[1, 1.75]}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
        camera={{ fov: 36, near: 0.03, far: 220, position: [INTRO.pos.x, INTRO.pos.y, INTRO.pos.z] }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <h1 className="sr">{profile.name}, {profile.role}</h1>
      <p className="sr">
        A small apartment in Saigon at night, rain on the window. The laptop opens About, the cork board Work, the
        bookshelf Stack and the phone Online. A plain version of this page is linked at the bottom.
      </p>
      <Hud />
    </div>
  );
}
