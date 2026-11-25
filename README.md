# Dao Minh Nhat · portfolio

A sunny study on a hill above a lake, on an autumn afternoon. The glass over the desk runs corner to corner and on up
into a sloped glass roof between slim black steel rafters, and the side windows climb with it, so from the middle the
view fills half the circle and the sky shows overhead: maples turning, firs, a town on the shore, the lake and snowy
mountains. A black cat sleeps on the desk; pet it. The Mona Lisa, The Starry Night and The Great Wave hang above a
big corduroy beanbag, and a guitar on its stand strums when you click it.

The site is the room: the computer is **About**, the cork board is **Work**, the bookshelf is **Stack** and the phone
is **Online**. From the middle of the room you can turn all the way round; click one of them and the camera flies to it
and an info card opens beside it. The same content is also a plain page (the **LO-FI** button) for search engines,
screen readers and slow GPUs.

Built with Next.js 16 (static export), React Three Fiber and three.js. Everything is drawn in code: there are no 3D
models, and the only images are the three paintings, small prints of public-domain scans from Wikimedia Commons in
`public/art/`. The one recording is the music, an hour-long chill mix in `public/audio/` that loops (AAC, about
46 MB, levelled to about -19 LUFS and only loaded once it plays); the wind, the birds, the lake and the cat, and the guitar's
strings, are made with Web Audio.

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

Everything the site says is in [`content/profile.ts`](content/profile.ts): the jobs (one sticky note each on the cork
board), the skills (one book each), the links, and the music the bottom bar plays (a file in `public/audio/`). Both the
room and the plain page read from it.

Still to do:
- if you want your name with diacritics on the site, change `profile.name`

## How the 3D movement works

All in [`components/room/camera/`](components/room/camera/):

- **Home turns all the way round.** In the middle of the room the orbit target sits 15 cm in front of the eye, so a
  drag turns the head instead of circling an object, with no limit on the turn. A scroll turns it too. The view
  stays level: it never tilts up to the ceiling or down to the floor. The drag grabs the room, as in a
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
| `app/layout.tsx` | fonts, the title and link-preview tags, and the boot script that picks the room or the plain page before first paint |
| `public/og.jpg` | the picture link previews show (1200 × 630: the profile photo, name and role) |
| `components/StaticSite.tsx` | the plain (lo-fi) page |
| `components/room/Experience.tsx` | the canvas, keyboard, back/forward |
| `components/room/store.ts` | page state, selection, lamps |
| `components/room/hud/Hud.tsx` | menu, cards, hover labels, the welcome gate |
| `components/room/hud/Music.tsx` | the music's button in the bottom bar, and its `<audio>` element |
| `components/room/scene/` | the room and its glass roof, the desk and its things, the cat, the board, the bookshelf, the wall calendar (a picture of the lake for every month), the paintings and the guitar, the view outside |
| `components/room/lib/audio.ts` | wind in the trees, birds, the lake, the cat's purr and meow, the guitar's strum, all made with Web Audio |
| `components/room/lib/music.ts` | the music: starts on ENTER with sound on, fades with the sound switch, paused by its button |

## Keys and URLs

`1`–`4` sections · `Esc`, or a click anywhere outside the thing you're looking at, back to the room ·
`←` `→` turn round in the room, look along the view from the window, or flip through notes, books and the calendar's year ahead ·
`/#about` `/#work` `/#stack` `/#online` open a section, `/#calendar` the calendar close-up · `?lofi=1` plain page (remembered) · `?room=1` the 3D room.

Without WebGL 2, or with a software renderer, visitors get the plain page with a link into the room.
