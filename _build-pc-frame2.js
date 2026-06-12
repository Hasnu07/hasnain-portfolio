// Build a clean transparent PC frame from the high-res white-background source.
// - white background  -> transparent (flood fill from corners)
// - black screen glass -> transparent (flood fill from screen seed)
// - detect screen rect, red LED, and power-button panel; report as % for CSS
const fs = require("fs");
const sharp = require("sharp");

const SRC = "C:/Users/PC/Downloads/retro-computer-on-white-background-still-life-2026-03-10-04-53-55-utc.jpg";
const OUT = "assets/pc-frame.webp";
const SRC_COPY = "assets/pc-frame-source.png";
const OUT_W = 1200; // final asset width (kept small + webp for fast load)

async function main() {
  // copy a downscaled source for the repo record
  await sharp(SRC).resize({ width: 1500 }).png().toFile(SRC_COPY);

  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const idx = (x, y) => (w * y + x) * 4;
  const bright = (i) => (data[i] + data[i + 1] + data[i + 2]) / 3;

  // ---- 1. flood fill background (near-white, corner-connected) ----
  const bg = new Uint8Array(w * h);
  const WHITE = 244;
  const stack = [];
  for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) {
    const k = w * y + x;
    if (bright(idx(x, y)) >= WHITE && !bg[k]) { bg[k] = 1; stack.push(x, y); }
  }
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const k = w * ny + nx;
      if (bg[k] || bright(idx(nx, ny)) < WHITE) continue;
      bg[k] = 1; stack.push(nx, ny);
    }
  }

  // ---- 2. flood fill the black screen from a seed in the upper-center ----
  const isBlack = (x, y) => bright(idx(x, y)) < 70;
  const scr = new Uint8Array(w * h);
  // find a seed: first black pixel near image center, upper third
  let seed = null;
  outer: for (let y = Math.floor(h * 0.18); y < Math.floor(h * 0.45); y++) {
    if (isBlack(Math.floor(w * 0.5), y)) { seed = [Math.floor(w * 0.5), y]; break outer; }
  }
  if (!seed) throw new Error("screen seed not found");
  const s2 = [seed[0], seed[1]];
  scr[w * seed[1] + seed[0]] = 1;
  let sMinX = w, sMaxX = 0, sMinY = h, sMaxY = 0;
  while (s2.length) {
    const y = s2.pop(), x = s2.pop();
    if (x < sMinX) sMinX = x; if (x > sMaxX) sMaxX = x;
    if (y < sMinY) sMinY = y; if (y > sMaxY) sMaxY = y;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const k = w * ny + nx;
      if (scr[k] || !isBlack(nx, ny)) continue;
      scr[k] = 1; s2.push(nx, ny);
    }
  }

  // ---- 3. detect red LED on the chin (below screen, above keyboard) ----
  let lMinX = w, lMaxX = 0, lMinY = h, lMaxY = 0, found = 0;
  for (let y = sMaxY; y < Math.floor(h * 0.90); y++) {
    for (let x = Math.floor(w * 0.45); x < Math.floor(w * 0.95); x++) {
      const i = idx(x, y);
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r > 120 && r - g > 45 && r - b > 45) {
        found++;
        if (x < lMinX) lMinX = x; if (x > lMaxX) lMaxX = x;
        if (y < lMinY) lMinY = y; if (y > lMaxY) lMaxY = y;
      }
    }
  }

  // ---- 4. write alpha (bg + screen -> transparent) ----
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = w * y + x;
    data[idx(x, y) + 3] = (bg[k] || scr[k]) ? 0 : 255;
  }

  // full-res cutout, then downscale (lanczos) for smooth anti-aliased edges,
  // exported as alpha webp to keep the file tiny (~30KB)
  await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .resize({ width: OUT_W }).webp({ quality: 80, alphaQuality: 90, effort: 6 }).toFile(OUT);

  const pct = (v, total) => +(v / total).toFixed(5);
  const metrics = {
    left: pct(sMinX, w), top: pct(sMinY, h),
    width: pct(sMaxX - sMinX + 1, w), height: pct(sMaxY - sMinY + 1, h),
  };
  fs.writeFileSync("assets/pc-frame-metrics.json", JSON.stringify(metrics, null, 2));

  console.log("image", w + "x" + h, "aspect", (w / h).toFixed(4));
  console.log("screen px", { sMinX, sMaxX, sMinY, sMaxY });
  console.log("screen metrics", metrics);
  if (found > 30) {
    console.log("LED px", { lMinX, lMaxX, lMinY, lMaxY }, "count", found);
    console.log("LED %", {
      left: pct(lMinX, w) * 100, top: pct(lMinY, h) * 100,
      width: pct(lMaxX - lMinX + 1, w) * 100, height: pct(lMaxY - lMinY + 1, h) * 100,
      cx: (pct((lMinX + lMaxX) / 2, w) * 100).toFixed(2),
      cy: (pct((lMinY + lMaxY) / 2, h) * 100).toFixed(2),
    });
  } else {
    console.log("LED not confidently found, count=", found);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
