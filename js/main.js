// App shell: hash routing between the four views, wiring pick mode between builder and catalog.
import { json } from "./data.js";
import { initProfile, setPicker, render as renderProfile } from "./profile.js";
import { initCatalog, startPick } from "./catalog.js";
import { initLetters } from "./letters.js";

const VIEWS = ["profile", "catalog", "letters", "help"];
let started = {};

function route() {
  const v = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "profile";
  for (const x of VIEWS) document.getElementById("view-" + x).hidden = x !== v;
  document.querySelectorAll(".tabs a").forEach(a => { if (a.dataset.view === v) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  if (!started[v]) {
    started[v] = true;
    if (v === "catalog") initCatalog();
    if (v === "letters") initLetters();
  }
  if (v === "profile") renderProfile();
  window.scrollTo(0, 0);
}

setPicker(ctx => { if (!started.catalog) { started.catalog = true; initCatalog().then(() => startPick(ctx)); } else startPick(ctx); });
initProfile();
window.addEventListener("hashchange", route);
route();

// Data freshness note on the help page.
Promise.all([json("data/achievements/index.json"), json("data/items/background.json"), json("data/cards/index.json")]).then(([a, b, c]) => {
  const d = x => x?.updated ? new Date(x.updated).toLocaleDateString() : "not yet";
  document.getElementById("data-dates").textContent = `Data last updated from Steam: achievements ${d(a)}, Points Shop ${d(b)}, trading cards ${d(c)}.`;
});
