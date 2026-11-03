"use client";
import { useEffect, useRef, useState } from "react";
import { allSkills, builds, jobs, liveLinks, profile, skillGroups, usedAt, type Build, type Job } from "@/content/profile";
import { STATIONS } from "../camera/stations";
import { sound } from "../lib/audio";
import { layout, MENU, narrow, useRoom, WORK_ITEMS, type Page } from "../store";

const saigonTime = () => new Intl.DateTimeFormat("en-GB", { timeZone: profile.timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());

function useClock() {
  const [t, setT] = useState(saigonTime);
  useEffect(() => {
    const id = setInterval(() => setT(saigonTime()), 15000);
    return () => clearInterval(id);
  }, []);
  return t;
}

// ---------------------------------------------------------------- the card beside each station
const EYEBROW: Partial<Record<Page, string>> = {
  about: "01 · The laptop",
  work: "02 · The cork board",
  stack: "03 · The bookshelf",
  online: "04 · The phone",
};
const TITLE: Partial<Record<Page, string>> = { about: profile.hello, work: "Work", stack: "Stack", online: "Online" };

function JobDetail({ j }: { j: Job }) {
  return (
    <div className="detail">
      <h4>{j.title}{j.org ? <span style={{ fontWeight: 500, color: "var(--muted)" }}> · {j.org}</span> : null}</h4>
      <div className="meta">{j.role} · {j.dates}{j.team ? ` · team of ${j.team}` : ""}</div>
      <p>{j.blurb}</p>
      <ul>{j.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
      <div className="chips">{j.tech.map((t) => <span key={t}>{t}</span>)}</div>
    </div>
  );
}

function BuildDetail({ b }: { b: Build }) {
  return (
    <div className="detail">
      <h4>{b.title}</h4>
      <div className="meta">{b.at} · {b.years}</div>
      <p>{b.blurb}</p>
      <div className="chips">{b.tech.map((t) => <span key={t}>{t}</span>)}</div>
    </div>
  );
}

function WorkBody() {
  const sel = useRoom((s) => s.workSel);
  const select = useRoom((s) => s.selectWork);
  const item = WORK_ITEMS[sel];
  const job = item.kind === "job" ? jobs.find((j) => j.id === item.id) : undefined;
  const build = item.kind === "build" ? builds.find((b) => b.id === item.id) : undefined;
  return (
    <>
      {job && <JobDetail j={job} />}
      {build && <BuildDetail b={build} />}
      <h3>Companies</h3>
      <ul className="list">
        {jobs.map((j, i) => (
          <li key={j.id}>
            <button aria-current={sel === i} onClick={() => select(i)}>
              <span><span className="sw" style={{ background: j.note }} />{j.title}{j.org ? <span style={{ color: "var(--muted)" }}> · {j.org}</span> : null}</span>
              <span className="y">{j.years}</span>
            </button>
          </li>
        ))}
      </ul>
      <h3>Builds</h3>
      <ul className="list">
        {builds.map((b, i) => (
          <li key={b.id}>
            <button aria-current={sel === jobs.length + i} onClick={() => select(jobs.length + i)}>
              <span>{b.title}</span>
              <span className="y">{b.at}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="meta">← → to flip through the board.</p>
    </>
  );
}

function StackBody() {
  const sel = useRoom((s) => s.stackSel);
  const select = useRoom((s) => s.selectStack);
  const skill = sel >= 0 ? allSkills[sel] : null;
  const where = skill ? usedAt(skill) : [];
  return (
    <>
      {skill ? (
        <div className="detail">
          <h4>{skill.name}</h4>
          <div className="meta">{skill.group}</div>
          <p>
            {where.length
              ? <>Used at {where.map((j, i) => <span key={j.id}>{i ? (i === where.length - 1 ? " and " : ", ") : ""}<strong>{j.title}</strong></span>)}.</>
              : "From my skills list; not tied to one job on the CV."}
          </p>
        </div>
      ) : (
        <p>Every book is a skill from my CV. Pick one and it slides out, with where I&apos;ve used it.</p>
      )}
      {skillGroups.map((g) => (
        <div key={g.label}>
          <h3>{g.label}</h3>
          <div className="chips">
            {g.skills.map((s) => {
              const i = allSkills.findIndex((a) => a.name === s.name && a.group === g.label);
              return <button key={s.name} aria-current={sel === i} onClick={() => select(i)}>{s.name}</button>;
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function OnlineBody() {
  const time = useClock();
  const links = liveLinks();
  return (
    <>
      <p>Where to find me. The phone has the same links; click a bubble to open one.</p>
      <ul className="list">
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} target={l.href.startsWith("mailto:") ? undefined : "_blank"} rel="noopener noreferrer">
              <span>{l.label}</span>
              <span className="y">{l.value}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="meta">{profile.location} · {time} here (GMT+7)</p>
    </>
  );
}

function AboutBody() {
  const e = profile.education;
  return (
    <>
      {profile.about.map((p) => <p key={p}>{p}</p>)}
      <h3>Education</h3>
      <p><strong>{e.school}</strong><br />{e.degree} · {e.years} · {e.note}</p>
    </>
  );
}

function Card() {
  const page = useRoom((s) => s.page);
  const entered = useRoom((s) => s.entered);
  const flying = useRoom((s) => s.flying);
  const ref = useRef<HTMLElement>(null);
  // the page whose content the card shows: it keeps the last one while sliding away
  const [shown, setShown] = useState<Page>("about");
  useEffect(() => { if (STATIONS[page].card) setShown(page); }, [page]);
  const open = entered && STATIONS[page].card && !flying;

  // on a phone the card docks to the bottom; the camera frames the room above it
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { if (narrow()) layout.sheetH = el.offsetHeight; });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <section ref={ref} className={`card${open ? " open" : ""}`} aria-labelledby="card-title" aria-hidden={!open} inert={!open}>
      <header>
        <div className="eyebrow">{EYEBROW[shown]}</div>
        <h2 id="card-title">{TITLE[shown]}</h2>
      </header>
      <div className="body">
        {shown === "about" && <AboutBody />}
        {shown === "work" && <WorkBody />}
        {shown === "stack" && <StackBody />}
        {shown === "online" && <OnlineBody />}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- the welcome gate
function Gate() {
  const ready = useRoom((s) => s.ready);
  const entered = useRoom((s) => s.entered);
  const on = useRoom((s) => s.sound);
  const setSound = useRoom((s) => s.setSound);
  const time = useClock();
  const [pct, setPct] = useState(0);
  useEffect(() => {
    // fills toward 90% while the room loads, then to 100% once it has drawn
    let raf = 0, p = 0;
    const t0 = performance.now();
    const tick = () => {
      const t = (performance.now() - t0) / 1000, done = useRoom.getState().ready;
      const target = done ? 100 : Math.min(90, t * 60);
      p = Math.min(100, Math.max(p, Math.round(p + (target - p) * 0.12 + (done ? 1 : 0))));
      setPct(p);
      if (p < 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const done = ready && pct >= 100;
  const enter = () => {
    sound.start(useRoom.getState().sound);
    useRoom.getState().enter();
  };
  return (
    <div className={`gate${entered ? " gone" : ""}`} aria-hidden={entered} inert={entered}>
      <div className="gate-box">
        <div className="when">Sài Gòn · {time} · raining</div>
        <h1>{profile.name}</h1>
        <p>{profile.role}. Come in, it&apos;s raining.</p>
        <div className="phin" aria-hidden="true">
          <div className="top" />
          {!done && <div className="drop" />}
          <div className="cup"><div className="fill" style={{ height: `${pct}%` }} /></div>
        </div>
        {done ? (
          <button className="enter" onClick={enter} autoFocus>Enter</button>
        ) : (
          <div className="meter" role="status">BREWING… {pct}%</div>
        )}
        <div className="sound" role="group" aria-label="Sound">
          Sound
          <button aria-pressed={on} onClick={() => setSound(true)}>On</button>
          <button aria-pressed={!on} onClick={() => setSound(false)}>Off</button>
        </div>
        <a className="lofi" href="./?lofi=1">Prefer a plain page? Lo-fi version</a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- everything over the canvas
export default function Hud() {
  const page = useRoom((s) => s.page);
  const entered = useRoom((s) => s.entered);
  const hover = useRoom((s) => s.hover);
  const on = useRoom((s) => s.sound);
  const go = useRoom((s) => s.go);
  const tip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (tip.current) tip.current.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 16}px)`;
    };
    addEventListener("pointermove", move, { passive: true });
    return () => removeEventListener("pointermove", move);
  }, []);

  const toggleSound = () => {
    const next = !on;
    useRoom.getState().setSound(next);
    sound.start(next);
  };
  const label = page === "home" ? "At the desk" : page === "window" ? "Looking out of the window" : TITLE[page];

  return (
    <>
      <div className="hud-top" style={{ opacity: entered ? 1 : 0, transition: "opacity .6s" }}>
        <button className="hud-name" onClick={() => go("home")}>
          {profile.name}
          <small>{profile.role} · Sài Gòn</small>
        </button>
        <nav className="hud-menu" aria-label="Site">
          {MENU.map((m) => (
            <a
              key={m.page}
              href={`#${m.page}`}
              aria-current={page === m.page ? "page" : undefined}
              onClick={(e) => { e.preventDefault(); sound.click(); go(page === m.page ? "home" : m.page); }}
            >
              <kbd>{m.key}</kbd>{m.label}
            </a>
          ))}
        </nav>
      </div>

      <Card />

      <div className="hud-bottom" style={{ opacity: entered ? 1 : 0, transition: "opacity .6s" }}>
        {page !== "home" ? (
          <button className="pill" onClick={() => go("home")}>← <span className="lbl">Back to the desk · Esc</span></button>
        ) : null}
        <span className="spacer" />
        {page === "home" && <span className="hint">The laptop, the board, the bookshelf and the phone open things. Drag to look around.</span>}
        {page === "window" && <span className="hint">Drag to look around · Esc to come back</span>}
        <span className="spacer" />
        <button className="pill" aria-pressed={on} onClick={toggleSound} aria-label={on ? "Sound on" : "Sound off"}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9h4l5-4v14l-5-4H4z" />
            {on ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9.5l5 5M22 9.5l-5 5" />}
          </svg>
          <span className="lbl">Sound {on ? "on" : "off"}</span>
        </button>
        <a className="pill" href="./?lofi=1" title="A plain page with the same content">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M8.5 8h7M8.5 12h7M8.5 16h4" /></svg>
          <span className="lbl">Lo-fi</span>
        </a>
      </div>

      <div ref={tip} className={`tip${hover && entered ? " on" : ""}`} aria-hidden="true">{hover}</div>
      <div className="sr" aria-live="polite">{entered ? label : ""}</div>
      <Gate />
    </>
  );
}
