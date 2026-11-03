# Dao Minh Nhat · portfolio

A small apartment in Saigon at night, in the monsoon. The site is the room: the laptop is **About**, the cork board is
**Work**, the bookshelf is **Stack** and the phone is **Online**. The camera flies to each one, and an info card opens
beside it. The same content is also a plain page (the **LO-FI** button) for search engines, screen readers and slow
GPUs.

Built with Next.js 16 (static export), React Three Fiber and three.js. Everything is drawn in code: there are no 3D
models, textures or audio files.

Live at **https://mnhatdaous.github.io/portfolio/**

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # static site in out/, ready for Cloudflare Pages, Vercel, GitHub Pages…
```

## Deploy

Every push to `main` builds the site and publishes it to GitHub Pages
([`.github/workflows/pages.yml`](.github/workflows/pages.yml)). Pages serves it under `/portfolio/`, so the workflow
builds with `PAGES_BASE_PATH=/portfolio`, which becomes Next's `basePath`. The page's own links are relative
(`./?lofi=1`), so they need no prefix. To try the Pages build locally, run `PAGES_BASE_PATH=/portfolio npm run build`
and serve `out/` at `/portfolio/`.

## Change the content

Everything the site says is in [`content/profile.ts`](content/profile.ts): the jobs (one sticky note each), the
builds (index cards), the skills (one book each) and the links. Both the room and the plain page read from it.

Still to do:
- add your GitHub and LinkedIn URLs to `links` (links without a URL are hidden)
- if you want your name with diacritics on the site, change `profile.name`

## How the 3D movement works

All in [`components/room/camera/`](components/room/camera/):

- **Stations, not hand-placed cameras.** Each page registers its object (`registerStation`). `frameFor()` measures
  the object's bounding box and backs the camera away along the station's direction until the box fits the part of
  the screen the card leaves free. Move an object and its page re-frames itself.
- **Two cameras.** `rig` is driven by OrbitControls and by flights. The rendered camera copies it, stays inside the
  walls, slides sideways with `setViewOffset` so the object sits beside the card, and drifts a few millimetres like a
  handheld camera.
- **Flights.** Target and position ease together over 1.35 s (ease-in-out cubic), timed on the wall clock. A big turn
  (desk → board or bookshelf) uses two overlapping moves on one clock: the head turns first, then the camera walks in
  (2.6 s).
- **Limits.** Each station allows a little orbiting around its pose. Limits loosen during a flight and settle on
  landing, so nothing snaps.
- **Deep links.** `/#work` starts at the desk, then flies to the board. With *prefers-reduced-motion*, every move is
  an instant cut.

## Map

| Where | What |
|---|---|
| `app/layout.tsx` | fonts, and the boot script that picks the room or the plain page before first paint |
| `components/StaticSite.tsx` | the plain (lo-fi) page |
| `components/room/Experience.tsx` | the canvas, keyboard, back/forward |
| `components/room/store.ts` | page state, selection, lamps, fan |
| `components/room/hud/Hud.tsx` | menu, cards, hover labels, the welcome gate |
| `components/room/scene/` | the room, desk props, board, bookshelf, the alley outside, rain on the glass |
| `components/room/lib/audio.ts` | rain, city hum, motorbikes and fan, generated with Web Audio |

## Keys and URLs

`1`–`4` sections · `Esc` back to the desk · `←` `→` flip through notes or books ·
`/#about` `/#work` `/#stack` `/#online` open a section · `?lofi=1` plain page (remembered) · `?room=1` the 3D room.

Without WebGL 2, or with a software renderer, visitors get the plain page with a link into the room.
