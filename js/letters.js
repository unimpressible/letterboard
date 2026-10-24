// Letters: plan a 7-character achievement showcase, browse every character and symbol icon,
// filter by main color, heart favorites (they float to the top), browse a game's full set.
import { STEAM, achGame, achIndex, colorBubbles, esc, store, toast } from "./data.js";
import { GROUPS, PUNCTUATION, SCRIPTS } from "../scripts/symbols.mjs";
import * as favs from "./favs.js";
import * as profile from "./profile.js";

const $ = id => document.getElementById(id);
const AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), D09 = "0123456789".split("");
let IDX = null, games = new Map(), chosen = {}, open = null;
let planColor = store.get("lb-l-pcolor", ""), browseColor = store.get("lb-l-bcolor", "");
let sel = store.get("lb-l-sel", { kind: "char", id: "A" });
const byId = new Map();

const icon = ([appid, file, name, color], ch) => {
  const id = `ach:${appid}:${file}`;
  if (byId.has(id)) return byId.get(id);
  const it = { id, type: "achievement", appid, title: name, color, char: ch || null, game: games.get(appid)?.name || `App ${appid}`,
    img: STEAM.ach(appid, file), thumb: STEAM.ach(appid, file), link: STEAM.achPage(appid) };
  byId.set(id, it); return it;
};
const all = c => (IDX?.chars[c] || []).map(r => icon(r, c));
const inColor = (arr, color) => color ? arr.filter(o => o.color === color) : arr;
// Options for one character in the planner: favorites first, then the chosen color (falls back to all colors).
function opts(c) {
  const a = all(c), col = inColor(a, planColor);
  return favs.favFirst(col.length ? col : a);
}

function autoPick(chars) {
  const pref = Number($("l-style").value) || null;
  const need = new Set(chars.filter(c => opts(c).length)), order = [];
  const take = g => { order.push(g); for (const c of [...need]) if (opts(c).some(o => o.appid === g)) need.delete(c); };
  if (pref) take(pref);
  while (need.size) {
    const score = new Map();
    for (const c of need) for (const g of new Set(opts(c).map(o => o.appid))) score.set(g, (score.get(g) || 0) + 1);
    const best = [...score].sort((a, b) => b[1] - a[1])[0]; if (!best) break; take(best[0]);
  }
  return c => { const o = opts(c); const fav = o.find(x => favs.has(x.id)); if (fav) return fav;
    for (const g of order) { const h = o.find(x => x.appid === g); if (h) return h; } return o[0]; };
}

// Lookalike grouping: within one game, icons for the same character in the same main color are
// near-identical, so only the first shows, with a "+N" badge that opens the rest.
let showAll = store.get("lb-l-all", false);
const expanded = new Set();
const styleKey = o => `${o.appid}:${o.color || ""}:${o.char || o.title}`;
function collapse(arr) {
  if (showAll) return arr.map(o => ({ o }));
  const groups = new Map();
  for (const o of arr) { const k = styleKey(o); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); }
  const out = [];
  for (const [k, g] of groups) {
    if (expanded.has(k)) g.forEach((o, i) => out.push({ o, key: k, first: i === 0, open: true, n: g.length }));
    else out.push({ o: g[0], key: k, first: true, open: false, n: g.length });
  }
  return out;
}
const badge = e => e.key && e.first && e.n > 1
  ? `<button type="button" class="more-badge" data-g="${esc(e.key)}" aria-label="${e.open ? "Hide" : "Show"} ${e.n - 1} similar">${e.open ? "−" : "+" + (e.n - 1)}</button>` : "";
function wireBadges(root, rerender) {
  root.querySelectorAll("[data-g]").forEach(b => b.onclick = e => { e.stopPropagation();
    const k = b.dataset.g; expanded.has(k) ? expanded.delete(k) : expanded.add(k); rerender(); });
}
const pickBtn = (e, cur) => `<div class="pick ${e.open && !e.first ? "sub" : ""}">${favs.heart(e.o.id)}${badge(e)}<button type="button" class="sel-btn" data-k="${esc(e.o.id)}" aria-pressed="${e.o.id === cur?.id}" title="${esc(`${e.o.title} · ${e.o.game}`)}"><img src="${esc(e.o.img)}" alt="" loading="lazy"></button></div>`;
function grouped(list, render) {
  const fav = list.filter(o => favs.has(o.id)), rest = list.filter(o => !favs.has(o.id));
  const by = new Map(); rest.forEach(o => { if (!by.has(o.appid)) by.set(o.appid, []); by.get(o.appid).push(o); });
  return (fav.length ? render("Your favorites", fav.map(o => ({ o })), null, true, fav.length) : "") +
    [...by].map(([g, arr]) => render(games.get(g)?.name || `App ${g}`, collapse(arr), g, false, arr.length)).join("");
}
const countLabel = (shown, total) => shown === total ? `${total}` : `${shown} style${shown === 1 ? "" : "s"}, ${total} icons`;

let picks = [];
function renderPlanner() {
  const chars = [...$("l-word").value.toUpperCase()].slice(0, 7);
  store.set("lb-l-word", $("l-word").value);
  const auto = autoPick(chars);
  picks = chars.map((c, i) => { if (c === " ") return null; if (!all(c).length) return undefined;
    const k = chosen[i + ":" + c]; return (k && byId.get(k)) || auto(c); });
  $("l-row").innerHTML = Array.from({ length: 7 }, (_, i) => {
    const c = chars[i], p = picks[i];
    if (c === undefined || c === " ") return `<span class="tile empty"></span>`;
    if (p === undefined) return `<span class="tile missing" title="No icon found">${esc(c)}</span>`;
    return `<button type="button" class="tile ${open === i ? "sel" : ""}" data-i="${i}" title="${esc(`${c} from ${p.game}. Click to choose its style.`)}"><img src="${esc(p.img)}" alt="${esc(c)}"></button>`;
  }).join("");
  $("l-row").querySelectorAll("[data-i]").forEach(b => b.onclick = () => { open = open === +b.dataset.i ? null : +b.dataset.i; renderPlanner(); });

  const pk = $("l-picker");
  if (open != null && picks[open]) {
    const c = chars[open], cur = picks[open], list = opts(c);
    const fellBack = planColor && !inColor(all(c), planColor).length;
    pk.hidden = false;
    pk.innerHTML = `<div class="picker-head"><b>Choose a style for “${esc(c)}” · ${list.length} icons</b><span class="btnrow"><label class="check"><input type="checkbox" class="showall" ${showAll ? "checked" : ""}> Show every variation</label><button type="button" class="btn ghost small" id="l-done">Done</button></span></div>` +
      (fellBack ? `<p class="hint">No ${planColor} “${esc(c)}” exists, so every color is shown.</p>` : "") +
      `<div class="flow">` + grouped(list, (label, arr, g, fav, total) => `<div class="fgroup"><div class="grp-label ${fav ? "fav" : ""}">${esc(label)} · ${countLabel(arr.filter(e => e.first !== false).length, total)}</div><div class="pick-grid">${arr.map(e => pickBtn(e, cur)).join("")}</div></div>`) + `</div>`;
    pk.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { chosen[open + ":" + c] = b.dataset.k; renderPlanner(); });
    wireBadges(pk, () => { const t = pk.scrollTop; renderPlanner(); $("l-picker").scrollTop = t; });
    favs.wireHearts(pk, id => byId.get(id));
    $("l-done").onclick = () => { open = null; renderPlanner(); };
    pk.querySelector(".showall").onchange = e => setShowAll(e.target.checked);
  } else { pk.hidden = true; pk.innerHTML = ""; }

  const by = new Map();
  picks.forEach((p, i) => { if (!p) return; if (!by.has(p.appid)) by.set(p.appid, []); by.get(p.appid).push({ p, c: chars[i] }); });
  $("l-needs").innerHTML = by.size ? [...by].map(([g, arr]) => `<div class="need"><b>${esc(games.get(g)?.name)}</b>
    <div class="thumbs">${arr.map(x => `<img src="${esc(x.p.img)}" alt="${esc(x.c)}" title="${esc(x.p.title)}">`).join("")}</div>
    <div class="hint">Unlock: ${esc(arr.map(x => x.p.title).join(", "))}</div>
    <div><a href="${STEAM.store(g)}" target="_blank" rel="noopener">Store</a> · <a href="${STEAM.achPage(g)}" target="_blank" rel="noopener">Achievements</a></div></div>`).join("")
    : `<p class="hint">Type something above.</p>`;
  const missing = [...new Set(chars.filter((c, i) => picks[i] === undefined))];
  $("l-warn").hidden = !missing.length; $("l-warn").textContent = missing.length ? `No icon found for: ${missing.join(" ")}` : "";
}

/* ---------- browse ---------- */
function selectionList() {
  if (sel.kind === "char") return all(sel.id);
  return (IDX.groups?.[sel.id] || []).map(r => icon(r, null));
}
function selectionLabel() {
  if (sel.kind === "char") return `“${sel.id}”`;
  if (sel.id.startsWith("punct:")) return `“${sel.id.slice(6)}”`;
  if (sel.id.startsWith("script:")) return SCRIPTS[sel.id.slice(7)];
  return GROUPS.find(g => g.id === sel.id)?.label || sel.id;
}
function keyBtns(keys) { return keys.map(k => { const n = (IDX.chars[k] || []).length;
  return `<button type="button" class="key" aria-pressed="${sel.kind === "char" && k === sel.id}" data-k="${esc(k)}" aria-label="${esc(k)}: ${n} icons" ${n ? "" : "disabled"}>${esc(k)}<span class="n">${n}</span></button>`; }).join(""); }
function symOptions() {
  const n = id => (IDX.groups?.[id] || []).length;
  const opt = (id, label) => n(id) ? `<option value="${esc(id)}" ${sel.kind === "group" && sel.id === id ? "selected" : ""}>${esc(label)} (${n(id).toLocaleString()})</option>` : "";
  const punct = [...PUNCTUATION].map(ch => ["punct:" + ch, ch]).filter(([id]) => n(id)).sort((a, b) => n(b[0]) - n(a[0]));
  return `<option value="">Choose a symbol group…</option>
    <optgroup label="Symbols and shapes">${GROUPS.map(g => opt(g.id, g.label)).join("")}</optgroup>
    <optgroup label="Punctuation and signs">${punct.map(([id, ch]) => opt(id, ch)).join("")}</optgroup>
    <optgroup label="Other alphabets">${Object.entries(SCRIPTS).map(([k, label]) => opt("script:" + k, label)).join("")}</optgroup>`;
}
function renderBrowse() {
  store.set("lb-l-sel", sel); store.set("lb-l-bcolor", browseColor);
  $("l-keys").innerHTML = keyBtns([...AZ, ...D09]);
  $("l-keys").querySelectorAll("[data-k]").forEach(b => b.onclick = () => { sel = { kind: "char", id: b.dataset.k }; $("l-sym").value = ""; renderBrowse(); });
  const base = selectionList(), list = inColor(base, browseColor);
  $("l-browse").innerHTML = `<p class="hint" style="margin:10px 0 0">${list.length.toLocaleString()} icons for ${esc(selectionLabel())}${browseColor ? ` in ${browseColor}` : ""}${browseColor && !list.length && base.length ? `. Try another color; there are ${base.length} in other colors.` : "."}</p>` +
    `<div class="flow">` + grouped(list, (label, arr, g, fav, total) => `<div class="group fgroup"><h3>${esc(label)} <span class="hint">${countLabel(arr.filter(e => e.first !== false).length, total)}</span>${g ? `<a href="${STEAM.achPage(g)}" target="_blank" rel="noopener">Achievements</a>` : ""}</h3>
    <div class="icon-grid">${arr.map(e => `<div class="icon ${e.open && !e.first ? "sub" : ""}"><div class="face">${favs.heart(e.o.id)}${badge(e)}<img src="${esc(e.o.img)}" alt="" loading="lazy" data-add="${esc(e.o.id)}" title="${esc(e.o.title)}: add to achievement showcase"></div></div>`).join("")}</div></div>`) + `</div>`;
  $("l-browse").querySelectorAll("[data-add]").forEach(b => b.onclick = () => addOne(byId.get(b.dataset.add)));
  wireBadges($("l-browse"), renderBrowse);
  favs.wireHearts($("l-browse"), id => byId.get(id));
}
function setShowAll(v) { showAll = v; store.set("lb-l-all", v); expanded.clear(); $("l-showall").checked = v; renderPlanner(); renderBrowse(); }
function addOne(it) {
  let sc = profile.P.showcases.find(x => x.kind === "achievements");
  if (!sc) { profile.addShowcase("achievements"); sc = profile.P.showcases.at(-1); }
  const i = sc.slots.findIndex(s => !s);
  if (i < 0) { toast("Your achievement showcase is full. Clear a slot in the profile builder."); return; }
  sc.slots[i] = profile.snap(it); profile.save(); toast(`Added to achievement showcase, slot ${i + 1}`);
}

async function renderGame() {
  const id = Number($("l-game").value), g = games.get(id); if (!g) return;
  store.set("lb-l-game", id);
  const icons = await achGame(id), showAll = $("l-all").checked;
  const items = icons.filter(x => showAll || x[3]).map(([f, n, d, c, color]) => icon([id, f, n, color], c));
  $("l-gameinfo").innerHTML = `${esc(g.note || "")} ${g.total.toLocaleString()} achievements, ${g.icons.toLocaleString()} different icons, ${g.tagged.toLocaleString()} are characters. <a href="${STEAM.store(id)}" target="_blank" rel="noopener">Store</a>`;
  $("l-gamegrid").innerHTML = favs.favFirst(items).map(o => `<div class="icon"><div class="face">${favs.heart(o.id)}<img src="${esc(o.img)}" alt="" loading="lazy" data-add="${esc(o.id)}" title="Add to achievement showcase"></div><span class="t">${esc(o.char || o.title)}</span></div>`).join("")
    || `<p class="hint">None of this game’s icons are named after a character. Tick “Include icons that aren’t characters”.</p>`;
  $("l-gamegrid").querySelectorAll("[data-add]").forEach(b => b.onclick = () => addOne(byId.get(b.dataset.add)));
  favs.wireHearts($("l-gamegrid"), id2 => byId.get(id2));
}

export async function initLetters() {
  IDX = await achIndex();
  if (!IDX) { $("l-row").innerHTML = `<p class="hint">Achievement data hasn’t loaded yet.</p>`; return; }
  IDX.games.forEach(g => games.set(g.id, g));
  $("l-gamecount").textContent = IDX.games.length;
  const sorted = [...IDX.games].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  $("l-style").innerHTML = `<option value="">Mix games (fewest to buy)</option>` + sorted.filter(g => g.tagged).map(g => `<option value="${g.id}">Prefer ${esc(g.name)}</option>`).join("");
  $("l-game").innerHTML = sorted.map(g => `<option value="${g.id}">${esc(g.name)} (${g.icons.toLocaleString()} icons)</option>`).join("");
  const sg = store.get("lb-l-game"); if (games.has(sg)) $("l-game").value = sg;
  $("l-word").value = store.get("lb-l-word", "GG EZ");
  $("l-word").oninput = () => { chosen = {}; open = null; renderPlanner(); };
  $("l-style").onchange = () => { chosen = {}; renderPlanner(); };
  $("l-apply").onclick = () => { profile.setAchievementShowcase(picks.map(p => p || null)); toast("Achievement showcase updated"); location.hash = "#profile"; };
  $("l-game").onchange = renderGame; $("l-all").onchange = renderGame;
  colorBubbles($("l-colors"), () => planColor, c => { planColor = c; store.set("lb-l-pcolor", c); chosen = {}; renderPlanner(); }, "Letter color");
  colorBubbles($("l-colors2"), () => browseColor, c => { browseColor = c; renderBrowse(); });
  if (sel.kind === "group" && !IDX.groups?.[sel.id]) sel = { kind: "char", id: "A" };
  $("l-showall").checked = showAll;
  $("l-showall").onchange = e => setShowAll(e.target.checked);
  $("l-sym").innerHTML = symOptions();
  $("l-sym").onchange = e => { if (e.target.value) { sel = { kind: "group", id: e.target.value }; renderBrowse(); } };
  renderPlanner(); renderBrowse(); renderGame();
}
