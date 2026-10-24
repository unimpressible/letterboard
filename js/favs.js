// Favorites: heart any icon or item; favorites float to the top of lists and pickers,
// and the tray shows them side by side to compare.
import { esc, store } from "./data.js";

const KEY = "lb-favs";
let favs = store.get(KEY, {});          // id -> {id, img, title, game, char, type}
const subs = new Set();

export const has = id => !!favs[id];
export const count = () => Object.keys(favs).length;
export const list = () => Object.values(favs);
export function onChange(fn) { subs.add(fn); }
function emit() { store.set(KEY, favs); subs.forEach(fn => fn()); paintFab(); }
export function toggle(it) {
  if (favs[it.id]) delete favs[it.id];
  else favs[it.id] = { id: it.id, img: it.img, title: it.title, game: it.game, char: it.char || null, type: it.type };
  emit();
}
// Sort so favorites come first, keeping the original order otherwise.
export const favFirst = arr => [...arr.filter(x => favs[x.id]), ...arr.filter(x => !favs[x.id])];

const HEART = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7-4.3-9-8.6C1.6 8.6 3.6 5 7 5c2 0 3.3 1 5 2.9C13.7 6 15 5 17 5c3.4 0 5.4 3.6 4 6.9-2 4.3-9 8.6-9 8.6z"/></svg>`;
export const heart = id => `<button type="button" class="heart" data-fav="${esc(id)}" aria-pressed="${has(id)}" aria-label="${has(id) ? "Remove from favorites" : "Add to favorites"}">${HEART}</button>`;

// Wire every heart inside `root`; `lookup(id)` returns the item to save.
export function wireHearts(root, lookup) {
  root.querySelectorAll("[data-fav]").forEach(b => b.onclick = e => {
    e.stopPropagation();
    const it = lookup(b.dataset.fav); if (!it) return;
    toggle(it);
    b.setAttribute("aria-pressed", has(it.id));
    b.setAttribute("aria-label", has(it.id) ? "Remove from favorites" : "Add to favorites");
  });
}

/* ---------- tray ---------- */
const $ = id => document.getElementById(id);
function paintFab() {
  const n = count();
  $("fav-open").hidden = !n;
  $("fav-count").textContent = `Favorites (${n})`;
  if (!$("fav-drawer").hidden) paintDrawer();
}
function paintDrawer() {
  const items = list();
  const groups = new Map();
  for (const f of items) { const k = f.char ? `“${f.char}”` : (f.type === "achievement" ? "Other icons" : { background: "Backgrounds", mini: "Mini-profiles", avatar: "Avatars", frame: "Frames", emoticon: "Emoticons", sticker: "Stickers", card: "Trading cards" }[f.type] || "Other");
    if (!groups.has(k)) groups.set(k, []); groups.get(k).push(f); }
  $("fav-body").innerHTML = items.length ? [...groups].map(([k, arr]) => `<div style="margin-bottom:16px"><h3 style="margin-bottom:10px">${esc(k)}</h3>
    <div class="compare">${arr.map(f => `<div class="cmp">${heart(f.id)}<img src="${esc(f.img)}" alt="" loading="lazy"><span>${esc(f.title)}<br>${esc(f.game || "")}</span></div>`).join("")}</div></div>`).join("")
    : `<p class="empty-state">No favorites yet. Tap a heart on any icon.</p>`;
  wireHearts($("fav-body"), id => favs[id]);
}
function openDrawer(open) { $("fav-drawer").hidden = !open; $("fav-scrim").hidden = !open; if (open) paintDrawer(); }
export function initFavs() {
  $("fav-open").onclick = () => openDrawer(true);
  $("fav-close").onclick = () => openDrawer(false);
  $("fav-scrim").onclick = () => openDrawer(false);
  document.addEventListener("keydown", e => { if (e.key === "Escape") openDrawer(false); });
  $("fav-clear").onclick = () => { const b = $("fav-clear");
    if (b.dataset.armed) { favs = {}; emit(); delete b.dataset.armed; b.textContent = "Clear all favorites"; }
    else { b.dataset.armed = 1; b.textContent = "Click again to clear"; setTimeout(() => { delete b.dataset.armed; b.textContent = "Clear all favorites"; }, 3000); } };
  paintFab();
}
