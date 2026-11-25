import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono, Patrick_Hand } from "next/font/google";
import { profile } from "@/content/profile";
import "./globals.css";

const display = Be_Vietnam_Pro({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "700", "800"], variable: "--font-display" });
const mono = JetBrains_Mono({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "700"], variable: "--font-mono" });
const hand = Patrick_Hand({ subsets: ["latin", "vietnamese"], weight: "400", variable: "--font-hand" });

/** where the site is published: link previews need absolute URLs for the page and its picture */
const SITE = "https://mnhatdaous.github.io/portfolio/";
/** the picture link previews show (LinkedIn, Facebook, Slack, X…): public/og.jpg, made from the profile photo */
const CARD = { url: "og.jpg", width: 1200, height: 630, alt: `${profile.name}, ${profile.role}` };

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: `${profile.name} · ${profile.role}`,
  description: profile.dek,
  openGraph: { title: profile.name, description: profile.dek, type: "website", url: SITE, images: [CARD] },
  twitter: { card: "summary_large_image", title: profile.name, description: profile.dek, images: [CARD] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#dde7ee" };

// Runs before the page paints. It picks the 3D room or the plain page, so neither flashes before the other:
// - no WebGL 2, or a software renderer (every core goes to drawing): the plain page, with a way into the room
// - ?lofi=1 (the room's LO-FI button): the plain page, remembered in this browser
// - ?room=1: the room, forgetting that choice
const boot = `(function(){var d=document.documentElement,q=location.search,force=/[?&]room=1\\b/.test(q),lofi=/[?&]lofi=1\\b/.test(q);
try{if(force)localStorage.removeItem("view");else if(lofi)localStorage.setItem("view","lofi");else lofi=localStorage.getItem("view")==="lofi";}catch(e){}
var ok=false,soft=false;try{var c=document.createElement("canvas"),g=c.getContext("webgl2");ok=!!g;
if(ok&&!force){var ri=g.getExtension("WEBGL_debug_renderer_info"),rn=String(g.getParameter(ri?ri.UNMASKED_RENDERER_WEBGL:g.RENDERER)||"");soft=/swiftshader|llvmpipe|softpipe|lavapipe|software|basic render/i.test(rn);}
var lc=g&&g.getExtension("WEBGL_lose_context");if(lc)lc.loseContext();}catch(e){}
if(ok)d.classList.add("can-room");if(ok&&!soft&&!lofi)d.classList.add("room");else if(ok&&soft&&!lofi)d.classList.add("soft");})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} ${hand.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
