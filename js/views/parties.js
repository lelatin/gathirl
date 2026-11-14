/* =====================================================================
   PARTIES — la page dédiée : filtres (format, niveau, distance) + grille
   ===================================================================== */
import { $, html, icon, mount } from "../lib/dom.js?v=202611141848";
import { FORMATS, LEVELS, levelPip } from "../lib/format.js?v=202611141848";
import { distanceKm } from "../lib/geo.js?v=202611141848";
import { db } from "../data/index.js?v=202611141848";
import { CONFIG } from "../config.js?v=202611141848";
import { partieCard, skeletonCards, enableFoil } from "../ui/card.js?v=202611141848";
import { openCreatePartie } from "../ui/forms.js?v=202611141848";
import { toast } from "../ui/toast.js?v=202611141848";

const state = { format: null, level: null, near: false };   // les filtres survivent à un aller-retour

export async function render(el, ctx) {
  const me = db.auth.user();

  mount(el, html`
    <section class="section wrap parties-page" aria-labelledby="parties-title">
      <div class="parties-page__head">
        <h1 id="parties-title">Les parties</h1>
        <button type="button" class="btn btn--primary btn--sm" data-action="create-partie">${icon("plus")} Organiser</button>
      </div>
      <div class="filters" data-filters></div>
      <div class="card-grid stagger" data-grid>${skeletonCards(3)}</div>
    </section>`);

  let parties = [];
  let byPartie = {};
  try {
    const [list, parts] = await Promise.all([db.parties.listUpcoming(), db.participations.all()]);
    parties = list;
    for (const p of parts) (byPartie[p.partie_id] ||= []).push(p);
  } catch (e) {
    toast.error("Le grimoire est illisible", e.message);
  }
  if (!el.isConnected) return;

  renderFilters(el, me);
  renderGrid(el, parties, byPartie, me);
  const offFoil = enableFoil(el);

  $("[data-filters]", el).addEventListener("click", (e) => {
    const b = e.target.closest("[data-f]");
    if (!b) return;
    const { f, v } = b.dataset;
    if (f === "near") state.near = !state.near;
    else state[f] = state[f] === v || v === "" ? null : v;
    renderFilters(el, me);
    renderGrid(el, parties, byPartie, me, { animate: false });   // filtre = action fréquente : aucun échelonnement
  });

  if (ctx.query.get("organiser")) openCreatePartie();
  return offFoil;
}

function renderFilters(el, me) {
  const hasCoords = Boolean(me?.city_lat && me?.city_lng);
  mount($("[data-filters]", el), html`
    <div class="filters__row" role="group" aria-label="Filtrer par format">
      <span class="filters__label">Format</span>
      <button type="button" class="chip" data-f="format" data-v="" aria-pressed="${!state.format}">Tous</button>
      ${FORMATS.map((f) => html`<button type="button" class="chip" data-f="format" data-v="${f}" aria-pressed="${state.format === f}">${f}</button>`)}
    </div>
    <div class="filters__row" role="group" aria-label="Filtrer par niveau">
      <span class="filters__label">Niveau</span>
      ${LEVELS.map((l) => html`<button type="button" class="chip" data-f="level" data-v="${l}" aria-pressed="${state.level === l}">${levelPip(l)}${l}</button>`)}
      ${hasCoords ? html`<button type="button" class="chip" data-f="near" aria-pressed="${state.near}">${icon("pin")} À moins de ${CONFIG.NEARBY_RADIUS_KM} km</button>` : ""}
    </div>`);
}

function renderGrid(el, parties, byPartie, me, { animate = true } = {}) {
  const coords = me?.city_lat ? { lat: me.city_lat, lng: me.city_lng } : null;
  const list = parties.filter((p) =>
    (!state.format || p.format === state.format) &&
    (!state.level || p.level === state.level) &&
    (!state.near || (coords && p.location_lat && distanceKm(coords.lat, coords.lng, p.location_lat, p.location_lng) <= CONFIG.NEARBY_RADIUS_KM)));

  const grid = $("[data-grid]", el);
  if (!list.length) {
    grid.classList.remove("card-grid");
    mount(grid, html`
      <div class="empty">
        <svg class="empty__icon"><use href="#i-d20"/></svg>
        <h3>${parties.length ? "Aucune partie ne correspond" : "Aucune partie à venir pour le moment."}</h3>
        <p>${parties.length ? "Élargissez vos filtres, ou dressez vous-même la table que vous cherchez." : "Le tableau est vide… Soyez la première personne à planter un étendard."}</p>
        <button type="button" class="btn btn--primary" data-action="create-partie">${icon("plus")} Organiser une partie</button>
      </div>`);
    return;
  }
  grid.classList.add("card-grid");
  grid.classList.toggle("stagger", animate);
  mount(grid, html`${list.map((p, i) => partieCard(p, { participants: byPartie[p.id] || [], index: Math.min(i, 8), distance: coords && p.location_lat ? distanceKm(coords.lat, coords.lng, p.location_lat, p.location_lng) : null }))}`);
}
