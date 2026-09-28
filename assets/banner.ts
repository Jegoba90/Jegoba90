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

const pathData = (font: Font, run: Run): string =>
  font
    .getPath(run.text, run.left, run.baseline, run.size, { kerning: true, letterSpacing: run.spacing })
    .toPathData(2);

// ---------------------------------------------------------------------------
// Lines. Each side is a fan of fine fibres that start spread along the edge,
// fade out towards it, and converge into a tight beam that points at the name.
// A few steeper fibres come up from below and cross the fan, and now and then
// a comet runs along one fibre into the name. The right side mirrors the left.
// ---------------------------------------------------------------------------

const FOCUS = { x: 282, y: 136 }; // where the left beam meets the name
const round = (n: number): number => Math.round(n * 10) / 10;
const mirror = (x: number): number => round(1280 - x);

type Curve = [number, number, number, number, number, number, number, number];

const d = ([x0, y0, x1, y1, x2, y2, x3, y3]: Curve, side: "left" | "right"): string => {
  const x = side === "left" ? (v: number) => round(v) : mirror;
  return `M${x(x0)} ${round(y0)} C${x(x1)} ${round(y1)} ${x(x2)} ${round(y2)} ${x(x3)} ${round(y3)}`;
};

// Mint at the top of the fan, green in the middle, lime at the bottom.
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const hex = (c: string): number[] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (stops: string[], t: number): string => {
  const scaled = t * (stops.length - 1);
  const i = Math.min(Math.floor(scaled), stops.length - 2);
  const [a, b] = [hex(stops[i]), hex(stops[i + 1])];
  return `#${a.map((v, k) => Math.round(lerp(v, b[k], scaled - i)).toString(16).padStart(2, "0")).join("")}`;
};
const FAN_COLORS = ["#2ee6b0", "#4be58a", "#8ee84f", "#b4e33a"];

// 22 fibres, string-art style. Upper fibres drop towards the beam early and
// then run level; lower ones hang low and rise late, so the fan twists
// instead of radiating like a sunburst. Every fibre ends at the same x and
// the beam narrows to a few pixels there; the tip is drawn by the fade mask,
// never by where each line stops, so no end is ever visible as a cut.
const FIBRES = 22;
const fan: { curve: Curve; color: string }[] = Array.from({ length: FIBRES }, (_, i) => {
  const t = i / (FIBRES - 1);
  const u = t * 2 - 1;
  const y0 = 150 + Math.sign(u) * Math.abs(u) ** 1.1 * 270;
  const yEnd = FOCUS.y + u * 2.5;
  const pull = lerp(0.6, 0.12, t); // how early the fibre heads for the beam
  const curve: Curve = [
    -40, y0,
    lerp(-40, FOCUS.x, 0.35), lerp(y0, yEnd, pull),
    FOCUS.x - 90, lerp(yEnd, y0, 0.04),
    FOCUS.x, yEnd,
  ];
  return { curve, color: mix(FAN_COLORS, t) };
});

// A tight bundle of five steep fibres rising from below the card. They level
// out before the tip, so they join the beam from underneath instead of
// crossing it.
const crossers: Curve[] = [178, 188, 198, 208, 218].map((x0, i) => [
  x0, 332,
  x0 + 14, 226 - i * 3,
  FOCUS.x - 70, FOCUS.y + 2,
  FOCUS.x, FOCUS.y + 2.5 - i * 1.25,
]);

// Comets: a white head, a pink body and a long faint tail, all sharing the
// same leading edge. Positions are fractions of the fibre (pathLength = 1).
const COMET = [
  { len: 0.16, color: "#ffa3d3", opacity: 0.28, width: 1.2 },
  { len: 0.07, color: "#ffa3d3", opacity: 0.85, width: 1.4 },
  { len: 0.018, color: "#ffffff", opacity: 1, width: 1.6 },
];
const CYCLE = 7; // seconds
const TRAVEL = 0.55; // share of the cycle a comet spends on its fibre
// [side, fibre index, delay]; delays are negative so comets are already in flight.
const RIDES: ["left" | "right", number, number][] = [
  ["left", 4, 0.4],
  ["left", 12, 3.9],
  ["left", 8, 6.1],
  ["right", 6, 2.2],
  ["right", 14, 5.3],
  ["right", 10, 1.1],
];

const keyframes = COMET.map(
  (c, i) => `@keyframes comet-${i} {
      0% { stroke-dashoffset: ${c.len}; }
      ${round(TRAVEL * 100)}%, 100% { stroke-dashoffset: ${round((c.len - 1.2) * 1000) / 1000}; }
    }`,
).join("\n    ");

const comets = (s: "left" | "right"): string =>
  RIDES.filter(([side]) => side === s)
    .flatMap(([side, fibre, delay]) =>
      COMET.map(
        (c, i) =>
          `<path pathLength="1" d="${d(fan[fibre].curve, side)}" stroke="${c.color}" stroke-opacity="${c.opacity}" stroke-width="${c.width}" stroke-dasharray="${c.len} 2" stroke-dashoffset="${c.len}" style="animation: comet-${i} ${CYCLE}s cubic-bezier(0.5, 0, 0.3, 1) -${delay}s infinite"/>`,
      ),
    )
    .join("\n      ");

const fibres = (side: "left" | "right"): string =>
  [
    ...fan.map(({ curve, color }) => `<path d="${d(curve, side)}" stroke="${color}"/>`),
    ...crossers.map((curve) => `<path d="${d(curve, side)}" stroke="#c2e83a" stroke-width="1.1"/>`),
  ].join("\n      ");

// Luminance masks: fibres are invisible at the edge, full strength along the
// beam, and fade to nothing at the tip, which is what shapes the point.
const fadeMask = (side: "left" | "right"): string => {
  const [x1, x2, x] = side === "left" ? [0, FOCUS.x, 0] : [1280, mirror(FOCUS.x), mirror(FOCUS.x)];
  return `<linearGradient id="fade-${side}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="0" x2="${x2}" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.4" stop-color="#fff" stop-opacity="0.3"/>
      <stop offset="0.72" stop-color="#fff" stop-opacity="1"/>
      <stop offset="0.84" stop-color="#fff" stop-opacity="1"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <mask id="mask-${side}" maskUnits="userSpaceOnUse" x="${x}" y="0" width="${FOCUS.x}" height="320">
      <rect x="${x}" y="0" width="${FOCUS.x}" height="320" fill="url(#fade-${side})"/>
    </mask>`;
};

const side = (s: "left" | "right"): string => `<g mask="url(#mask-${s})" fill="none">
      <g filter="url(#glow)" opacity="0.25" stroke-width="2">
      ${fibres(s)}
      </g>
      <g opacity="0.9" stroke-width="1">
      ${fibres(s)}
      </g>
    </g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="320" viewBox="0 0 1280 320" role="img" aria-labelledby="title">
  <title id="title">Jesús Antonio González, Founder &amp; Builder</title>
  <style>
    ${keyframes}
    @media (prefers-reduced-motion: reduce) {
      .comets { display: none; }
    }
  </style>
  <defs>
    <clipPath id="card"><rect width="1280" height="320" rx="16"/></clipPath>
    <radialGradient id="halo" gradientUnits="userSpaceOnUse" cx="640" cy="160" r="520" gradientTransform="translate(0 160) scale(1 0.327) translate(0 -160)">
      <stop offset="0" stop-color="#18e299" stop-opacity="0.07"/>
      <stop offset="0.7" stop-color="#18e299" stop-opacity="0"/>
    </radialGradient>
    ${fadeMask("left")}
    ${fadeMask("right")}
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2.5"/>
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

    ${side("left")}
    ${side("right")}

    <g class="comets" fill="none" stroke-linecap="round">
      <g mask="url(#mask-left)">
      ${comets("left")}
      </g>
      <g mask="url(#mask-right)">
      ${comets("right")}
      </g>
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
