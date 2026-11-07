# Dao Minh Nhat · portfolio

A sunny study on a hill above a lake, on an autumn afternoon. Windows run across the front of the room and down both
sides, so from the middle the view fills half the circle: maples turning, firs, a town on the shore, the lake and snowy
mountains. A black cat sleeps on the desk; pet it.

The site is the room: the computer is **About**, the cork board is **Work**, the bookshelf is **Stack** and the phone
is **Online**. From the middle of the room you can turn all the way round; click one of them and the camera flies to it
and an info card opens beside it. The same content is also a plain page (the **LO-FI** button) for search engines,
screen readers and slow GPUs.

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
- if you want your name with diacritics on the site, change `profile.name`

## How the 3D movement works

All in [`components/room/camera/`](components/room/camera/):

- **Home turns all the way round.** In the middle of the room the orbit target sits 15 cm in front of the eye, so a
  drag turns the head instead of circling an object, with no limit on the turn. The drag grabs the room, as in a
  panorama, and the lens widens. Coming back from a station, you face the thing you just left.
- **Stations, not hand-placed cameras.** Each page registers its object (`registerStation`). `frameFor()` measures
  the object's bounding box and backs the camera away along the station's direction until the box fits the part of
  the screen the card leaves free. Move an object and its page re-frames itself.
- **Two cameras.** `rig` is driven by OrbitControls and by flights. The rendered camera copies it, stays inside the
  walls, slides sideways with `setViewOffset` so the object sits beside the card, and drifts a few millimetres like a
  handheld camera.
- **Flights.** Target and position ease together over 1.35 s (ease-in-out cubic), timed on the wall clock. A big turn
  (say, from facing the desk to the board) uses two overlapping moves on one clock: the head turns first, then the
  camera walks over (2.6 s).
- **Limits.** Each station allows a little orbiting around its pose. Limits loosen during a flight and settle on
  landing, so nothing snaps.
- **Deep links.** `/#work` starts in the middle of the room, then flies to the board. With *prefers-reduced-motion*,
  every move is an instant cut.

## The view

[`components/room/scene/Outside.tsx`](components/room/scene/Outside.tsx) paints it in shaders and instanced meshes. Everything sits
within 215 m, so the depth buffer stays precise; from that far, walking round the room moves it by less than a degree,
which reads as far away.
- the sky: a gradient, a glow toward the sun, and streaks of cloud on a layer overhead
- mountains and hills: ridgelines drawn on cylinders around the room, with snow above a wandering snowline and haze
  low down
- the lake: glints where the sun would reflect
- a hillside running down from a bluff, so the treetops sit below the window line, and a town on the shore
- the trees: firs as stacked cones, maples as clusters of lumpy blobs, with a leafy speckle and a slow sway

## Map

| Where | What |
|---|---|
| `app/layout.tsx` | fonts, and the boot script that picks the room or the plain page before first paint |
| `components/StaticSite.tsx` | the plain (lo-fi) page |
| `components/room/Experience.tsx` | the canvas, keyboard, back/forward |
| `components/room/store.ts` | page state, selection, lamps |
| `components/room/hud/Hud.tsx` | menu, cards, hover labels, the welcome gate |
| `components/room/scene/` | the room, the desk and its things, the cat, the board, the shelves, the view outside |
| `components/room/lib/audio.ts` | wind in the trees, birds, the lake, the cat's purr and meow, all made with Web Audio |

## Keys and URLs

`1`–`4` sections · `Esc` back to the room · `←` `→` turn round in the room, or flip through notes and books ·
`/#about` `/#work` `/#stack` `/#online` open a section · `?lofi=1` plain page (remembered) · `?room=1` the 3D room.

Without WebGL 2, or with a software renderer, visitors get the plain page with a link into the room.
