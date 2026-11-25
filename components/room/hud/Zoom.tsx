"use client";
import { sound } from "../lib/audio";
import { useRoom, ZOOM } from "../store";
import s from "./Zoom.module.css";

/** − and + for the lens zoom in the bottom bar, the zoom between them while it isn't 1× (a click on it goes back).
 * Pinching, ctrl/⌘ + scroll and the + − 0 keys zoom too (see CameraRig and Experience). */
export default function Zoom() {
  const zoom = useRoom((st) => st.zoom);
  const by = (f: number) => {
    sound.click();
    useRoom.getState().zoomBy(f);
  };
  return (
    <div className={`frost ${s.zoom}`} role="group" aria-label="Zoom">
      <button onClick={() => by(0.8)} disabled={zoom <= ZOOM.min + 1e-3} aria-label="Zoom out" title="Zoom out (−)">
        −
      </button>
      {zoom !== 1 && (
        <button
          className={s.level}
          onClick={() => {
            sound.click();
            useRoom.getState().setZoom(1);
          }}
          aria-label={`Zoom ${zoom.toFixed(1)}×, back to 1×`}
          title="Back to 1× (0)"
        >
          {zoom.toFixed(1)}×
        </button>
      )}
      <button onClick={() => by(1.25)} disabled={zoom >= ZOOM.max - 1e-3} aria-label="Zoom in" title="Zoom in (+)">
        +
      </button>
    </div>
  );
}

/** "· pinch to zoom" for the bottom bar's hint, shown only where the hint still fits on one line with it (narrower
 * screens have the − and + right beside it) */
export function ZoomHint() {
  return <span className={s.hint}> · pinch to zoom</span>;
}
