const fs = require("fs");
const sharp = require("sharp");

const SRC = "assets/pc-frame-source.png";
const OUT = "assets/pc-frame.png";

async function main() {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  function idx(x, y) {
    return (w * y + x) * 4;
  }
  function isOuterBlack(x, y, t = 28) {
    const i = idx(x, y);
    return data[i] < t && data[i + 1] < t && data[i + 2] < t;
  }
  function isScreenBlack(x, y) {
    const i = idx(x, y);
    const sum = data[i] + data[i + 1] + data[i + 2];
    return sum < 110;
  }

  const bg = new Uint8Array(w * h);
  const q = [];
  for (const [x, y] of [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ]) {
    if (isOuterBlack(x, y)) {
      q.push([x, y]);
      bg[w * y + x] = 1;
    }
  }
  while (q.length) {
    const [x, y] = q.pop();
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const k = w * ny + nx;
      if (bg[k] || !isOuterBlack(nx, ny)) continue;
      bg[k] = 1;
      q.push([nx, ny]);
    }
  }

  // Measure the glass opening by wide dark rows (not keyboard channel below).
  let minX = w,
    maxX = 0,
    minY = h,
    maxY = 0;
  for (let y = 80; y < 650; y++) {
    let lx = -1,
      rx = -1,
      dark = 0;
    for (let x = 180; x <= 880; x++) {
      if (!isScreenBlack(x, y)) continue;
      dark++;
      if (lx < 0) lx = x;
      rx = x;
    }
    if (dark < 500 || rx - lx + 1 < 520) continue;
    minX = Math.min(minX, lx);
    maxX = Math.max(maxX, rx);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  const hole = { minX, maxX, minY, maxY };
  while (hole.maxY < h - 1) {
    let dark = 0;
    for (let x = hole.minX + 8; x <= hole.maxX - 8; x++) {
      const i = idx(x, hole.maxY + 1);
      if (data[i] + data[i + 1] + data[i + 2] < 110) dark++;
    }
    if (dark < (hole.maxX - hole.minX) * 0.55) break;
    hole.maxY++;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      const k = w * y + x;
      let alpha = 255;
      if (bg[k]) alpha = 0;
      if (x >= hole.minX && x <= hole.maxX && y >= hole.minY && y <= hole.maxY) {
        alpha = 0;
      }
      data[i + 3] = alpha;
    }
  }

  await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toFile(OUT);

  const pct = {
    left: hole.minX / w,
    top: hole.minY / h,
    width: (hole.maxX - hole.minX + 1) / w,
    height: (hole.maxY - hole.minY + 1) / h,
  };
  console.log("hole px", hole);
  console.log("hole pct", pct);
  fs.writeFileSync("assets/pc-frame-metrics.json", JSON.stringify(pct, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
