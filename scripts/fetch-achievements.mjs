#!/usr/bin/env node
// Every achievement icon for every game in data/games.json, from Steam's public
// achievement feed (no key). Writes:
//   data/achievements/index.json   game list + every icon tagged as a character, grouped by character
//   data/achievements/<appid>.json every icon of one game
// Icons are referenced by file name and load straight from Steam's image servers.
// Usage: node scripts/fetch-achievements.mjs [appid ...]
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA, getJson, readJson, sleep, writeJson } from "./lib.mjs";

// ---- character detection ---------------------------------------------------
const SINGLE = /^[\p{L}\p{N}]$/u;
const COLORS = "blue|red|green|lilac|liliac|orange|brown|purple|yellow|pink|black|white|grey|gray|cyan|violet|gold|golden|silver|dark|light";
const PHRASES = [
  new RegExp(`^(?:${COLORS})\\s+([\\p{L}\\p{N}])$`, "iu"),       // "Blue A"
  /^(?:open |pass )?(?:the )?level\s+([\p{L}\p{N}])!?$/iu,          // "Open level A", "Pass the level A!"
  /^letter\s+([\p{L}\p{N}])$/iu,
  /^number\s+(\p{N})$/iu,
  /^["'«“]?([\p{L}\p{N}])["'»”]?$/u,
];
export function detectChar(name = "", desc = "") {
  const raw = (name || "").trim().replace(/️/g, "");
  if ([...raw].length === 1 && !SINGLE.test(raw)) return raw;      // a lone symbol: ! ? $ ☯ ■
  const n = raw.replace(/[!.]+$/, "").trim();
  if (SINGLE.test(n)) return n.toUpperCase();
  for (const re of PHRASES) { const m = n.match(re); if (m) return m[1].toUpperCase(); }
  // Descriptions only count as a lone shouted letter ("V!"): one game describes
  // every achievement as "Open level 1", so phrases there are unreliable.
  const shout = (desc || "").trim().match(/^([\p{L}\p{N}])!+$/u);
  return shout ? shout[1].toUpperCase() : null;
}

export async function fetchGame(appid, opts) {
  const j = await getJson(`https://api.steampowered.com/IPlayerService/GetGameAchievements/v1/?appid=${appid}&language=english`, opts);
  const list = j?.response?.achievements ?? [];
  const byIcon = new Map();
  for (const a of list) {
    if (!a.icon) continue;
    const c = detectChar(a.localized_name, a.localized_desc);
    const cur = byIcon.get(a.icon);
    if (!cur) byIcon.set(a.icon, [a.icon, a.localized_name || "", a.localized_desc || "", c]);
    else if (c && !cur[3]) cur[3] = c;
  }
  return { total: list.length, icons: [...byIcon.values()] };   // icons: [file, name, desc, char|null]
}

async function main() {
  const games = await readJson(path.join(DATA, "games.json"), []);
  const only = process.argv.slice(2).map(Number).filter(Boolean);
  const dir = path.join(DATA, "achievements");
  const index = await readJson(path.join(dir, "index.json"), { games: [] });
  const known = new Map(index.games.map(g => [g.id, g]));

  for (const g of games) {
    if (only.length && !only.includes(g.id)) continue;
    process.stdout.write(`${g.name.padEnd(24)} `);
    try {
      const data = await fetchGame(g.id);
      if (!data.icons.length) throw new Error("no achievements");
      await writeJson(path.join(dir, `${g.id}.json`), data.icons);
      known.set(g.id, { id: g.id, name: g.name, note: g.note || "", total: data.total, icons: data.icons.length,
        tagged: data.icons.filter(x => x[3]).length });
      console.log(`${data.total} achievements, ${data.icons.length} icons, ${known.get(g.id).tagged} characters`);
    } catch (e) { console.log(`kept previous data (${e.message})`); }
    await sleep(500);
  }

  // Character index across all games: {char: [[appid, file, name], ...]}
  const chars = {};
  const ordered = games.map(g => known.get(g.id)).filter(Boolean);
  for (const g of ordered) {
    const icons = await readJson(path.join(dir, `${g.id}.json`), []);
    for (const [file, name, , c] of icons) if (c) (chars[c] ||= []).push([g.id, file, name]);
  }
  await writeJson(path.join(dir, "index.json"), { updated: new Date().toISOString(), games: ordered, chars });
  const total = ordered.reduce((n, g) => n + g.icons, 0);
  console.log(`\n${ordered.length} games, ${total} icons, ${Object.values(chars).reduce((n, a) => n + a.length, 0)} tagged.`);
  if (!total) process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
