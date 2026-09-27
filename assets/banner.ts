// Builds banner.svg, the profile banner with animated lines.
//
// GitHub shows README images through <img>, and an SVG loaded that way cannot
// fetch fonts, so every piece of text is drawn as vector paths from the real
// font files. The layout numbers were measured in Chrome on the HTML version
// of this banner, so the text sits exactly where the browser put it.
//
// Run from this folder: npm i opentype.js@1, then `node banner.ts` (Node 24
// strips the types). It downloads the three font instances from Google Fonts.

import { writeFileSync } from "node:fs";
import opentype from "opentype.js";

type Font = ReturnType<typeof opentype.parse>;

// Asked without a browser user agent, Google Fonts answers with a static TTF
// of the exact instance requested (optical size and weight baked in).
const load = async (family: string): Promise<Font> => {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}`)).text();
  const url = css.match(/https:\/\/[^)]+\.ttf/)?.[0];
  if (!url) throw new Error(`no TTF for ${family}`);
  return opentype.parse(await (await fetch(url)).arrayBuffer());
};

const serif = await load("Newsreader:opsz,wght@64,400");
const serifItalic = await load("Newsreader:ital,opsz,wght@1,23,400");
const sans = await load("Inter:opsz,wght@20,500");
// Measured in Chrome: left edge of each run and its baseline.
const NAME = { text: "Jesús Antonio González", left: 318.34, baseline: 153.5, size: 64, spacing: -0.015 };
const FOUNDER = { text: "Founder ", left: 550.19, baseline: 207.5, size: 20, spacing: 0.01 };
const AMP = { text: "&", left: 638.19, baseline: 207.5, size: 23, spacing: 0 };
const BUILDER = { text: " Builder", left: 655.78, baseline: 207.5, size: 20, spacing: 0.01 };

type Run = typeof NAME;

// CSS letter-spacing adds the space after every glyph, the last one included.
const width = (font: Font, run: Run): number =>
  font.getAdvanceWidth(run.text, run.size, { kerning: true }) + run.spacing * run.size * [...run.text].length;

const pathData = (font: Font, run: Run): string =>
  font
    .getPath(run.text, run.left, run.baseline, run.size, { kerning: true, letterSpacing: run.spacing })
    .toPathData(2);

const nameWidth = width(serif, NAME);

// Four lines per side: spread at the edge, parallel where they meet the name.
const LEFT = [
  "M0 50 C120 50 140 121 236 121 L280 121",
  "M0 108 C120 108 140 131 236 131 L280 131",
  "M0 206 C120 206 140 141 236 141 L280 141",
  "M0 266 C120 266 140 151 236 151 L280 151",
];
const RIGHT = [
  "M1280 56 C1160 56 1140 121 1044 121 L1000 121",
  "M1280 100 C1160 100 1140 131 1044 131 L1000 131",
  "M1280 214 C1160 214 1140 141 1044 141 L1000 141",
  "M1280 262 C1160 262 1140 151 1044 151 L1000 151",
];

// Pulse delays are negative so the first frame already has pulses in flight.
const DURATION = 3.6;
const DELAYS_LEFT = [0, 1.8, 0.9, 2.7];
const DELAYS_RIGHT = [0.45, 2.25, 1.35, 3.15];

const lines = (paths: string[], side: "left" | "right", attrs: string): string =>
  paths.map((d) => `<path d="${d}" stroke="url(#fade-${side})" ${attrs}/>`).join("\n    ");

const pulses = (paths: string[], side: "left" | "right", delays: number[], attrs: string): string =>
  paths
    .map(
      (d, i) =>
        `<path class="pulse" pathLength="1" style="animation-delay:-${delays[i]}s" d="${d}" stroke="url(#pulse-${side})" ${attrs}/>`,
    )
    .join("\n    ");

const gradient = (id: string, x1: number, x2: number, stops: [number, string, number][]): string =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="0" x2="${x2}" y2="0">
      ${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("\n      ")}
    </linearGradient>`;

const FADE: [number, string, number][] = [
  [0, "#18e299", 0],
  [0.45, "#18e299", 0.9],
  [0.85, "#a6fb33", 1],
  [1, "#a6fb33", 0],
];
const PULSE: [number, string, number][] = [
  [0, "#c9f790", 0],
  [0.3, "#7ee4b4", 1],
  [0.85, "#e6ffc2", 1],
  [1, "#e6ffc2", 0],
];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="320" viewBox="0 0 1280 320" role="img" aria-labelledby="title">
  <title id="title">Jesús Antonio González, Founder &amp; Builder</title>
  <style>
    .pulse {
      stroke-dasharray: 0.14 1.2;
      stroke-dashoffset: 0.14;
      animation: flow ${DURATION}s cubic-bezier(0.45, 0, 0.25, 1) infinite;
    }
    @keyframes flow {
      0% { stroke-dashoffset: 0.14; }
      75%, 100% { stroke-dashoffset: -1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .pulse { animation: none; visibility: hidden; }
    }
  </style>
  <defs>
    <clipPath id="card"><rect width="1280" height="320" rx="16"/></clipPath>
    <radialGradient id="halo" gradientUnits="userSpaceOnUse" cx="640" cy="160" r="520" gradientTransform="translate(0 160) scale(1 0.327) translate(0 -160)">
      <stop offset="0" stop-color="#18e299" stop-opacity="0.07"/>
      <stop offset="0.7" stop-color="#18e299" stop-opacity="0"/>
    </radialGradient>
    ${gradient("fade-left", 0, 280, FADE)}
    ${gradient("fade-right", 1280, 1000, FADE)}
    ${gradient("pulse-left", 0, 280, PULSE)}
    ${gradient("pulse-right", 1280, 1000, PULSE)}
    <filter id="glow" x="-10%" y="-50%" width="120%" height="200%">
      <feGaussianBlur stdDeviation="3"/>
    </filter>
  </defs>

  <g clip-path="url(#card)">
    <rect width="1280" height="320" fill="#08090a"/>
    <rect width="1280" height="320" fill="url(#halo)"/>

    <!-- Frame guides, as on mintlify.com -->
    <g stroke="#141618" stroke-width="1">
      <line x1="64.5" y1="0" x2="64.5" y2="320"/>
      <line x1="1215.5" y1="0" x2="1215.5" y2="320"/>
      <line x1="0" y1="40.5" x2="1280" y2="40.5"/>
      <line x1="0" y1="279.5" x2="1280" y2="279.5"/>
    </g>

    <!-- Resting lines: a soft glow, then the sharp line -->
    <g fill="none" opacity="0.3" filter="url(#glow)" stroke-width="2">
    ${lines(LEFT, "left", "")}
    ${lines(RIGHT, "right", "")}
    </g>
    <g fill="none" opacity="0.6">
    ${lines(LEFT, "left", "")}
    ${lines(RIGHT, "right", "")}
    </g>

    <!-- Pulses travelling from the edges into the name -->
    <g fill="none" stroke-linecap="round" filter="url(#glow)" stroke-width="4" opacity="0.8">
    ${pulses(LEFT, "left", DELAYS_LEFT, "")}
    ${pulses(RIGHT, "right", DELAYS_RIGHT, "")}
    </g>
    <g fill="none" stroke-linecap="round" stroke-width="1.6">
    ${pulses(LEFT, "left", DELAYS_LEFT, "")}
    ${pulses(RIGHT, "right", DELAYS_RIGHT, "")}
    </g>

    <!-- Text, drawn from the font outlines -->
    <path fill="#f4f4f5" d="${pathData(serif, NAME)}"/>
    <path fill="#9b9ea4" d="${pathData(sans, FOUNDER)} ${pathData(sans, BUILDER)}"/>
    <path fill="#18e299" d="${pathData(serifItalic, AMP)}"/>
  </g>
  <rect x="0.5" y="0.5" width="1279" height="319" rx="15.5" fill="none" stroke="#1c1e21"/>
</svg>
`;

writeFileSync(new URL("./banner.svg", import.meta.url), svg);
console.log(`banner.svg: ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB`);
