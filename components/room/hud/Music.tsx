"use client";
import { useEffect, useRef, useState } from "react";
import { song } from "@/content/profile";
import { sound } from "../lib/audio";
import { useRoom } from "../store";
import s from "./Music.module.css";

// The room's song, played in the page by YouTube's own player from the official upload. YouTube lets a site play its
// videos this way as long as the player stays on screen while it plays (never hidden, never audio only), so the song
// comes with a small player card. The player is only made when the visitor asks for the song, so until then the page
// makes no requests to YouTube; closing the card removes it, which stops the song.

const HOST = "https://www.youtube-nocookie.com";

function embedUrl(id: string) {
  const q = new URLSearchParams({
    autoplay: "1",
    playsinline: "1",
    // a single video loops as a playlist of itself
    loop: "1",
    playlist: id,
    rel: "0",
    // lets the room's sound switch pause and resume it (see `command`)
    enablejsapi: "1",
    origin: location.origin,
  });
  return `${HOST}/embed/${id}?${q}`;
}

/** play or pause the player, through YouTube's postMessage API */
function command(frame: HTMLIFrameElement | null, func: "playVideo" | "pauseVideo") {
  frame?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), HOST);
}

const Note = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" />
  </svg>
);

/** the song's button for the bottom bar, and the player card it opens */
export default function Music() {
  const [src, setSrc] = useState<string | null>(null);
  const open = src !== null;
  const on = useRoom((st) => st.sound);
  const frame = useRef<HTMLIFrameElement>(null);
  /** the room's sound switch paused the song, so switching it back on carries on with it */
  const hushed = useRef(false);

  useEffect(() => {
    if (!open) return;
    if (!on) {
      hushed.current = true;
      command(frame.current, "pauseVideo");
    } else if (hushed.current) {
      hushed.current = false;
      command(frame.current, "playVideo");
    }
  }, [on, open]);

  const close = () => setSrc(null);
  const toggle = () => {
    if (open) return close();
    // asking for the song is asking for sound
    const st = useRoom.getState();
    if (!st.sound) {
      st.setSound(true);
      sound.start(true);
    }
    hushed.current = false;
    setSrc(embedUrl(song.youtube));
  };

  return (
    <>
      <button
        className="pill frost"
        aria-pressed={open}
        onClick={toggle}
        aria-label={`Play ${song.title} by ${song.artist}`}
        title={open ? "Stop the song" : `Play ${song.title} by ${song.artist}`}
      >
        <Note />
        <span className="lbl">{song.title} · {song.artist}</span>
      </button>
      {src && (
        <aside className={`${s.player} frost`} aria-label="Now playing">
          <header className={s.head}>
            <div className={s.what}>
              <div className={s.eyebrow}>Now playing</div>
              <div className={s.title}>{song.title} <span>· {song.artist}</span></div>
            </div>
            <a className={s.btn} href={song.href} target="_blank" rel="noopener noreferrer" aria-label="Open on YouTube" title="Open on YouTube">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </a>
            <button className={s.btn} onClick={close} aria-label="Stop the song and close the player" title="Stop and close">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </header>
          <iframe
            ref={frame}
            className={s.video}
            src={src}
            title={`${song.title} by ${song.artist}, on YouTube`}
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </aside>
      )}
    </>
  );
}
