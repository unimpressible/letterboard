// Collapsible game groups. Click a game's name to close its icons; click again to reopen.
// Everything starts open: closing only lasts until the page reloads or a new letter is picked.
import { esc, store } from "./data.js";

store.set("lb-folded", null);          // forget closed games saved by the earlier version
let folded = new Set();
const save = () => {};
export function reset() { folded.clear(); }

export const isFolded = id => folded.has(String(id));
export function setAll(ids, closed) { ids.forEach(id => closed ? folded.add(String(id)) : folded.delete(String(id))); save(); }

// Header button for a group. `extra` is any trailing HTML (counts, links).
export function header(id, label, extra = "") {
  const closed = isFolded(id);
  return `<button type="button" class="fold" data-fold="${esc(id)}" aria-expanded="${!closed}"><span class="chev" aria-hidden="true"></span>${esc(label)}</button>${extra}`;
}
// Wire every fold header inside `root`; `rerender` redraws after a toggle.
export function wire(root, rerender) {
  root.querySelectorAll("[data-fold]").forEach(b => b.onclick = () => {
    const id = b.dataset.fold; folded.has(id) ? folded.delete(id) : folded.add(id); save(); rerender();
  });
}
// "Close all / Open all" controls for a list of group ids.
export function controls(ids) {
  const anyOpen = ids.some(id => !isFolded(id));
  return `<button type="button" class="btn ghost small" data-foldall="${anyOpen ? "close" : "open"}">${anyOpen ? "Close all games" : "Open all games"}</button>`;
}
export function wireControls(root, ids, rerender) {
  root.querySelectorAll("[data-foldall]").forEach(b => b.onclick = () => { setAll(ids, b.dataset.foldall === "close"); rerender(); });
}
