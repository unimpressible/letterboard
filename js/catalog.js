// Catalog: every Points Shop item, every trading card and every achievement icon, searchable.
import { STEAM, TYPES, achGame, achIndex, apps, cardIndex, cardsFor, colorBubbles, esc, json, loadItems, store, toast } from "./data.js";
import * as favs from "./favs.js";
import * as fold from "./fold.js";
import * as profile from "./profile.js";

const state = { type: store.get("lb-cat-type", "background"), q: "", sort: "new", anim: false, favOnly: false, color: "", shown: 0, items: [], loading: false, cardGame: null };
let pickCtx = null;  // {types, label, onPick, onClear}
const PAGE = { wide: 48, sq: 120, tiles: 600 };
const $ = id => document.getElementById(id);

/* ---------------- sources ---------------- */
async function achievementItems(onProgress) {
  const idx = await achIndex(); if (!idx) return [];
  const out = [];
  for (const g of idx.games) {
    const icons = await achGame(g.id);
    icons.forEach(([file, name, desc, c, color]) => out.push({ type: "achievement", appid: g.id, id: `ach:${g.id}:${file}`, title: name, desc, char: c, color,
      game: g.name, img: STEAM.ach(g.id, file), thumb: STEAM.ach(g.id, file), link: STEAM.achPage(g.id), created: 0 }));
    onProgress(out, false);
  }
  onProgress(out, true);
  return out;
}
async function cardGames() {
  const [idx, names] = await Promise.all([cardIndex(), apps()]);
  if (!idx) return [];
  return Object.entries(idx.apps).map(([appid, n]) => ({ type: "cardgame", appid: +appid, id: "cg:" + appid, title: names[appid] || `App ${appid}`,
    game: `${n} cards`, img: STEAM.header(appid), thumb: STEAM.header(appid), created: 0 }));
}

async function load() {
  state.items = []; state.shown = 0; state.loading = true; draw();
  const t = state.type, mine = Symbol(); state.token = mine;
  const progress = (items, done) => { if (state.token !== mine) return; state.items = items; state.loading = !done; draw(true); };
  if (t === "achievement") await achievementItems(progress);
  else if (t === "card") {
    if (state.cardGame) progress(await cardsFor(state.cardGame), true);
    else progress(await cardGames(), true);
  } else await loadItems(t, progress);
}

/* ---------------- filtering ---------------- */
function filtered() {
  const q = state.q.trim().toLowerCase();
  let list = state.items;
  const raw = state.q.trim();
  if ([...raw].length === 1) {
    // One character: show only that character, not every name containing it.
    const ch = raw.toUpperCase();
    if (state.type === "achievement") list = list.filter(it => it.char === ch);
    else {
      const bare = it => it.title.replace(/^:|:$/g, "").toUpperCase();
      const exact = list.filter(it => bare(it) === ch);
      list = exact.length ? exact : list.filter(it => bare(it).startsWith(ch));
    }
  } else if (q) { const words = q.split(/\s+/); list = list.filter(it => { const h = `${it.title} ${it.game} ${it.char || ""}`.toLowerCase(); return words.every(w => h.includes(w)); }); }
  if (state.anim) list = list.filter(it => it.animated || it.webm);
  if (state.color && state.type === "achievement") list = list.filter(it => it.color === state.color);
  if (state.favOnly) list = list.filter(it => favs.has(it.id));
  const by = {
    new: (a, b) => (b.created || 0) - (a.created || 0),
    name: (a, b) => a.title.localeCompare(b.title),
    game: (a, b) => a.game.localeCompare(b.game) || a.title.localeCompare(b.title),
    cost: (a, b) => (a.cost || 0) - (b.cost || 0),
  }[state.sort];
  return favs.favFirst(state.sort === "new" && state.type === "achievement" ? list : [...list].sort(by));
}

/* ---------------- drawing ---------------- */
function actionsFor(it) {
  if (pickCtx) return `<button type="button" class="btn green small" data-use>Use this</button>`;
  const a = [];
  const look = TYPES[it.type]?.slot;
  if (look) a.push(`<button type="button" class="btn green small" data-set="${look}">Set as ${TYPES[it.type].one.replace("animated ", "")}</button>`);
  if (it.type === "achievement") a.push(`<button type="button" class="btn small" data-add="achievements">Add to showcase</button>`);
  if (["emoticon", "sticker", "card", "background"].includes(it.type)) a.push(`<button type="button" class="btn ${look ? "ghost " : ""}small" data-add="items">Add to item showcase</button>`);
  if (it.type === "emoticon") a.push(`<button type="button" class="btn ghost small" data-copy>Copy code</button>`);
  return a.join("");
}
function cardHtml(it, n) {
  if (it.type === "cardgame") return `<div class="card"><div class="thumb"><img src="${esc(it.img)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"></div>
    <div class="meta"><div class="t">${esc(it.title)}</div><div class="g">${esc(it.game)}</div><div class="acts"><button type="button" class="btn small" data-game="${it.appid}">Show cards</button></div></div></div>`;
  const shape = TYPES[it.type]?.shape || "sq";
  const vid = it.webm && (it.type === "background" || it.type === "mini")
    ? `<video muted loop playsinline preload="none" poster="${esc(it.img)}" data-hover><source src="${esc(it.webm)}" type="video/webm"></video>` : "";
  // Animated avatars, frames and stickers show a still until hovered, so the grid stays fast.
  const anim = it.still && it.still !== it.img ? ` data-still="${esc(it.still)}" data-anim="${esc(it.img)}"` : "";
  const img = it.type === "frame"
    ? `<img src="${esc(it.thumb || it.img)}" class="frame" alt="" loading="lazy"${anim}>`
    : vid || `<img src="${esc(it.thumb || it.img)}" class="${it.contain ? "contain" : ""}" alt="" loading="lazy"${anim}>`;
  const badge = it.animated || it.webm ? `<span class="badge">Animated</span>` : "";
  const price = it.cost ? `${Number(it.cost).toLocaleString()} pts` : it.price || "";
  return `<div class="card" data-n="${n}">${favs.heart(it.id)}<div class="thumb ${shape === "sq" ? "sq" : ""}">${img}${badge}</div>
    <div class="meta"><div class="t" title="${esc(it.title)}">${esc(it.title)}</div><div class="g" title="${esc(it.game)}">${esc(it.game)}${price ? ` · ${esc(price)}` : ""}</div>
    ${it.similar && it.gkey ? `<button type="button" class="btn ghost small" data-sim="${esc(it.gkey)}">${expanded.has(it.gkey) ? "Hide" : "Show"} ${it.similar} similar</button>` : ""}
    <div class="acts">${actionsFor(it)}<a href="${esc(it.link)}" target="_blank" rel="noopener">${it.type === "card" ? "Market" : it.type === "achievement" ? "Steam" : "Shop"}</a></div></div></div>`;
}

// Group lookalike achievement icons (same game, character and main color) unless "Show every variation" is on.
const expanded = new Set();
const styleKey = it => `${it.appid}:${it.color || ""}:${it.char || it.title}`;
function collapse(list) {
  for (const it of list) it.similar = 0;
  if (state.type !== "achievement" || store.get("lb-l-all", false)) return list;
  const groups = new Map();
  for (const it of list) { const k = favs.has(it.id) ? it.id : styleKey(it); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
  const out = [];
  for (const [k, g] of groups) {
    g[0].similar = g.length - 1; g[0].gkey = k;
    if (expanded.has(k)) out.push(...g); else out.push(g[0]);
  }
  return out;
}
let lastList = [];
function draw(keepShown) {
  const list = collapse(filtered()); lastList = list;
  const shape = TYPES[state.type]?.shape || "sq";
  if (!keepShown || !state.shown) state.shown = state.type === "achievement" ? PAGE.tiles : PAGE[shape];
  const grid = $("cat-grid");
  grid.className = "cat-grid" + (shape === "sq" && state.type !== "card" ? " small" : "");
  const one = [...state.q.trim()].length === 1 ? ` for “${state.q.trim().toUpperCase()}”` : "";
  const grouped = state.type === "achievement" && list.some(x => x.similar);
  const count = grouped ? `${list.length.toLocaleString()} styles${one} (${filtered().length.toLocaleString()} icons)` : list.length.toLocaleString();
  const what = grouped ? "" : state.type === "card" && !state.cardGame ? "games with trading cards" : TYPES[state.type].label.toLowerCase() + one;
  $("cat-count").innerHTML = state.loading && !list.length ? "Loading…"
    : `${count} ${what}${state.loading ? " so far, still loading…" : ""}${state.cardGame ? ` · <a href="#" id="cat-back">Back to all games</a>` : ""}`;
  $("cat-back")?.addEventListener("click", e => { e.preventDefault(); state.cardGame = null; load(); });
  if (!list.length && !state.loading) {
    grid.innerHTML = `<div class="empty-state">${state.items.length ? (state.favOnly ? "No favorites here yet. Tap a heart on any item." : "Nothing matches that search.") :
      "This list fills in after the site's first daily update from Steam. Check back soon."}</div>`;
  } else if (state.type === "achievement") grid.innerHTML = tilesHtml(list.slice(0, state.shown));
  else grid.innerHTML = list.slice(0, state.shown).map(cardHtml).join("");
  if (state.type === "achievement") grid.className = "cat-tiles";
  $("cat-more").hidden = list.length <= state.shown;
  wire(grid, list);
}

// Achievement icons: a compact tile grid grouped by game (no big cards). Click a tile to use it.
function tilesHtml(list) {
  const by = new Map();
  list.forEach((it, n) => { const g = favs.has(it.id) && !state.favOnly ? "fav" : it.appid; if (!by.has(g)) by.set(g, []); by.get(g).push([it, n]); });
  const order = [...by.keys()].sort((a, b) => (a === "fav" ? -1 : b === "fav" ? 1 : 0));
  return `<div class="browse-head"><span class="hint">Click a game’s name to close or reopen it.</span>${order.length > 1 ? fold.controls(order.map(String)) : ""}</div><div class="flow">${order.map(g => { const arr = by.get(g); const label = g === "fav" ? "Your favorites" : arr[0][0].game; const closed = fold.isFolded(g);
    return `<div class="group fgroup ${closed ? "closed" : ""}"><h3>${fold.header(g, label, ` <span class="hint">${arr.length}</span>${g === "fav" || closed ? "" : `<a href="${STEAM.achPage(g)}" target="_blank" rel="noopener">Achievements</a>`}`)}</h3>
      <div class="icon-grid" ${closed ? "hidden" : ""}>${(closed ? [] : arr).map(([it, n]) => `<div class="icon" data-n="${n}"><div class="face">${favs.heart(it.id)}${it.similar && it.gkey ? `<button type="button" class="more-badge" data-sim="${esc(it.gkey)}" aria-label="${expanded.has(it.gkey) ? "Hide" : "Show"} ${it.similar} similar">${expanded.has(it.gkey) ? "−" : "+" + it.similar}</button>` : ""}<img src="${esc(it.img)}" alt="${esc(it.char || it.title)}" loading="lazy" data-tile title="${esc(`${it.title} · ${it.game}. Click to ${pickCtx ? "use it" : "add it to your achievement showcase"}.`)}"></div></div>`).join("")}</div></div>`; }).join("")}</div>`;
}
function wire(grid, list) {
  grid.querySelectorAll(".icon[data-n] [data-tile]").forEach(img => img.onclick = () => {
    const it = list[+img.closest(".icon").dataset.n]; if (!it) return;
    if (pickCtx) { const ctx = pickCtx; endPick(); ctx.onPick(it); location.hash = "#profile"; } else addToShowcase("achievements", it);
  });
  grid.querySelectorAll(".card").forEach(c => {
    const it = list[+c.dataset.n]; if (!it) return;
    c.querySelector("[data-use]")?.addEventListener("click", () => { const ctx = pickCtx; endPick(); ctx.onPick(it); location.hash = "#profile"; });
    c.querySelector("[data-set]")?.addEventListener("click", e => { profile.P[e.target.dataset.set] = profile.snap(it); profile.save(); toast(`Set as your ${TYPES[it.type].one}`); });
    c.querySelector("[data-add]")?.addEventListener("click", e => addToShowcase(e.target.dataset.add, it));
    c.querySelector("[data-copy]")?.addEventListener("click", async () => { try { await navigator.clipboard.writeText(it.title); toast(`Copied ${it.title}`); } catch { toast(it.title); } });
    const a = c.querySelector("img[data-anim]");
    if (a) { c.addEventListener("mouseenter", () => a.src = a.dataset.anim); c.addEventListener("mouseleave", () => a.src = a.dataset.still); }
    const v = c.querySelector("video[data-hover]");
    if (v) { c.onmouseenter = () => v.play().catch(() => {}); c.onmouseleave = () => v.pause(); }
  });
  favs.wireHearts(grid, id => list.find(x => x.id === id));
  fold.wire(grid, () => draw(true));
  fold.wireControls(grid, [...grid.querySelectorAll("[data-fold]")].map(b => b.dataset.fold), () => draw(true));
  grid.querySelectorAll("[data-sim]").forEach(b => b.onclick = e => { e.stopPropagation(); const k = b.dataset.sim; expanded.has(k) ? expanded.delete(k) : expanded.add(k); draw(true); });
  grid.querySelectorAll("[data-game]").forEach(b => b.onclick = () => { state.cardGame = b.dataset.game; state.q = ""; $("cat-q").value = ""; load(); });
}
function addToShowcase(kind, it) {
  let sc = profile.P.showcases.find(x => x.kind === kind);
  if (!sc) { profile.addShowcase(kind); sc = profile.P.showcases[profile.P.showcases.length - 1]; }
  let i = sc.slots.findIndex(s => !s);
  if (i < 0) { if (kind === "items" && sc.rows < 4) { sc.rows++; sc.slots.push(...Array(6).fill(null)); i = sc.slots.findIndex(s => !s); } else { toast("That showcase is full. Clear a slot first."); return; } }
  sc.slots[i] = profile.snap(it); profile.save();
  toast(`Added to ${kind === "items" ? "item" : "achievement"} showcase, slot ${i + 1}`);
}

/* ---------------- type chips ---------------- */
async function counts() {
  const out = {};
  await Promise.all(Object.keys(TYPES).map(async t => {
    if (t === "achievement") { const i = await achIndex(); out[t] = i ? i.games.reduce((n, g) => n + g.icons, 0) : 0; }
    else if (t === "card") { const i = await cardIndex(); out[t] = i ? Object.values(i.apps).reduce((n, x) => n + x, 0) : 0; }
    else { const m = await json(`data/items/${t}.json`); out[t] = m?.count || 0; }
  }));
  return out;
}
let N = {};
function drawChips() {
  const allowed = pickCtx ? pickCtx.types : Object.keys(TYPES);
  $("cat-types").innerHTML = allowed.map(t => `<button type="button" role="tab" class="chip" aria-selected="${t === state.type}" data-t="${t}">${TYPES[t].label}${N[t] ? `<span class="n">${N[t].toLocaleString()}</span>` : ""}</button>`).join("");
  $("cat-types").querySelectorAll("[data-t]").forEach(b => b.onclick = () => setType(b.dataset.t));
}
function setType(t) { state.type = t; $("cat-colors").hidden = t !== "achievement"; state.cardGame = null; if (!pickCtx) store.set("lb-cat-type", t); drawChips(); load(); }

/* ---------------- pick mode ---------------- */
export function startPick(ctx) {
  pickCtx = ctx;
  $("pickbar").hidden = false; $("pick-text").textContent = ctx.label + ". Click “Use this” on any item.";
  const bar = $("pickbar");
  bar.querySelector("#pick-clear")?.remove();
  if (ctx.onClear) { const b = document.createElement("button"); b.type = "button"; b.className = "btn ghost"; b.id = "pick-clear"; b.textContent = "Clear this slot";
    b.onclick = () => { const c = pickCtx; endPick(); c.onClear(); location.hash = "#profile"; }; bar.insertBefore(b, $("pick-cancel")); }
  state.q = ""; $("cat-q").value = "";
  if (!ctx.types.includes(state.type)) state.type = ctx.types[0];
  $("cat-colors").hidden = state.type !== "achievement";
  state.cardGame = null; drawChips(); load();
  location.hash = "#catalog";
}
export function endPick() { pickCtx = null; $("pickbar").hidden = true; drawChips(); }

export async function initCatalog() {
  let t; $("cat-q").addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => {
    state.q = e.target.value;
    const one = [...state.q.trim()].length === 1;
    if (one && state.type !== "achievement" && (!pickCtx || pickCtx.types.includes("achievement"))) { setType("achievement"); toast(`Showing letter icons for “${state.q.trim().toUpperCase()}”`); }
    else draw();
  }, 180); });
  $("cat-sort").onchange = e => { state.sort = e.target.value; draw(); };
  $("cat-anim").onchange = e => { state.anim = e.target.checked; draw(); };
  $("cat-favs").onchange = e => { state.favOnly = e.target.checked; draw(); };
  colorBubbles($("cat-colors"), () => state.color, c => { state.color = c; draw(); });
  $("cat-colors").hidden = state.type !== "achievement";
  $("cat-more").onclick = () => { state.shown += state.type === "achievement" ? PAGE.tiles : PAGE[TYPES[state.type]?.shape || "sq"]; draw(true); };
  $("pick-cancel").onclick = () => { endPick(); location.hash = "#profile"; };
  if (!TYPES[state.type]) state.type = "background";
  drawChips(); load();
  N = await counts(); drawChips();
}
