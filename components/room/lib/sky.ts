import { useEffect, useState } from "react";
import * as THREE from "three";
import { profile } from "@/content/profile";

// The time of day and the season, in Sài Gòn (the room's own time, as the clock on the computer shows it), and what
// follows from them: where the sun and the moon are, the colours of the sky, the light and the lake, how dark it is.
// The day follows the real clock and the season the calendar (the view is a northern lake, so November is autumn).
// To look at another time: ?time=7:30 (or dawn, morning, noon, afternoon, evening, sunset, dusk, night),
// ?season=winter, and ?speed=600 to watch the day go by.

export type Season = "spring" | "summer" | "autumn" | "winter";
export const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];
const BY_MONTH: Season[] = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"];
const NAMED: Record<string, number> = {
  dawn: 5.65, sunrise: 6.3, morning: 8, noon: 12, afternoon: 15.3, evening: 17.1, sunset: 17.55, dusk: 18.05, night: 21.5, midnight: 0,
};

// ---------------------------------------------------------------- the clock
type Setup = { base: number; start: number; rate: number; season: Season | null };
let setup: Setup | null = null;

function init(): Setup {
  const start = Date.now();
  if (typeof window === "undefined") return { base: start + 7 * 3.6e6, start, rate: 1, season: null };
  // the room's wall clock, as a timestamp whose UTC fields read Sài Gòn time (it keeps no daylight saving)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: profile.timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",
  }).formatToParts(new Date(start));
  const get = (t: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const midnight = Date.UTC(get("year"), get("month") - 1, get("day"));
  const wall = midnight + (((get("hour") % 24) * 60 + get("minute")) * 60 + get("second")) * 1000 + (start % 1000);
  const q = new URLSearchParams(window.location.search);
  const t = q.get("time")?.trim().toLowerCase(), s = q.get("season")?.trim().toLowerCase(), speed = Number(q.get("speed")) || 0;
  let base = wall, rate = speed || 1;
  if (t) {
    const m = /^(\d{1,2})(?:[:h](\d{2}))?$/.exec(t);
    const hours = t in NAMED ? NAMED[t] : m ? (Number(m[1]) % 24) + Number(m[2] ?? 0) / 60 : NaN;
    // a time asked for stays put, unless it's asked to run as well
    if (Number.isFinite(hours)) { base = midnight + hours * 3.6e6; rate = speed; }
  }
  return { base, start, rate, season: (SEASONS as string[]).includes(s ?? "") ? (s as Season) : null };
}

/** the room's clock: the hour (0–24), the day of the year and the month */
export function roomClock() {
  setup ??= init();
  const ms = setup.base + (Date.now() - setup.start) * setup.rate, d = new Date(ms);
  return {
    hours: (((ms % 864e5) + 864e5) % 864e5) / 3.6e6,
    doy: Math.floor((ms - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5) + 1,
    month: d.getUTCMonth(),
  };
}

export function seasonNow(): Season {
  setup ??= init();
  return setup.season ?? BY_MONTH[roomClock().month];
}

/** the season, looked at again every half minute (it only changes when the month does) */
export function useSeason() {
  const [season, set] = useState<Season>(seasonNow);
  useEffect(() => {
    const id = window.setInterval(() => set(seasonNow()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return season;
}

// ---------------------------------------------------------------- the sun and the moon
const { smoothstep } = THREE.MathUtils;

/** the day's shape at Sài Gòn's latitude: about twelve hours of daylight all year, a little more in June */
function dayShape(doy: number) {
  const k = Math.cos((2 * Math.PI * (doy - 172)) / 365), len = 12 + 0.65 * k, noon = 11.8;
  return { rise: noon - len / 2, set: noon + len / 2, noon, maxEl: THREE.MathUtils.degToRad(66 + 10 * k) };
}
type Day = ReturnType<typeof dayShape>;

/** a direction from its angle round (0 on the right, π/2 out in front of the windows, π on the left) and its height */
function skyDir(A: number, el: number, out: THREE.Vector3) {
  const hx = Math.cos(A), hz = -(Math.sin(A) + 0.5), n = Math.hypot(hx, hz);
  return out.set((hx / n) * Math.cos(el), Math.sin(el), (hz / n) * Math.cos(el));
}

/** toward the sun, or toward where it is under the horizon: it rises low on the right, crosses in front of the
 * windows, high at noon, and sets on the left */
function sunDir(h: number, s: Day, out: THREE.Vector3) {
  const L = s.set - s.rise, p = (h - s.rise) / L;
  if (p >= 0 && p <= 1) return skyDir(Math.PI * p, s.maxEl * Math.sin(Math.PI * p), out);
  const q = ((((h - s.set) % 24) + 24) % 24) / (24 - L);
  return skyDir(Math.PI * (1 + q), -0.9 * Math.sin(Math.PI * q), out);
}

/** the moon crosses the same way through the night, rising as the sun sets */
function moonDir(h: number, s: Day, out: THREE.Vector3) {
  const L = s.set - s.rise, q = ((((h - s.set) % 24) + 24) % 24) / (24 - L);
  if (q > 1) return out.set(0, -1, 0);
  return skyDir(Math.PI * q, 0.78 * Math.sin(Math.PI * q) - 0.04, out);
}

// ---------------------------------------------------------------- how it looks through the day
type Look = {
  /** the sky: overhead, halfway down, at the horizon; the clouds lit and in shade; the haze in the distance */
  zenith: string; mid: string; horizon: string; cloud: string; cloudShade: string; haze: string;
  /** the glow round the sun, and how strongly it lights the horizon on its side */
  glow: string; glowK: number; stars: number;
  /** the sun's light, the sky's light through the windows, and the light all round */
  sunC: string; sunK: number; win: string; winK: number; hemiSky: string; hemiGround: string; hemiK: number;
  /** the lake near and far, the darker band under the far shore, the glitter on it */
  near: string; far: string; shore: string; glint: string;
  /** the light on the mountains and the hills, as a multiplier */
  tint: [number, number, number];
};
const LOOKS: Record<"night" | "predawn" | "sunrise" | "morning" | "noon" | "afternoon" | "golden" | "sunset" | "dusk", Look> = {
  night: {
    zenith: "#060c20", mid: "#0d1733", horizon: "#1c2949", cloud: "#26324e", cloudShade: "#111a2d", haze: "#111b34",
    glow: "#000000", glowK: 0, stars: 1,
    sunC: "#000000", sunK: 0, win: "#5a6fae", winK: 0.14, hemiSky: "#27366c", hemiGround: "#0f0c0b", hemiK: 0.34,
    near: "#0b1430", far: "#172342", shore: "#080e1c", glint: "#b4c2ff", tint: [0.05, 0.066, 0.12],
  },
  predawn: {
    zenith: "#15224a", mid: "#33427a", horizon: "#a87f9e", cloud: "#6c6b8e", cloudShade: "#353a58", haze: "#59658c",
    glow: "#ff9e7a", glowK: 0.35, stars: 0.35,
    sunC: "#000000", sunK: 0, win: "#7e83b8", winK: 0.3, hemiSky: "#4c5486", hemiGround: "#221c20", hemiK: 0.42,
    near: "#3e4c78", far: "#8a86ae", shore: "#323a52", glint: "#ffc6b4", tint: [0.2, 0.19, 0.28],
  },
  sunrise: {
    zenith: "#4b73b0", mid: "#9ab3d6", horizon: "#f3c09a", cloud: "#ffd8b6", cloudShade: "#a6a6c2", haze: "#d8c4ba",
    glow: "#ffb070", glowK: 0.6, stars: 0,
    sunC: "#ff9e66", sunK: 1.8, win: "#f1cdb8", winK: 0.65, hemiSky: "#d9c3bf", hemiGround: "#7a5a44", hemiK: 0.55,
    near: "#86a0c2", far: "#e4c0ae", shore: "#6d7684", glint: "#ffd2a0", tint: [0.78, 0.6, 0.5],
  },
  morning: {
    zenith: "#5a8fd0", mid: "#a2c4e6", horizon: "#e4ecf0", cloud: "#ffffff", cloudShade: "#c8d2e0", haze: "#dde6ec",
    glow: "#fff0d8", glowK: 0.15, stars: 0,
    sunC: "#ffe2c0", sunK: 4.4, win: "#eef3fb", winK: 1, hemiSky: "#dbe8f5", hemiGround: "#a37b52", hemiK: 0.72,
    near: "#7ea5c6", far: "#c6d8e8", shore: "#7f9497", glint: "#fff6e0", tint: [0.96, 0.92, 0.86],
  },
  noon: {
    zenith: "#4a88d6", mid: "#8fbbe6", horizon: "#dce9f3", cloud: "#ffffff", cloudShade: "#c3cede", haze: "#d6e3ee",
    glow: "#ffffff", glowK: 0.08, stars: 0,
    sunC: "#fff4e6", sunK: 5.6, win: "#eef4fc", winK: 1.1, hemiSky: "#e3eef9", hemiGround: "#a8845c", hemiK: 0.85,
    near: "#6c9ccc", far: "#b6d2ea", shore: "#7a9498", glint: "#ffffff", tint: [1.04, 1.04, 1.04],
  },
  afternoon: {
    zenith: "#5d90cc", mid: "#9bbfe2", horizon: "#e2eaef", cloud: "#ffffff", cloudShade: "#c3cede", haze: "#dbe5ec",
    glow: "#ffdca3", glowK: 0.14, stars: 0,
    sunC: "#ffe3bf", sunK: 5.5, win: "#eaf2fb", winK: 1, hemiSky: "#dbe8f5", hemiGround: "#a37b52", hemiK: 0.75,
    near: "#7ea5c6", far: "#c3d6e6", shore: "#7f9497", glint: "#fff5dc", tint: [1, 1, 1],
  },
  golden: {
    zenith: "#5781bf", mid: "#a7b8d6", horizon: "#f0cfa9", cloud: "#ffe6c6", cloudShade: "#b8b0c4", haze: "#e4d2c2",
    glow: "#ffc070", glowK: 0.35, stars: 0,
    sunC: "#ffc68a", sunK: 4.3, win: "#f4dec8", winK: 0.85, hemiSky: "#ecd6c2", hemiGround: "#9a6e48", hemiK: 0.66,
    near: "#879dba", far: "#e0cab4", shore: "#777d86", glint: "#ffd49a", tint: [1, 0.84, 0.66],
  },
  sunset: {
    zenith: "#34508c", mid: "#a4809c", horizon: "#ff9455", cloud: "#ffad78", cloudShade: "#85698a", haze: "#c4967f",
    glow: "#ff8a40", glowK: 0.8, stars: 0,
    sunC: "#ff8c4c", sunK: 1.5, win: "#f2b996", winK: 0.55, hemiSky: "#e6b39a", hemiGround: "#6e4a38", hemiK: 0.5,
    near: "#72799c", far: "#e6a484", shore: "#565868", glint: "#ffaa6a", tint: [0.78, 0.52, 0.44],
  },
  dusk: {
    zenith: "#19275a", mid: "#454a82", horizon: "#cf7d78", cloud: "#806484", cloudShade: "#3a3a5c", haze: "#64597c",
    glow: "#ff7a5c", glowK: 0.35, stars: 0.2,
    sunC: "#000000", sunK: 0, win: "#7c78ad", winK: 0.28, hemiSky: "#5e5f92", hemiGround: "#241e24", hemiK: 0.4,
    near: "#343c62", far: "#635e86", shore: "#262a3c", glint: "#e09aa0", tint: [0.24, 0.21, 0.31],
  },
};

const COLORS = ["zenith", "mid", "horizon", "cloud", "cloudShade", "haze", "glow", "sunC", "win", "hemiSky", "hemiGround", "near", "far", "shore", "glint"] as const;
const NUMBERS = ["glowK", "stars", "sunK", "winK", "hemiK"] as const;
type LookC = Record<(typeof COLORS)[number], THREE.Color> & Record<(typeof NUMBERS)[number], number> & { tint: THREE.Color };
function compile(l: Look): LookC {
  const out = { tint: new THREE.Color(...l.tint) } as LookC;
  for (const k of COLORS) out[k] = new THREE.Color(l[k]);
  for (const k of NUMBERS) out[k] = l[k];
  return out;
}
const L = Object.fromEntries(Object.entries(LOOKS).map(([k, v]) => [k, compile(v)])) as Record<keyof typeof LOOKS, LookC>;
/** the looks in the day's order, and the hours they're at (set from the day's sunrise and sunset) */
const ORDER = [L.night, L.predawn, L.sunrise, L.morning, L.noon, L.afternoon, L.golden, L.sunset, L.dusk, L.night];
const AT = new Float64Array(ORDER.length);
function keyHours(s: Day) {
  AT.set([s.rise - 1.4, s.rise - 0.55, s.rise + 0.2, s.rise + 2.2, s.noon + 0.2, s.set - 2.3, s.set - 0.75, s.set - 0.05, s.set + 0.45, s.set + 1.25]);
}

// ---------------------------------------------------------------- the state everything reads
const looks = () => compile(LOOKS.afternoon);
/** now: the sun, the moon, the colours, and the light that casts the shadows (the sun by day, the moon by night).
 * The Color and Vector3 objects are changed in place, so shaders can hold them as uniforms. */
export const SKY = {
  hours: 15.3, rise: 6.2, set: 17.6,
  sun: new THREE.Vector3(-0.55, 0.5, -0.67).normalize(),
  moon: new THREE.Vector3(0, -1, 0),
  light: new THREE.Vector3(-0.55, 0.5, -0.67).normalize(),
  lightColor: new THREE.Color("#ffe3bf"),
  lightK: 5.5,
  /** the sine of the sun's height: below 0 it has set */
  sunSin: 0.5,
  /** 0 by day, 1 once it's properly dark */
  night: 0,
  ...looks(),
};
/** the numbers the shaders read, wrapped as uniforms */
export const U = {
  glowK: { value: 0.14 }, stars: { value: 0 }, sunVis: { value: 1 }, moonVis: { value: 0 }, night: { value: 0 }, day: { value: 1 },
  glintK: { value: 1 }, side: { value: 1 }, hours: { value: 15.3 }, rise: { value: 6.2 }, set: { value: 17.6 },
  /** set by the view for the season: 1 in winter, when snow lies on the trees */
  snow: { value: 0 },
};
const MOONLIGHT = new THREE.Color("#a9bce8");

/** work out the sky for now; once a frame */
export function updateSky() {
  const { hours, doy } = roomClock(), s = dayShape(doy);
  SKY.hours = U.hours.value = hours;
  SKY.rise = U.rise.value = s.rise;
  SKY.set = U.set.value = s.set;
  sunDir(hours, s, SKY.sun);
  moonDir(hours, s, SKY.moon);
  const e = SKY.sun.y;
  SKY.sunSin = e;
  SKY.night = U.night.value = 1 - smoothstep(e, -0.2, -0.015);
  U.day.value = 1 - SKY.night;
  const sunVis = (U.sunVis.value = smoothstep(e, -0.035, 0.015));
  const moonVis = (U.moonVis.value = SKY.night * smoothstep(SKY.moon.y, 0.02, 0.15));

  // between the two looks either side of now
  keyHours(s);
  let a = ORDER[0], b = ORDER[0], t = 0;
  for (let i = 0; i < AT.length - 1; i++) {
    if (hours >= AT[i] && hours < AT[i + 1]) {
      a = ORDER[i];
      b = ORDER[i + 1];
      t = smoothstep(hours, AT[i], AT[i + 1]);
      break;
    }
  }
  for (const k of COLORS) SKY[k].lerpColors(a[k], b[k], t);
  for (const k of NUMBERS) SKY[k] = a[k] + (b[k] - a[k]) * t;
  SKY.tint.lerpColors(a.tint, b.tint, t);
  U.glowK.value = SKY.glowK;
  U.stars.value = SKY.stars;

  // the light that casts the shadows: the sun while it's up, then the moon once it's risen
  const sunUp = smoothstep(e, -0.005, 0.05);
  if (sunUp > 0.02 || moonVis < 0.02) {
    SKY.light.copy(SKY.sun);
    SKY.lightColor.copy(SKY.sunC);
    SKY.lightK = SKY.sunK * sunUp;
  } else {
    SKY.light.copy(SKY.moon);
    SKY.lightColor.copy(MOONLIGHT);
    SKY.lightK = 0.55 * moonVis;
  }
  U.glintK.value = sunVis + moonVis * 0.8;
  // which side of the mountains faces the light: +1 when it's on the left
  U.side.value = THREE.MathUtils.clamp(-SKY.light.x * 1.8, -1, 1);
}
