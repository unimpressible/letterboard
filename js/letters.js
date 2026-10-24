// Letters: plan a 7-character achievement showcase, browse every character icon, browse a game's full set.
import { STEAM, achGame, achIndex, esc, store, toast } from "./data.js";
import * as profile from "./profile.js";

const $ = id => document.getElementById(id);
const AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), D09 = "0123456789".split("");
let IDX = null, games = new Map(), chosen = {}, open = null;

const icon = (appid, file, name) => ({ type: "achievement", appid, title: name, game: games.get(appid)?.name || `App ${appid}`,
  img: STEAM.ach(appid, file), thumb: STEAM.ach(appid, file), link: STEAM.achPage(appid), key: `${appid}:${file}` });
const opts = c => (IDX?.chars[c] || []).map(([a, f, n]) => icon(a, f, n));

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
  return c => { for (const g of order) { const h = opts(c).find(o => o.appid === g); if (h) return h; } return opts(c)[0]; };
}

let picks = [];
function renderPlanner() {
  const chars = [...$("l-word").value.toUpperCase()].slice(0, 7);
  store.set("lb-l-word", $("l-word").value);
  const auto = autoPick(chars);
  picks = chars.map((c, i) => { if (c === " ") return null; if (!opts(c).length) return undefined;
    const k = chosen[i + ":" + c]; return (k && opts(c).find(o => o.key === k)) || auto(c); });
  $("l-row").innerHTML = Array.from({ length: 7 }, (_, i) => {
    const c = chars[i], p = picks[i];
    if (c === undefined || c === " ") return `<span class="tile empty"></span>`;
    if (p === undefined) return `<span class="tile missing" title="No icon found">${esc(c)}</span>`;
    return `<button type="button" class="tile ${open === i ? "sel" : ""}" data-i="${i}" title="${esc(`${c} from ${p.game}. Click to choose another of ${opts(c).length}.`)}"><img src="${esc(p.img)}" alt="${esc(c)}"></button>`;
  }).join("");
  $("l-row").querySelectorAll("[data-i]").forEach(b => b.onclick = () => { open = open === +b.dataset.i ? null : +b.dataset.i; renderPlanner(); });

  const pk = $("l-picker");
  if (open != null && picks[open]) {
    const c = chars[open], cur = picks[open], by = new Map();
    opts(c).forEach(o => { if (!by.has(o.appid)) by.set(o.appid, []); by.get(o.appid).push(o); });
    pk.hidden = false;
    pk.innerHTML = `<div class="picker-head"><b>Choose a style for “${esc(c)}” · ${opts(c).length} icons</b><button type="button" class="btn ghost small" id="l-done">Done</button></div>` +
      [...by].map(([g, arr]) => `<div><div class="hint" style="margin-bottom:6px">${esc(games.get(g)?.name)} · ${arr.length}</div><div class="pick-grid">${arr.map(o =>
        `<button type="button" data-k="${esc(o.key)}" aria-pressed="${o.key === cur.key}" title="${esc(o.title)}"><img src="${esc(o.img)}" alt="" loading="lazy"></button>`).join("")}</div></div>`).join("");
    pk.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { chosen[open + ":" + c] = b.dataset.k; renderPlanner(); });
    $("l-done").onclick = () => { open = null; renderPlanner(); };
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

let sel = store.get("lb-l-key", "A");
function keyBtns(keys) { return keys.map(k => { const n = (IDX.chars[k] || []).length;
  return `<button type="button" class="key" aria-pressed="${k === sel}" data-k="${esc(k)}" aria-label="${esc(k)}: ${n} icons" ${n ? "" : "disabled"}>${esc(k)}<span class="n">${n}</span></button>`; }).join(""); }
function renderKeys() {
  const others = Object.keys(IDX.chars).filter(k => !AZ.includes(k) && !D09.includes(k)).sort((a, b) => IDX.chars[b].length - IDX.chars[a].length);
  $("l-keys").innerHTML = keyBtns([...AZ, ...D09]); $("l-keys2").innerHTML = keyBtns(others);
  document.querySelectorAll("#l-keys [data-k], #l-keys2 [data-k]").forEach(b => b.onclick = () => { sel = b.dataset.k; store.set("lb-l-key", sel); renderKeys(); });
  const by = new Map(); opts(sel).forEach(o => { if (!by.has(o.appid)) by.set(o.appid, []); by.get(o.appid).push(o); });
  $("l-browse").innerHTML = [...by].map(([g, arr]) => `<div class="group"><h3>${esc(games.get(g)?.name)} <span class="hint">${arr.length} icons</span>
    <a href="${STEAM.achPage(g)}" target="_blank" rel="noopener">Achievements</a></h3>
    <div class="icon-grid">${arr.map(o => `<button type="button" class="icon" data-add="${esc(o.key)}" title="Add to achievement showcase"><img src="${esc(o.img)}" alt="" loading="lazy"><span>${esc(o.title)}</span></button>`).join("")}</div></div>`).join("")
    || `<p class="hint">No icons for “${esc(sel)}”.</p>`;
  $("l-browse").querySelectorAll("[data-add]").forEach(b => b.onclick = () => addOne(opts(sel).find(o => o.key === b.dataset.add)));
}
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
  const icons = await achGame(id), all = $("l-all").checked;
  const shown = icons.filter(x => all || x[3]);
  $("l-gameinfo").innerHTML = `${esc(g.note || "")} ${g.total.toLocaleString()} achievements, ${g.icons.toLocaleString()} different icons, ${g.tagged.toLocaleString()} are characters. <a href="${STEAM.store(id)}" target="_blank" rel="noopener">Store</a>`;
  $("l-gamegrid").innerHTML = shown.map(([f, n, d, c]) => `<div class="icon"><img src="${STEAM.ach(id, f)}" alt="" loading="lazy"><span>${esc(c || n)}</span></div>`).join("")
    || `<p class="hint">None of this game’s icons are named after a character. Tick “Include icons that aren’t characters”.</p>`;
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
  renderPlanner(); renderKeys(); renderGame();
}
