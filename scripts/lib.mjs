// Shared helpers for the data collectors. Node 18+ (built-in fetch), no dependencies.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DATA = path.join(ROOT, "data");
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; }
}
export async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value));
}

// GET JSON with retries. Backs off on 429/5xx; throws after `tries` attempts.
export async function getJson(url, { tries = 5, wait = 3000, fetchImpl = fetch } = {}) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetchImpl(url, { headers: { "Accept": "application/json", "User-Agent": "letterboard-data/1.0" } });
      if (res.status === 429 || res.status >= 500) { last = new Error(`HTTP ${res.status}`); await sleep(wait * i * i); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) { last = e; await sleep(wait * i); }
  }
  throw last;
}

// Steam "input_json" style service call.
export const service = (iface, method, input) =>
  `https://api.steampowered.com/${iface}/${method}/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`;

// Game names for a list of app ids, via the public store service. Returns {appid: name}.
export async function appNames(ids, opts = {}) {
  const out = {};
  const list = [...new Set(ids.map(Number))].filter(Boolean);
  for (let i = 0; i < list.length; i += 200) {
    const chunk = list.slice(i, i + 200);
    try {
      const j = await getJson(service("IStoreBrowseService", "GetItems", {
        ids: chunk.map(appid => ({ appid })), context: { language: "english", country_code: "US" },
        data_request: { include_basic_info: false } }), opts);
      for (const it of j?.response?.store_items ?? []) if (it.name) out[it.appid ?? it.id] = it.name;
    } catch (e) { console.warn(`  names ${i}: ${e.message}`); }
    await sleep(250);
  }
  return out;
}
