#!/usr/bin/env node
// Trading cards for every game that has profile items, from the Community Market (no key).
// The Market only allows a slow request rate, so this works through games a batch at a
// time and remembers where it stopped. Each run refreshes the games checked longest ago.
// Writes data/cards/<appid>.json: [[name, icon_url, foil, price], ...]
//        data/cards/index.json:   {updated, apps: {appid: card count}, checked: {appid: time}}
// Images: https://community.fastly.steamstatic.com/economy/image/<icon_url>/96fx96f
// Usage: node scripts/fetch-cards.mjs [--minutes 45] [appid ...]
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA, getJson, readJson, sleep, writeJson } from "./lib.mjs";

export function cardsFrom(results) {
  return (results || []).map(r => {
    const a = r.asset_description || {};
    return [a.name || r.name, a.icon_url || "", /foil/i.test(a.type || "") ? 1 : 0, r.sell_price_text || ""];
  }).filter(c => c[1]);
}

export async function fetchApp(appid, opts) {
  const url = `https://steamcommunity.com/market/search/render/?norender=1&count=100&start=0&appid=753` +
    `&category_753_item_class[]=tag_item_class_2&category_753_Game[]=tag_app_${appid}`;
  const j = await getJson(url, { tries: 3, wait: 15000, ...opts });
  if (!j || j.success === false) throw new Error("market refused");
  return cardsFrom(j.results);
}

async function main() {
  const args = process.argv.slice(2);
  const mi = args.indexOf("--minutes");
  const minutes = mi >= 0 ? Number(args.splice(mi, 2)[1]) : 45;
  const only = args.map(Number).filter(Boolean);
  const file = path.join(DATA, "cards", "index.json");
  const out = await readJson(file, { apps: {}, checked: {} });
  // Games to check: any game with Points Shop backgrounds or emoticons (those are the games with cards).
  const ids = new Set();
  for (const t of ["background", "emoticon"]) {
    const meta = await readJson(path.join(DATA, "items", `${t}.json`), { chunks: 0 });
    for (let i = 0; i < (meta.chunks || 0); i++)
      (await readJson(path.join(DATA, "items", `${t}-${i}.json`), [])).forEach(r => ids.add(String(r[0])));
  }
  const queue = (only.length ? only.map(String) : [...ids]).sort((a, b) => (out.checked[a] || 0) - (out.checked[b] || 0));
  const stop = Date.now() + minutes * 60000;
  let done = 0, misses = 0;
  for (const id of queue) {
    if (Date.now() > stop) break;
    try {
      const cards = await fetchApp(id);
      if (cards.length) { out.apps[id] = cards.length; await writeJson(path.join(DATA, "cards", `${id}.json`), cards); }
      else delete out.apps[id];
      out.checked[id] = Date.now(); done++; misses = 0;
    } catch (e) {
      console.log(`  ${id}: ${e.message}`);
      if (++misses >= 5) { console.log("Market is refusing requests, stopping for this run."); break; }
    }
    if (done % 50 === 0) { process.stdout.write(`  ${done} games checked\r`); await writeJson(file, { ...out, updated: new Date().toISOString() }); }
    await sleep(3500);
  }
  await writeJson(file, { ...out, updated: new Date().toISOString() });
  const total = Object.values(out.apps).reduce((n, a) => n + a, 0);
  console.log(`\nChecked ${done} games this run. ${Object.keys(out.apps).length} games, ${total} cards saved; ${Object.keys(out.checked).length} of ${ids.size} games checked so far.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
