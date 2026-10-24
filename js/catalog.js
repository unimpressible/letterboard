// Catalog: every Points Shop item, every trading card and every achievement icon, searchable.
import { STEAM, TYPES, achGame, achIndex, apps, cardIndex, cardsFor, colorBubbles, esc, json, loadItems, store, toast } from "./data.js";
import * as favs from "./favs.js";
import * as profile from "./profile.js";

const state = { type: store.get("lb-cat-type", "background"), q: "", sort: "new", anim: false, favOnly: false, color: "", shown: 0, items: [], loading: false, cardGame: null };
let pickCtx = null;  // {types, label, onPick, onClear}
const PAGE = { wide: 48, sq: 120 };
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
  if (q) { const words = q.split(/\s+/); list = list.filter(it => { const h = `${it.title} ${it.game} ${it.char || ""}`.toLowerCase(); return words.every(w => h.includes(w)); }); }
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
  if (pickCtx) return `<button type="button" class="btn small" data-use>Use this</button>`;
  const a = [];
  const look = TYPES[it.type]?.slot;
  if (look) a.push(`<button type="button" class="btn small" data-set="${look}">Set as ${TYPES[it.type].one.replace("animated ", "")}</button>`);
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
  const img = it.type === "frame"
    ? `<img src="${esc(it.img)}" class="frame" alt="" loading="lazy">`
    : vid || `<img src="${esc(it.thumb || it.img)}" class="${it.contain ? "contain" : ""}" alt="" loading="lazy">`;
  const badge = it.animated || it.webm ? `<span class="badge">Animated</span>` : "";
  const price = it.cost ? `${Number(it.cost).toLocaleString()} pts` : it.price || "";
  return `<div class="card" data-n="${n}">${favs.heart(it.id)}<div class="thumb ${shape === "sq" ? "sq" : ""}">${img}${badge}</div>
    <div class="meta"><div class="t" title="${esc(it.title)}">${esc(it.title)}</div><div class="g" title="${esc(it.game)}">${esc(it.game)}${price ? ` · ${esc(price)}` : ""}</div>
    <div class="acts">${actionsFor(it)}<a href="${esc(it.link)}" target="_blank" rel="noopener">${it.type === "card" ? "Market" : it.type === "achievement" ? "Steam" : "Shop"}</a></div></div></div>`;
}

let lastList = [];
function draw(keepShown) {
  const list = filtered(); lastList = list;
  const shape = TYPES[state.type]?.shape || "sq";
  if (!keepShown || !state.shown) state.shown = PAGE[shape];
  const grid = $("cat-grid");
  grid.className = "cat-grid" + (shape === "sq" && state.type !== "card" ? " small" : "");
  const count = list.length.toLocaleString();
  const what = state.type === "card" && !state.cardGame ? "games with trading cards" : TYPES[state.type].label.toLowerCase();
  $("cat-count").innerHTML = state.loading && !list.length ? "Loading…"
    : `${count} ${what}${state.loading ? " so far, still loading…" : ""}${state.cardGame ? ` · <a href="#" id="cat-back">Back to all games</a>` : ""}`;
  $("cat-back")?.addEventListener("click", e => { e.preventDefault(); state.cardGame = null; load(); });
  if (!list.length && !state.loading) {
    grid.innerHTML = `<div class="empty-state">${state.items.length ? (state.favOnly ? "No favorites here yet. Tap a heart on any item." : "Nothing matches that search.") :
      "This list fills in after the site's first daily update from Steam. Check back soon."}</div>`;
  } else grid.innerHTML = list.slice(0, state.shown).map(cardHtml).join("");
  $("cat-more").hidden = list.length <= state.shown;
  wire(grid, list);
}
function wire(grid, list) {
  grid.querySelectorAll(".card").forEach(c => {
    const it = list[+c.dataset.n]; if (!it) return;
    c.querySelector("[data-use]")?.addEventListener("click", () => { const ctx = pickCtx; endPick(); ctx.onPick(it); location.hash = "#profile"; });
    c.querySelector("[data-set]")?.addEventListener("click", e => { profile.P[e.target.dataset.set] = profile.snap(it); profile.save(); toast(`Set as your ${TYPES[it.type].one}`); });
    c.querySelector("[data-add]")?.addEventListener("click", e => addToShowcase(e.target.dataset.add, it));
    c.querySelector("[data-copy]")?.addEventListener("click", async () => { try { await navigator.clipboard.writeText(it.title); toast(`Copied ${it.title}`); } catch { toast(it.title); } });
    const v = c.querySelector("video[data-hover]");
    if (v) { c.onmouseenter = () => v.play().catch(() => {}); c.onmouseleave = () => v.pause(); }
  });
  favs.wireHearts(grid, id => list.find(x => x.id === id));
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
  let t; $("cat-q").addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; draw(); }, 180); });
  $("cat-sort").onchange = e => { state.sort = e.target.value; draw(); };
  $("cat-anim").onchange = e => { state.anim = e.target.checked; draw(); };
  $("cat-favs").onchange = e => { state.favOnly = e.target.checked; draw(); };
  colorBubbles($("cat-colors"), () => state.color, c => { state.color = c; draw(); });
  $("cat-colors").hidden = state.type !== "achievement";
  $("cat-more").onclick = () => { state.shown += PAGE[TYPES[state.type]?.shape || "sq"]; draw(true); };
  $("pick-cancel").onclick = () => { endPick(); location.hash = "#profile"; };
  if (!TYPES[state.type]) state.type = "background";
  drawChips(); load();
  N = await counts(); drawChips();
}
