#!/usr/bin/env node
// Works out the main color of every achievement icon that doesn't have one yet
// (pink, red, orange, yellow, green, teal, blue, purple, white, gray, black, rainbow),
// then rebuilds the index. Only new icons are downloaded, so normal runs take seconds.
// Needs the "sharp" package (npm install).
// Usage: node scripts/fetch-colors.mjs [--max 20000]
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA, readJson, writeJson } from "./lib.mjs";
import { buildIndex } from "./fetch-achievements.mjs";

const BUCKETS = [["red", 345, 361], ["red", 0, 12], ["orange", 12, 40], ["yellow", 40, 68], ["green", 68, 160],
  ["teal", 160, 195], ["blue", 195, 255], ["purple", 255, 290], ["pink", 290, 345]];

function hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, max ? d / max : 0, max];
}

// rgb: Uint8Array of 24x24x3 pixels
export function classify(rgb) {
  const counts = {}; let colorful = 0, vsum = 0; const n = rgb.length / 3;
  for (let i = 0; i < rgb.length; i += 3) {
    const [h, s, v] = hsv(rgb[i], rgb[i + 1], rgb[i + 2]); vsum += v;
    if (s < 0.28 || v < 0.22) continue;
    colorful++;
    let name = BUCKETS.find(([, lo, hi]) => h >= lo && h < hi)[0];
    if (name === "red" && s < 0.55 && v > 0.75) name = "pink";
    counts[name] = (counts[name] || 0) + 1;
  }
  if (colorful < n * 0.12) { const avg = vsum / n; return avg > 0.72 ? "white" : avg < 0.28 ? "black" : "gray"; }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const strong = ranked.filter(([, c]) => c / colorful >= 0.14);
  if (ranked[0][1] / colorful < 0.42 && strong.length >= 3) return "rainbow";
  return ranked[0][0];
}

async function colorOf(sharp, appid, file) {
  const res = await fetch(`https://shared.akamai.steamstatic.com/community_assets/images/apps/${appid}/${file}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const { data } = await sharp(buf).extract({ left: 4, top: 4, width: 56, height: 56 }).resize(24, 24, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return classify(data);
}

async function main() {
  const args = process.argv.slice(2), mi = args.indexOf("--max");
  const max = mi >= 0 ? Number(args[mi + 1]) : 20000;
  const sharp = (await import("sharp")).default;
  const games = await readJson(path.join(DATA, "games.json"), []);
  const dir = path.join(DATA, "achievements");
  let done = 0, failed = 0;
  for (const g of games) {
    const file = path.join(dir, `${g.id}.json`);
    const icons = await readJson(file, null); if (!icons) continue;
    const todo = icons.filter(r => !r[4]);
    if (!todo.length || done >= max) continue;
    let next = 0;
    const worker = async () => { while (next < todo.length && done < max) { const r = todo[next++];
      try { r[4] = await colorOf(sharp, g.id, r[0]); done++; } catch { failed++; } } };
    await Promise.all(Array.from({ length: 12 }, worker));
    await writeJson(file, icons);
    console.log(`${g.name}: colored ${todo.filter(r => r[4]).length} new icons`);
  }
  console.log(`Colored ${done} icons (${failed} could not be read).`);
  await buildIndex(games);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
