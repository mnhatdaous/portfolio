"use client";
import { useSyncExternalStore } from "react";
import { song } from "@/content/profile";
import { sound } from "../lib/audio";
import { music } from "../lib/music";
import { useRoom } from "../store";
import s from "./Music.module.css";

const Note = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" />
  </svg>
);

/** three little bars that bob while the music plays */
const Bars = () => (
  <svg className={s.bars} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="4.5" y="5" width="3.4" height="14" rx="1.7" /><rect x="10.3" y="5" width="3.4" height="14" rx="1.7" /><rect x="16.1" y="5" width="3.4" height="14" rx="1.7" />
  </svg>
);

/** the music's button for the bottom bar, and the <audio> element it plays (see lib/music) */
export default function Music() {
  const playing = useSyncExternalStore(music.subscribe, music.playing, () => false);
  const name = song.artist ? `${song.title} · ${song.artist}` : song.title;

  const toggle = () => {
    if (music.playing()) return music.pause();
    const st = useRoom.getState();
    if (!st.sound) {
      st.setSound(true);
      sound.start(true);
    }
    music.play();
  };

  return (
    <>
      <button className="pill frost" aria-pressed={playing} onClick={toggle} aria-label={`Music: ${name}`} title={playing ? "Pause the music" : "Play the music"}>
        {playing ? <Bars /> : <Note />}
        <span className="lbl">{name}</span>
      </button>
      <audio ref={music.attach} src={song.src} loop preload="none" />
    </>
  );
}
