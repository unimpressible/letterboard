// Profile builder: editor column + live Steam profile replica + mini-profile + shopping list.
import { STEAM, esc, fixSaved, store, toast } from "./data.js";

const KEY = "lb-profile-v2";
const SHOWCASES = {
  achievements: "Achievement Showcase",
  items: "Item Showcase",
  info: "Custom Info Box",
  game: "Favorite Game",
  artwork: "Artwork Showcase",
};
const blankShowcase = kind => ({
  achievements: { kind, slots: Array(7).fill(null) },
  items: { kind, rows: 1, slots: Array(6).fill(null) },
  info: { kind, title: "About me", text: "" },
  game: { kind, appid: 0, name: "" },
  artwork: { kind, url: "", title: "" },
}[kind]);
export const defaults = () => ({
  name: "Your Name", real: "", country: "", level: 10,
  summary: "Hi! Build your whole profile here, then copy it to Steam.",
  background: null, mini: null, avatar: null, frame: null,
  showcases: [blankShowcase("achievements"), blankShowcase("items")],
});

// Keep only what's needed to draw an item (keeps saved profiles and share links small).
export const snap = it => it && ({ type: it.type, appid: it.appid, title: it.title, game: it.game, img: it.img,
  thumb: it.thumb, still: it.still, webm: it.webm, mp4: it.mp4, contain: it.contain, link: it.link, animated: it.animated, desc: it.desc, v: it.v });

export let P = load();
function load() {
  const fromHash = decodeShare(location.hash);
  if (fromHash) { history.replaceState(null, "", "#profile"); return migrate(fromHash); }
  return migrate({ ...defaults(), ...store.get(KEY, {}) });
}
function migrate(p) {
  for (const k of ["avatar", "frame", "background", "mini"]) p[k] = fixSaved(p[k]);
  for (const sc of p.showcases || []) if (sc.slots) sc.slots = sc.slots.map(fixSaved);
  return p;
}
export function save() { store.set(KEY, P); render(); }
function encodeShare(p) {
  const bytes = new TextEncoder().encode(JSON.stringify(p));
  let bin = ""; bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeShare(hash) {
  const m = /[#&]share=([\w-]+)/.exec(hash || ""); if (!m) return null;
  try {
    const bin = atob(m[1].replace(/-/g, "+").replace(/_/g, "/"));
    return { ...defaults(), ...JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)))) };
  } catch { return null; }
}

let pick = null;   // set by main.js: pick({types, label, onPick, onClear})
export function setPicker(fn) { pick = fn; }

/* ---------------- rendering helpers ---------------- */
const media = (it, cls = "") => {
  if (!it) return "";
  if (it.webm || it.mp4) return `<video class="${cls}" autoplay loop muted playsinline poster="${esc(it.img)}">${it.webm ? `<source src="${esc(it.webm)}" type="video/webm">` : ""}${it.mp4 ? `<source src="${esc(it.mp4)}" type="video/mp4">` : ""}</video>`;
  return `<img class="${cls} ${it.contain ? "contain" : ""}" src="${esc(it.img)}" alt="${esc(it.title)}" loading="lazy">`;
};
export function emojify(text) {
  return esc(text).replace(/:([A-Za-z0-9_]{2,40}):/g, (m, n) => `<img class="emo" src="${STEAM.emote(n)}" alt=":${n}:" title=":${n}:" onerror="this.replaceWith(document.createTextNode(this.alt))">`);
}
const ringColor = lvl => ["#9b9b9b","#c02942","#d95b43","#fecc23","#467a3c","#4e8ddb","#7652c9","#c252c9","#542437","#997c52"][Math.floor((lvl % 100) / 10)];

const avatarSrc = a => a && a.img;
function avatarHtml(cls) {
  return `<div class="${cls}"><div class="pic">${P.avatar ? `<img src="${esc(avatarSrc(P.avatar))}" alt="">` : `<span class="q">?</span>`}</div>
    ${P.frame ? `<img class="frame" src="${esc(P.frame.img)}" alt="">` : ""}</div>`;
}

function showcaseHtml(sc, i) {
  const title = SHOWCASES[sc.kind];
  let inner = "";
  if (sc.kind === "achievements") {
    inner = `<div class="ach">${sc.slots.map((s, k) => `<button type="button" class="cell ${s ? "" : "empty"}" data-sc="${i}" data-slot="${k}" title="${esc(s ? `${s.title} · ${s.game}` : "Add an achievement")}">${s ? `<img src="${esc(s.img)}" alt="${esc(s.title)}">` : ""}</button>`).join("")}</div>
      <div class="stats"><div><b>—</b>Achievements</div><div><b>—</b>Perfect Games</div><div><b>—</b>Avg. Game Completion Rate</div></div>`;
  } else if (sc.kind === "items") {
    inner = `<div class="items">${sc.slots.map((s, k) => `<button type="button" class="cell ${s ? "" : "empty"}" data-sc="${i}" data-slot="${k}" title="${esc(s ? `${s.title} · ${s.game}` : "Add an item")}">${s ? media(s) : ""}</button>`).join("")}</div>`;
  } else if (sc.kind === "info") {
    inner = `<div class="info">${emojify(sc.text) || `<span class="emptynote">Write your text in the editor.</span>`}</div>`;
  } else if (sc.kind === "game") {
    inner = sc.appid ? `<div class="game"><img src="${STEAM.header(sc.appid)}" alt="" onerror="this.style.visibility='hidden'"><div><div style="font-size:18px;color:#fff">${esc(sc.name || `App ${sc.appid}`)}</div><div class="hint" style="color:#8f98a0">Favorite game</div></div></div>`
      : `<div class="emptynote">Paste a Steam store link in the editor.</div>`;
  } else if (sc.kind === "artwork") {
    inner = sc.url ? `<div class="art"><img src="${esc(sc.url)}" alt="${esc(sc.title)}"></div>` : `<div class="emptynote">Paste an image link in the editor.</div>`;
  }
  const head = sc.kind === "info" ? esc(sc.title || title) : title;
  return `<div class="box"><div class="bt">${head}</div><div class="inner">${inner}</div></div>`;
}

export function render() {
  const s = document.getElementById("steam");
  const bg = P.background;
  s.innerHTML = `<div class="bg" style="${bg && !bg.webm ? `background-image:url('${esc(bg.img)}')` : ""}">${bg && (bg.webm || bg.mp4) ? media(bg) : ""}</div><div class="shade"></div>
  <div class="content">
    <div class="header">
      <div class="av-wrap" data-act="avatar">${avatarHtml("av")}</div>
      <div class="who" data-act="name"><h1>${esc(P.name || "Your Name")}</h1>
        ${P.real || P.country ? `<div class="real">${esc([P.real, P.country].filter(Boolean).join(" · "))}</div>` : ""}
        <div class="summary">${emojify(P.summary)}</div></div>
      <div class="lvl"><div class="lv">Level <span class="ring" style="--ring:${ringColor(Number(P.level) || 0)}">${esc(P.level || 0)}</span></div>
        <button class="edit" type="button" tabindex="-1">Edit Profile</button></div>
    </div>
    <div class="body">
      <div class="col">${P.showcases.map(showcaseHtml).join("") || `<div class="box"><div class="bt">Showcases</div><div class="inner emptynote">Add a showcase in the editor.</div></div>`}</div>
      <div class="col side">
        <div class="box"><div class="inner" style="padding-top:12px"><div class="online">Currently Online</div></div></div>
        <div class="box"><div class="bt">Badges</div><div class="inner emptynote">Your badges show here on Steam.</div></div>
        <div class="box"><div class="bt">Games</div><div class="inner emptynote">Your game count shows here on Steam.</div></div>
      </div>
    </div>
  </div>`;
  s.querySelectorAll("[data-sc]").forEach(b => b.onclick = () => chooseSlot(+b.dataset.sc, +b.dataset.slot));
  s.querySelector("[data-act=avatar]").onclick = () => chooseLook("avatar");
  s.querySelector("[data-act=name]").onclick = () => document.getElementById("p-name").focus();

  const mini = document.getElementById("mini");
  const m = P.mini;
  mini.innerHTML = `<div class="mbg" style="${m && !m.webm ? `background-image:url('${esc(m.img)}')` : ""}">${m && (m.webm || m.mp4) ? media(m) : ""}</div>
    <div class="mtop">${avatarHtml("mav")}<div><div class="mname">${esc(P.name || "Your Name")}</div><div class="mstat">Online</div></div></div>
    <div class="mlvl">Steam Level ${esc(P.level || 0)}</div>`;
  mini.onclick = () => chooseLook("mini");

  renderEditor();
  renderShopping();
}

/* ---------------- editor ---------------- */
const LOOK = [["background", "Background"], ["avatar", "Avatar"], ["frame", "Avatar frame"], ["mini", "Mini-profile"]];
function renderEditor() {
  const set = (id, v) => { const el = document.getElementById(id); if (document.activeElement !== el) el.value = v ?? ""; };
  set("p-name", P.name); set("p-real", P.real); set("p-country", P.country); set("p-level", P.level); set("p-summary", P.summary);
  document.getElementById("look-slots").innerHTML = LOOK.map(([k, label]) => {
    const it = P[k];
    return `<button type="button" class="slot" data-look="${k}">${it ? `<img src="${esc(it.thumb || it.img)}" alt="">` : `<span class="ph"></span>`}
      <span><b>${label}</b><i>${it ? esc(it.title) : "None"}</i></span></button>`;
  }).join("");
  document.querySelectorAll("[data-look]").forEach(b => b.onclick = () => chooseLook(b.dataset.look));

  const list = document.getElementById("sc-list");
  list.innerHTML = P.showcases.map((sc, i) => {
    let body = "";
    if (sc.kind === "achievements") body = `<p class="hint">Click a slot in the preview, or build a word on the <a href="#letters">Letters</a> page.</p>`;
    if (sc.kind === "items") body = `<label>Rows<select data-rows="${i}">${[1, 2, 3, 4].map(r => `<option ${r === sc.rows ? "selected" : ""}>${r}</option>`).join("")}</select></label><p class="hint">Click a slot in the preview to add an item.</p>`;
    if (sc.kind === "info") body = `<label>Title<input type="text" data-f="title" data-i="${i}" value="${esc(sc.title)}"></label><label>Text<textarea rows="3" data-f="text" data-i="${i}">${esc(sc.text)}</textarea></label>`;
    if (sc.kind === "game") body = `<label>Steam store link or app ID<input type="text" data-f="game" data-i="${i}" value="${sc.appid || ""}" placeholder="store.steampowered.com/app/…"></label><label>Name<input type="text" data-f="name" data-i="${i}" value="${esc(sc.name)}"></label>`;
    if (sc.kind === "artwork") body = `<label>Image link<input type="text" data-f="url" data-i="${i}" value="${esc(sc.url)}" placeholder="https://…"></label>`;
    return `<div class="sc"><div class="sc-top"><b>${SHOWCASES[sc.kind]}</b><span class="btnrow">
      <button type="button" class="btn ghost small" data-mv="${i}:-1" ${i === 0 ? "disabled" : ""} aria-label="Move up">↑</button>
      <button type="button" class="btn ghost small" data-mv="${i}:1" ${i === P.showcases.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button>
      <button type="button" class="btn ghost small" data-rm="${i}">Remove</button></span></div>${body}</div>`;
  }).join("") || `<p class="hint">No showcases yet.</p>`;
  list.querySelectorAll("[data-mv]").forEach(b => b.onclick = () => { const [i, d] = b.dataset.mv.split(":").map(Number); const a = P.showcases; [a[i], a[i + d]] = [a[i + d], a[i]]; save(); });
  list.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { P.showcases.splice(+b.dataset.rm, 1); save(); });
  list.querySelectorAll("[data-rows]").forEach(sel => sel.onchange = () => {
    const sc = P.showcases[+sel.dataset.rows], n = +sel.value * 6; sc.rows = +sel.value;
    sc.slots = sc.slots.slice(0, n).concat(Array(Math.max(0, n - sc.slots.length)).fill(null)); save(); });
  list.querySelectorAll("[data-f]").forEach(el => el.oninput = () => {
    const sc = P.showcases[+el.dataset.i], f = el.dataset.f;
    if (f === "game") { const m = el.value.match(/(\d{2,9})/); sc.appid = m ? +m[1] : 0; }
    else sc[f] = el.value;
    store.set(KEY, P); renderPreviewOnly();
  });
}
let raf = 0;
function renderPreviewOnly() { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { const a = document.activeElement?.id; render(); if (a) document.getElementById(a)?.focus(); }); }

function chooseLook(k) {
  pick?.({ types: [k], label: `Choose a ${{ background: "profile background", avatar: "animated avatar", frame: "avatar frame", mini: "mini-profile background" }[k]}`,
    onPick: it => { P[k] = snap(it); save(); toast(`${it.title} set`); },
    onClear: P[k] ? () => { P[k] = null; save(); } : null });
}
function chooseSlot(i, k) {
  const sc = P.showcases[i];
  if (sc.kind === "achievements") pick?.({ types: ["achievement"], label: `Choose achievement slot ${k + 1} of 7`,
    onPick: it => { sc.slots[k] = snap(it); save(); }, onClear: sc.slots[k] ? () => { sc.slots[k] = null; save(); } : null });
  else pick?.({ types: ["emoticon", "sticker", "card", "background", "mini", "avatar", "frame"], label: `Choose item slot ${k + 1}`,
    onPick: it => { sc.slots[k] = snap(it); save(); }, onClear: sc.slots[k] ? () => { sc.slots[k] = null; save(); } : null });
}

/* ---------------- shopping list ---------------- */
function renderShopping() {
  const rows = [];
  for (const [k, label] of LOOK) if (P[k]) rows.push({ it: P[k], label });
  for (const sc of P.showcases) for (const s of sc.slots || []) if (s) rows.push({ it: s, label: SHOWCASES[sc.kind] });
  const byGame = new Map();
  const out = [];
  for (const r of rows) {
    if (r.it.type === "achievement") {
      const g = byGame.get(r.it.appid) || { it: r.it, names: [] }; g.names.push(r.it.title); byGame.set(r.it.appid, g);
    } else out.push(`<div class="shop"><img src="${esc(r.it.thumb || r.it.img)}" alt=""><div><b>${esc(r.it.title)}</b><span class="hint">${esc(r.label)} · ${esc(r.it.game || "")}</span>
      <div class="links"><a href="${esc(r.it.link)}" target="_blank" rel="noopener">${r.it.type === "card" ? "Market listing" : "Points Shop"}</a></div></div></div>`);
  }
  for (const [appid, g] of byGame) out.push(`<div class="shop"><img src="${esc(g.it.img)}" alt=""><div><b>${esc(g.it.game)}</b>
    <span class="hint">Unlock: ${esc(g.names.join(", "))}</span><div class="links"><a href="${STEAM.store(appid)}" target="_blank" rel="noopener">Store</a><a href="${STEAM.achPage(appid)}" target="_blank" rel="noopener">Achievements</a></div></div></div>`);
  document.getElementById("shopping").innerHTML = out.join("") || `<p class="hint">Everything you add appears here with a link to get it.</p>`;
}

/* ---------------- public API ---------------- */
export function addShowcase(kind) { P.showcases.push(blankShowcase(kind)); save(); }
export function setAchievementShowcase(slots) {
  let sc = P.showcases.find(x => x.kind === "achievements");
  if (!sc) { sc = blankShowcase("achievements"); P.showcases.unshift(sc); }
  sc.slots = Array.from({ length: 7 }, (_, i) => slots[i] ? snap(slots[i]) : null); save();
}
export function initProfile() {
  const bind = (id, key, num) => document.getElementById(id).addEventListener("input", e => { P[key] = num ? Number(e.target.value) : e.target.value; store.set(KEY, P); renderPreviewOnly(); });
  bind("p-name", "name"); bind("p-real", "real"); bind("p-country", "country"); bind("p-level", "level", true); bind("p-summary", "summary");
  document.getElementById("sc-add").onchange = e => { if (e.target.value) { addShowcase(e.target.value); e.target.value = ""; } };
  document.getElementById("p-reset").onclick = () => {
    const b = document.getElementById("p-reset");
    if (b.dataset.armed) { P = defaults(); save(); delete b.dataset.armed; b.textContent = "Start over"; toast("Profile cleared"); }
    else { b.dataset.armed = 1; b.textContent = "Click again to clear"; setTimeout(() => { delete b.dataset.armed; b.textContent = "Start over"; }, 3000); }
  };
  document.getElementById("p-share").onclick = async () => {
    const url = `${location.origin}${location.pathname}#share=${encodeShare(P)}`;
    try { await navigator.clipboard.writeText(url); toast("Share link copied"); }
    catch { document.getElementById("p-status").textContent = url; }
  };
  render();
}
