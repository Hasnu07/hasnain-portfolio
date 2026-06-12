const fs = require("fs");
const { execSync } = require("child_process");

const path = "bltd-case-study.html";
const html = fs.readFileSync(path, "utf8");
const marker = 'script type="__bundler/manifest"';
const i = html.indexOf(marker);
let shell = i >= 0 ? html.slice(0, i) : html;

const rescaleFn = `function rescalePcScreen() {
  var embed = document.querySelector(".crt-unit.pc-frame .crt-embed");
  if (!embed) return;
  var iframe = embed.querySelector("iframe");
  if (!iframe) return;
  var dw = parseFloat(embed.getAttribute("data-dw")) || 1280;
  var dh = parseFloat(embed.getAttribute("data-dh")) || 960;
  var cw = embed.clientWidth;
  var ch = embed.clientHeight;
  if (!cw || !ch) return;
  iframe.style.position = "absolute";
  iframe.style.left = "50%";
  iframe.style.top = (-ch * 0.05) + "px";
  iframe.style.width = dw + "px";
  iframe.style.height = dh + "px";
  iframe.style.transformOrigin = "top center";
  iframe.style.border = "0";
  var s = Math.max(cw / dw, ch / dh);
  iframe.style.setProperty("transform", "translateX(-50%) scale(" + s + ")", "important");
}`;

const start = shell.indexOf("function rescalePcScreen()");
const end = shell.indexOf("function applyPcFrameMetrics()");
if (start < 0 || end < 0) throw new Error("rescalePcScreen block not found");
shell = shell.slice(0, start) + rescaleFn + "\n\n" + shell.slice(end);
fs.writeFileSync(path, shell);
console.log("patched rescalePcScreen");
execSync("node _merge-bltd.js", { stdio: "inherit" });
