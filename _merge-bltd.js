const fs = require("fs");

const shellPath = "bltd-case-study.html";
const bakPath = "C:/Users/PC/Downloads/BLTD Case Study (offline) (2).html";
const needle = 'script type="__bundler/manifest"';

const shell = fs.readFileSync(shellPath, "utf8");
const bak = fs.readFileSync(bakPath, "utf8");
const j = bak.indexOf(needle);
if (j < 0) throw new Error("manifest not found in backup");

const i = shell.indexOf(needle);
const shellOnly = i >= 0 ? shell.slice(0, i) : shell;
const out = shellOnly + bak.slice(j);
fs.writeFileSync(shellPath, out);
console.log("shell bytes", shellOnly.length, "bundle bytes", bak.length - j, "total MB", (out.length / 1e6).toFixed(2));
