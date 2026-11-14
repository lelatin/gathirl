/* =====================================================================
   PARTIES — la page dédiée : recherche (ville, format, niveau…),
   filtres (format, niveau) + grille
   ===================================================================== */
import { $, html, icon, mount, debounce } from "../lib/dom.js?v=202611142332";
import { FORMATS, LEVELS, levelPip } from "../lib/format.js?v=202611142332";
import { distanceKm } from "../lib/geo.js?v=202611142332";
import { db } from "../data/index.js?v=202611142332";
import { partieCard, skeletonCards, enableFoil } from "../ui/card.js?v=202611142332";
import { openCreatePartie } from "../ui/forms.js?v=202611142332";
import { toast } from "../ui/toast.js?v=202611142332";

const state = { format: null, level: null, q: "" };   // recherche et filtres survivent à un aller-retour

/* Comparaison sans accents ni majuscules : « debutant » trouve « Débutant », « st etienne » trouve « Saint-Étienne »… */
const norm = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[-'’]/g, " ");

export async function render(el, ctx) {
  const me = db.auth.user();

  mount(el, html`
    <section class="section wrap parties-page" aria-labelledby="parties-title">
      <div class="parties-page__head">
        <h1 id="parties-title">Parties</h1>
        <button type="button" class="btn btn--primary btn--sm" data-action="create-partie">${icon("plus")} Organiser</button>
      </div>
      <div class="finder">
        <label class="search parties-page__search">
          ${icon("search")}
          <span class="sr-only">Rechercher une partie</span>
          <input type="search" data-q role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="finder-list"
                 placeholder="Ville, format, niveau…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" value="${state.q}" />
        </label>
        <ul class="finder__list" id="finder-list" role="listbox" aria-label="Suggestions" data-suggestions hidden></ul>
      </div>
      <div class="filters" data-filters></div>
      <div class="card-grid stagger" data-grid>${skeletonCards(3)}</div>
    </section>`);

  let parties = [];
  let byPartie = {};
  try {
    parties = await db.parties.listUpcoming();
    const parts = await db.participations.forParties(parties.map((p) => p.id));
    for (const p of parts) (byPartie[p.partie_id] ||= []).push(p);
  } catch (e) {
    toast.error("Le grimoire est illisible", e.message);
  }
  if (!el.isConnected) return;

  // Ce que la barre peut proposer : villes et lieux où il y a des parties, formats, niveaux
  const uniq = (list) => [...new Map(list.filter(Boolean).map((s) => [norm(s.trim()), s.trim()])).values()].sort((a, b) => a.localeCompare(b, "fr"));
  const pool = [
    ...uniq(parties.map((p) => p.city)).map((v) => ({ v, type: "Ville", ic: "pin" })),
    ...uniq(parties.map((p) => p.location)).map((v) => ({ v, type: "Lieu", ic: "map" })),
    ...FORMATS.map((v) => ({ v, type: "Format", ic: "swords" })),
    ...LEVELS.map((v) => ({ v, type: "Niveau", ic: "d20" })),
  ];

  renderFilters(el);
  renderGrid(el, parties, byPartie, me);
  const offFoil = enableFoil(el);

  $("[data-filters]", el).addEventListener("click", (e) => {
    const b = e.target.closest("[data-f]");
    if (!b) return;
    const { f, v } = b.dataset;
    state[f] = state[f] === v || v === "" ? null : v;
    renderFilters(el);
    renderGrid(el, parties, byPartie, me, { animate: false });   // filtre = action fréquente : aucun échelonnement
  });

  const input = $("[data-q]", el);
  const listEl = $("[data-suggestions]", el);
  const apply = () => { state.q = input.value; renderGrid(el, parties, byPartie, me, { animate: false }); };
  input.addEventListener("input", debounce(apply, 120));

  /* ---------- Suggestions dès 3 lettres ----------
     On complète le dernier mot tapé (« lyon comm » → « lyon Commander ») ;
     d'abord ce qui commence par ces lettres, puis ce qui les contient. */
  let items = [], active = -1;
  const lastWord = () => input.value.replace(/\s+$/, "").split(/\s+/).pop() || "";
  const close = () => { listEl.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); active = -1; };
  const suggest = () => {
    const term = norm(lastWord());
    if (term.length < 3 || document.activeElement !== input) return close();
    const starts = [], contains = [];
    for (const s of pool) {
      const n = norm(s.v);
      if (n === norm(input.value.trim())) continue;   // déjà tapé en entier
      if (n.startsWith(term) || n.split(" ").some((w) => w.startsWith(term))) starts.push(s);
      else if (n.includes(term)) contains.push(s);
    }
    items = [...starts, ...contains].slice(0, 6);
    if (!items.length) return close();
    active = -1;
    mount(listEl, html`${items.map((s, i) => html`
      <li class="finder__item" role="option" id="finder-opt-${i}" data-i="${i}" aria-selected="false">
        ${icon(s.ic, "finder__icon")}
        <span class="finder__value">${highlight(s.v, term)}</span>
        <span class="finder__type">${s.type}</span>
      </li>`)}`);
    listEl.hidden = false;
    input.setAttribute("aria-expanded", "true");
  };
  const choose = (i) => {
    const s = items[i];
    if (!s) return;
    const words = input.value.replace(/\s+$/, "").split(/\s+/);
    words[words.length - 1] = s.v;
    input.value = words.join(" ") + " ";
    close();
    apply();
    input.focus();
  };
  const move = (d) => {
    if (listEl.hidden) return;
    active = (active + d + items.length) % items.length;
    listEl.querySelectorAll("[role=option]").forEach((o, i) => o.setAttribute("aria-selected", i === active));
    input.setAttribute("aria-activedescendant", `finder-opt-${active}`);
  };
  input.addEventListener("input", suggest);
  input.addEventListener("focus", suggest);
  input.addEventListener("blur", () => setTimeout(close, 120));
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter" && !listEl.hidden && active >= 0) { e.preventDefault(); choose(active); }
    else if (e.key === "Escape" && !listEl.hidden) { e.preventDefault(); close(); }
    else if (e.key === "Enter") { input.blur(); }   // téléphone : « Rechercher » ferme le clavier
  });
  // pointerdown (et non click) : la suggestion est choisie avant que le champ perde le focus
  listEl.addEventListener("pointerdown", (e) => {
    const li = e.target.closest("[data-i]");
    if (!li) return;
    e.preventDefault();
    choose(Number(li.dataset.i));
  });

  if (ctx.query.get("organiser")) openCreatePartie();
  return offFoil;
}

function renderFilters(el) {
  mount($("[data-filters]", el), html`
    <div class="filters__row" role="group" aria-label="Filtrer par format">
      <span class="filters__label">Format</span>
      <button type="button" class="chip" data-f="format" data-v="" aria-pressed="${!state.format}">Tous</button>
      ${FORMATS.map((f) => html`<button type="button" class="chip" data-f="format" data-v="${f}" aria-pressed="${state.format === f}">${f}</button>`)}
    </div>
    <div class="filters__row" role="group" aria-label="Filtrer par niveau">
      <span class="filters__label">Niveau</span>
      ${LEVELS.map((l) => html`<button type="button" class="chip" data-f="level" data-v="${l}" aria-pressed="${state.level === l}">${levelPip(l)}${l}</button>`)}
    </div>`);
}

/** Met en gras les lettres tapées dans une suggestion (sans tenir compte des accents) */
function highlight(value, term) {
  const n = norm(value);
  const at = n.indexOf(term);
  if (at < 0) return value;
  // norm() garde une lettre par lettre de base : les positions correspondent sur la chaîne décomposée
  const base = value.normalize("NFD");
  const map = [];
  for (let i = 0; i < base.length; i++) if (!/\p{Diacritic}/u.test(base[i])) map.push(i);
  const from = map[at], to = map[at + term.length - 1] + 1;
  const part = (s) => s.normalize("NFC");
  return html`${part(base.slice(0, from))}<b>${part(base.slice(from, to))}</b>${part(base.slice(to))}`;
}

/** Chaque mot tapé doit se retrouver quelque part : ville, lieu, format, niveau, titre ou organisateur */
function matches(p, words) {
  if (!words.length) return true;
  const hay = norm([p.city, p.location, p.format, p.level, p.title, p.host_name].join(" "));
  return words.every((w) => hay.includes(w));
}

function renderGrid(el, parties, byPartie, me, { animate = true } = {}) {
  const coords = me?.city_lat ? { lat: me.city_lat, lng: me.city_lng } : null;
  const words = norm(state.q).split(/\s+/).filter(Boolean);
  const list = parties.filter((p) =>
    (!state.format || p.format === state.format) &&
    (!state.level || p.level === state.level) &&
    matches(p, words));

  const grid = $("[data-grid]", el);
  if (!list.length) {
    grid.classList.remove("card-grid");
    mount(grid, html`
      <div class="empty">
        <svg class="empty__icon"><use href="#i-d20"/></svg>
        <h3>${parties.length ? "Aucune partie ne correspond" : "Aucune partie à venir pour le moment."}</h3>
        <p>${parties.length ? "Essayez une autre recherche ou élargissez vos filtres, ou dressez vous-même la table que vous cherchez." : "Le tableau est vide… Soyez la première personne à planter un étendard."}</p>
        <button type="button" class="btn btn--primary" data-action="create-partie">${icon("plus")} Organiser une partie</button>
      </div>`);
    return;
  }
  grid.classList.add("card-grid");
  grid.classList.toggle("stagger", animate);
  mount(grid, html`${list.map((p, i) => partieCard(p, { participants: byPartie[p.id] || [], index: Math.min(i, 8), distance: coords && p.location_lat ? distanceKm(coords.lat, coords.lng, p.location_lat, p.location_lng) : null }))}`);
}
