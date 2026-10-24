// Data loading and Steam image addresses. Everything loads from this site's /data folder,
// which GitHub refreshes daily; images load straight from Steam's servers.

export const STEAM = {
  item: (appid, file) => file ? `https://shared.fastly.steamstatic.com/community_assets/images/items/${appid}/${file}` : "",
  ach: (appid, file) => `https://shared.akamai.steamstatic.com/community_assets/images/apps/${appid}/${file}`,
  emote: (name, large) => `https://community.fastly.steamstatic.com/economy/${large ? "emoticonlarge" : "emoticon"}/${encodeURIComponent(String(name).replace(/^:|:$/g, ""))}`,
  card: icon => `https://community.fastly.steamstatic.com/economy/image/${icon}/96fx96f`,
  header: appid => `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
  shop: appid => `https://store.steampowered.com/points/shop/app/${appid}`,
  store: appid => `https://store.steampowered.com/app/${appid}/`,
  achPage: appid => `https://steamcommunity.com/stats/${appid}/achievements`,
  market: (appid, name, foil) => `https://steamcommunity.com/market/listings/753/${encodeURIComponent(`${appid}-${name}${foil ? " (Foil)" : ""}`)}`,
  marketSearch: q => `https://steamcommunity.com/market/search?appid=753&q=${encodeURIComponent(q)}`,
};

const cache = new Map();
export async function json(path) {
  if (!cache.has(path)) cache.set(path, fetch(path, { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null));
  return cache.get(path);
}

export const apps = () => json("data/apps.json").then(x => x || {});

// Item types the catalog knows. `cls` is Steam's community item class.
export const TYPES = {
  background: { label: "Backgrounds", one: "background", shape: "wide", slot: "background" },
  mini:       { label: "Mini-profiles", one: "mini-profile background", shape: "wide", slot: "mini" },
  avatar:     { label: "Avatars", one: "animated avatar", shape: "sq", slot: "avatar" },
  frame:      { label: "Frames", one: "avatar frame", shape: "sq", slot: "frame" },
  emoticon:   { label: "Emoticons", one: "emoticon", shape: "sq" },
  sticker:    { label: "Stickers", one: "sticker", shape: "sq" },
  card:       { label: "Trading cards", one: "trading card", shape: "sq" },
  achievement:{ label: "Achievement icons", one: "achievement icon", shape: "sq" },
};

// Normalize one Points Shop row: [appid, defid, title, name, small, large, webm, mp4, animated, cost, created]
export function fromRow(type, r, names) {
  const [appid, id, title, name, small, large, webm, mp4, animated, cost, created] = r;
  const it = { type, appid, id: `${type}:${id}`, title: title || name, name, game: names[appid] || `App ${appid}`,
    animated: !!animated, cost, created, link: STEAM.shop(appid) };
  if (type === "emoticon") { it.title = name || title; it.img = STEAM.emote(it.title, true); it.thumb = it.img; it.contain = true; }
  else {
    it.img = STEAM.item(appid, large || small); it.thumb = STEAM.item(appid, small || large);
    if (type === "background" || type === "mini") it.thumb = it.img;
    if (webm) it.webm = STEAM.item(appid, webm);
    if (mp4) it.mp4 = STEAM.item(appid, mp4);
    if (type === "sticker" || type === "frame") it.contain = true;
  }
  return it;
}

// Loads every chunk of one item type, calling onProgress(items, done) as chunks arrive.
export async function loadItems(type, onProgress) {
  const key = "items:" + type;
  if (cache.has(key)) { const v = await cache.get(key); onProgress(v, true); return v; }
  const p = (async () => {
    const [meta, names] = await Promise.all([json(`data/items/${type}.json`), apps()]);
    const out = [];
    if (!meta) return out;
    for (let i = 0; i < meta.chunks; i++) {
      const rows = await json(`data/items/${type}-${i}.json`) || [];
      for (const r of rows) out.push(fromRow(type, r, names));
      onProgress(out, i === meta.chunks - 1);
    }
    return out;
  })();
  cache.set(key, p);
  return p;
}

export const achIndex = () => json("data/achievements/index.json");
export const achGame = id => json(`data/achievements/${id}.json`).then(x => x || []);
export const cardIndex = () => json("data/cards/index.json");
export async function cardsFor(appid) {
  const [rows, names] = await Promise.all([json(`data/cards/${appid}.json`), apps()]);
  return (rows || []).map(([name, icon, foil, price], n) => ({ type: "card", appid: Number(appid), id: `card:${appid}:${n}`,
    title: name + (foil ? " (Foil)" : ""), game: names[appid] || `App ${appid}`, img: STEAM.card(icon), thumb: STEAM.card(icon),
    contain: true, price, link: STEAM.market(appid, name, foil) }));
}

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function toast(msg) {
  const t = document.getElementById("toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2400);
}
export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
