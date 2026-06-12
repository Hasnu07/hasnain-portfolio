// Generate a cracked-glass SVG overlay for the CRT screen, preview it, and emit base64.
const fs = require("fs");
const sharp = require("sharp");

const W = 1000, H = 746;
// impact point (upper-right-ish, off-center so it reads as an accident)
const ix = 712, iy = 232;

// deterministic pseudo-random so the crack is stable across rebuilds
let seed = 1337;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

function radial(angle, len, jitter) {
  // jagged line from impact outward
  let pts = [[ix, iy]];
  const steps = 5 + Math.floor(rnd() * 3);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const r = len * t;
    const a = angle + (rnd() - 0.5) * jitter * (1 - t * 0.4);
    pts.push([ix + Math.cos(a) * r, iy + Math.sin(a) * r]);
  }
  return pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
}

let lines = [];
const N = 9;
for (let i = 0; i < N; i++) {
  const ang = (i / N) * Math.PI * 2 + rnd() * 0.4;
  const len = 360 + rnd() * 460;
  lines.push(radial(ang, len, 0.5));
  // occasional branch
  if (rnd() > 0.5) {
    const bAng = ang + (rnd() - 0.5) * 1.2;
    lines.push(radial(bAng, len * (0.4 + rnd() * 0.3), 0.6));
  }
}
// concentric fracture rings (jagged polygons around impact)
function ring(rad) {
  const seg = 13, pts = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const rr = rad * (0.82 + rnd() * 0.36);
    pts.push([ix + Math.cos(a) * rr, iy + Math.sin(a) * rr * 0.92]);
  }
  return pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ") + " Z";
}
const rings = [ring(46), ring(96), ring(168)];

const path = (d, w, o) =>
  `<path d="${d}" fill="none" stroke="#ffffff" stroke-opacity="${o}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;

let body = "";
// soft dark shadow under each crack (depth)
for (const l of lines) body += `<path d="${l}" fill="none" stroke="#000000" stroke-opacity="0.22" stroke-width="3.2" stroke-linejoin="round"/>`;
for (const r of rings) body += `<path d="${r}" fill="none" stroke="#000000" stroke-opacity="0.18" stroke-width="2.6"/>`;
// bright glass glints on top
for (const l of lines) body += path(l, 1.4, 0.85);
for (const r of rings) body += path(r, 1.1, 0.7);
// shatter cluster at impact
for (let i = 0; i < 14; i++) {
  const a = rnd() * Math.PI * 2, r = 6 + rnd() * 30;
  body += path(`M${ix} ${iy} L${(ix + Math.cos(a) * r).toFixed(1)} ${(iy + Math.sin(a) * r).toFixed(1)}`, 1, 0.9);
}
// impact white-out
body += `<circle cx="${ix}" cy="${iy}" r="7" fill="#ffffff" fill-opacity="0.9"/>`;
body += `<circle cx="${ix}" cy="${iy}" r="16" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="1.4"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>`;
fs.writeFileSync("assets/screen-crack.svg", svg);
console.log("svg bytes", svg.length);
console.log("base64 len", Buffer.from(svg).toString("base64").length);

// preview on a dark "screen" to judge readability
sharp({ create: { width: W, height: H, channels: 4, background: { r: 18, g: 22, b: 20, alpha: 1 } } })
  .composite([{ input: Buffer.from(svg) }])
  .png().toFile("_crack-preview.png").then(() => console.log("preview ok"));
