#!/usr/bin/env node
// Every Points Shop profile item, from Steam's public loyalty-rewards feed (no key).
// Writes data/items/<type>.json (summary), data/items/<type>-<n>.json (5,000 items each) and data/apps.json (game names).
// Images load straight from Steam: https://shared.fastly.steamstatic.com/community_assets/images/items/<appid>/<file>
// Usage: node scripts/fetch-points-shop.mjs [type ...]
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA, appNames, getJson, readJson, service, sleep, writeJson } from "./lib.mjs";

export const TYPES = {
  background: 3,   // profile backgrounds (static and animated)
  emoticon:   4,
  sticker:    11,  // animated chat stickers
  mini:       13,  // mini-profile backgrounds
  frame:      14,  // avatar frames
  avatar:     15,  // animated avatars
};

// One row per item: [appid, defid, title, name, small, large, webm, mp4, animated, cost, created]
export function row(d) {
  const c = d.community_item_data || {};
  return [d.appid, d.defid, c.item_title || c.item_name || "", c.item_name || "", c.item_image_small || "",
    c.item_image_large || "", c.item_movie_webm || "", c.item_movie_mp4 || "", c.animated ? 1 : 0,
    Number(d.point_cost) || 0, d.timestamp_created || 0];
}

export async function fetchType(cls, { log = () => {}, opts } = {}) {
  const rows = new Map();
  let cursor = null, total = 0, pages = 0;
  do {
    const input = { community_item_classes: [cls], count: 1000, include_direct_purchase_disabled: true };
    if (cursor) input.cursor = cursor;
    const j = await getJson(service("ILoyaltyRewardsService", "QueryRewardItems", input), opts);
    const r = j?.response || {};
    total = r.total_count || total;
    for (const d of r.definitions || []) rows.set(d.defid, row(d));
    const next = r.next_cursor && r.next_cursor !== cursor && (r.definitions || []).length ? r.next_cursor : null;
    cursor = next; pages++;
    log(`  page ${pages}: ${rows.size} of ${total}`);
    await sleep(300);
  } while (cursor && pages < 400);
  return { total, items: [...rows.values()] };
}

async function main() {
  const only = process.argv.slice(2);
  const names = await readJson(path.join(DATA, "apps.json"), {});
  const appids = new Set();
  let ok = 0;
  for (const [type, cls] of Object.entries(TYPES)) {
    if (only.length && !only.includes(type)) continue;
    console.log(`${type}:`);
    try {
      const { total, items } = await fetchType(cls, { log: m => process.stdout.write(m + "\r") });
      if (!items.length) throw new Error("no items");
      items.sort((a, b) => b[10] - a[10]);  // newest first
      const CHUNK = 5000, chunks = Math.ceil(items.length / CHUNK);
      for (let i = 0; i < chunks; i++)
        await writeJson(path.join(DATA, "items", `${type}-${i}.json`), items.slice(i * CHUNK, (i + 1) * CHUNK));
      await writeJson(path.join(DATA, "items", `${type}.json`), { type, updated: new Date().toISOString(), total, count: items.length, chunks });
      items.forEach(r => appids.add(r[0]));
      console.log(`\n  saved ${items.length} (Steam reports ${total})`);
      ok++;
    } catch (e) { console.log(`\n  kept previous data (${e.message})`); }
  }
  const missing = [...appids].filter(id => !names[id]);
  console.log(`Looking up ${missing.length} game names...`);
  Object.assign(names, await appNames(missing));
  await writeJson(path.join(DATA, "apps.json"), names);
  if (!ok) process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
