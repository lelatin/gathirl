/* =====================================================================
   PARTIES — la page dédiée : recherche (ville, format, niveau…),
   filtres (format, niveau) + grille
   ===================================================================== */
import { $, html, icon, mount, debounce } from "../lib/dom.js?v=202611142327";
import { FORMATS, LEVELS, levelPip } from "../lib/format.js?v=202611142327";
import { distanceKm } from "../lib/geo.js?v=202611142327";
import { db } from "../data/index.js?v=202611142327";
import { partieCard, skeletonCards, enableFoil } from "../ui/card.js?v=202611142327";
import { openCreatePartie } from "../ui/forms.js?v=202611142327";
import { toast } from "../ui/toast.js?v=202611142327";

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
      <label class="search parties-page__search">
        ${icon("search")}
        <span class="sr-only">Rechercher une partie</span>
        <input type="search" data-q list="parties-suggestions" placeholder="Ville, format, niveau…" autocomplete="off" enterkeyhint="search" value="${state.q}" />
      </label>
      <datalist id="parties-suggestions" data-suggestions></datalist>
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

  // Suggestions de la barre de recherche : les villes où il y a des parties, puis formats et niveaux
  const cities = [...new Map(parties.filter((p) => p.city).map((p) => [norm(p.city), p.city.trim()])).values()].sort((a, b) => a.localeCompare(b, "fr"));
  mount($("[data-suggestions]", el), html`${[...cities, ...FORMATS, ...LEVELS].map((s) => html`<option value="${s}"></option>`)}`);

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
  input.addEventListener("input", debounce(() => {
    state.q = input.value;
    renderGrid(el, parties, byPartie, me, { animate: false });
  }, 120));

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
