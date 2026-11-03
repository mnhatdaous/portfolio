import type { NextConfig } from "next";

// Static export: `next build` writes plain files to out/, which any static host
// (Cloudflare Pages, Vercel, GitHub Pages) can serve. On GitHub Pages the site lives under
// /portfolio/, so the deploy workflow passes that in PAGES_BASE_PATH. The page's own links
// are relative (./?lofi=1), so they work under any path.
const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.PAGES_BASE_PATH ?? "",
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
