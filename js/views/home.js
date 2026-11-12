/* =====================================================================
   ACCUEIL — l'essentiel, dans l'ordre où on en a besoin :
   1. Héros (titre, actions, chiffres en une ligne) + carte de l'Oracle
   2. Les parties (filtres + grille)
   3. Les joueurs près de chez vous
   4. Compagnons (si connecté·e)
   ===================================================================== */
import { $, $$, html, icon, mount, canHover, prefersReducedMotion } from "../lib/dom.js?v=202611120146";
import { FORMATS, LEVELS, artFor, fmtDate, fmtTime, levelPip, plural, sigil } from "../lib/format.js?v=202611120146";
import { distanceKm } from "../lib/geo.js?v=202611120146";
import { db } from "../data/index.js?v=202611120146";
import { CONFIG } from "../config.js?v=202611120146";
import { partieCard, skeletonCards, enableFoil } from "../ui/card.js?v=202611120146";
import { openCreatePartie } from "../ui/forms.js?v=202611120146";
import { toast } from "../ui/toast.js?v=202611120146";

const state = { format: null, level: null, near: false };

export async function render(el, ctx) {
  const me = db.auth.user();

  mount(el, html`
    <section class="hero">
      <div class="wrap hero__grid">
        <div class="hero__text">
          <h1 class="hero__title">Trouvez votre prochaine partie <span class="chrome">Magic</span></h1>
          <p class="hero__lede">L'application pour trouver des joueurs et des parties près de chez vous, rejoignez une partie ou organisez la vôtre.</p>
          <div class="hero__ctas">
            <button type="button" class="btn btn--primary" data-action="create-partie">${icon("plus")} Organiser une partie</button>
            <a class="btn" href="#/parties">${icon("swords")} Voir les parties</a>
            <button type="button" class="btn btn--ghost" data-roll title="Le dé choisit une partie au hasard">${icon("d20", "d20")} Lancer le d20</button>
          </div>
          <p class="hero__facts" data-stats aria-live="polite">&nbsp;</p>
        </div>

        <div class="oracle-wrap">
          <article class="tcard oracle" data-oracle aria-label="L'Oracle du Gathirl">
            <div class="tcard__inner">
              <header class="tcard__name"><h3>L'Oracle du Gathirl</h3>
                <span class="pips"><span class="pip pip--b">${icon("skull")}</span><span class="pip pip--r">${icon("flame")}</span></span>
              </header>
              <div class="tcard__art print"><img src="assets/img/oracle-moine.jpg" alt="Un moine encapuchonné tenant une torche, dans la fenêtre en arche gothique d'une tour crénelée, sous une lune rouge, en bichromie rouge et noire." width="720" height="891" fetchpriority="high" /></div>
              <div class="tcard__type"><span>Créature légendaire · Moine écarlate</span>${icon("crown", "tcard__set")}</div>
              <div class="tcard__text">
                <p style="font-size:14.5px">Au début de chaque semaine, révélez les tables ouvertes près de chez vous.</p>
                <p class="tcard__flavor">« Vous n'êtes pas seul. Aventurez-vous. »</p>
                <a class="tcard__lore" href="#/lore">Lire la légende de l'Oracle →</a>
              </div>
            </div>
            <span class="tcard__pt">∞/∞</span>
            <span class="tcard__foil" aria-hidden="true"></span>
          </article>
        </div>
      </div>
    </section>

    <section class="section wrap" id="parties" aria-labelledby="parties-title">
      <div class="section-head">
        <div><h2 id="parties-title">Les parties</h2></div>
        <span class="filters__count" data-count></span>
      </div>
      <div class="filters" data-filters></div>
      <div class="card-grid stagger" data-grid>${skeletonCards(3)}</div>
    </section>

    <section class="section wrap" data-players hidden aria-labelledby="players-title"></section>

    <section class="section wrap" data-friends hidden aria-labelledby="friends-title"></section>
  `);

  /* ---------- Données ---------- */
  let parties = [];
  let byPartie = {};
  try {
    const [list, parts] = await Promise.all([db.parties.listUpcoming(), db.participations.all()]);
    parties = list;
    byPartie = {};
    for (const p of parts) (byPartie[p.partie_id] ||= []).push(p);
  } catch (e) {
    toast.error("Le grimoire est illisible", e.message);
  }
  if (!el.isConnected) return;

  renderStats(el, parties);
  renderFilters(el, me);
  renderGrid(el, parties, byPartie, me);
  renderPlayers(el, me);
  renderFriends(el, me);

  /* ---------- Interactions ---------- */
  const offFoil = enableFoil(el);
  const offTilt = oracleTilt($("[data-oracle]", el));

  $("[data-filters]", el).addEventListener("click", (e) => {
    const b = e.target.closest("[data-f]");
    if (!b) return;
    const { f, v } = b.dataset;
    if (f === "near") state.near = !state.near;
    else state[f] = state[f] === v || v === "" ? null : v;
    renderFilters(el, me);
    renderGrid(el, parties, byPartie, me, { animate: false });   // filtre = action fréquente : aucun échelonnement
  });

  $("[data-roll]", el).addEventListener("click", (e) => rollD20(e.currentTarget, parties));

  if (ctx.query.get("organiser")) openCreatePartie();
  if (ctx.path === "/parties") requestAnimationFrame(() => $("#parties", el)?.scrollIntoView({ block: "start" }));

  return () => { offFoil(); offTilt(); };
}

/* ===================================================================== */

/* Les chiffres tiennent en une ligne sous les boutons : on les lit d'un coup d'œil */
function renderStats(el, parties) {
  const open = parties.filter((p) => p.current_players < p.max_players).length;
  const cities = new Set(parties.map((p) => p.city?.trim().toLowerCase()).filter(Boolean)).size;
  const players = parties.reduce((s, p) => s + (p.current_players || 0), 0);
  $("[data-stats]", el).textContent = parties.length
    ? `${plural(open, "partie ouverte", "parties ouvertes")} · ${plural(cities, "ville", "villes")} · ${plural(players, "joueur inscrit", "joueurs inscrits")}`
    : "Aucune partie pour l'instant : lancez la première !";
}

/* ---------- Joueurs près de chez vous ----------
   Les recherches du projet : trouver des joueurs proches, selon le niveau
   et les formats, est le besoin n°1. On trie par distance quand on la connaît. */
async function renderPlayers(el, me) {
  let users = [];
  try { users = await db.profiles.list({ limit: 24 }); } catch { return; }
  if (!el.isConnected) return;
  users = users.filter((u) => u.id !== me?.id);
  if (!users.length) return;

  const here = me?.city_lat ? { lat: me.city_lat, lng: me.city_lng } : null;
  const withKm = users.map((u) => ({ u, km: here && u.city_lat ? distanceKm(here.lat, here.lng, u.city_lat, u.city_lng) : null }));
  withKm.sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9));

  const sec = $("[data-players]", el);
  sec.hidden = false;
  mount(sec, html`
    <div class="section-head">
      <div><h2 id="players-title">Joueurs ${here ? "près de chez vous" : "de la communauté"}</h2></div>
      <span class="filters__count">${plural(users.length, "joueur", "joueurs")}</span>
    </div>
    <div class="players">
      ${withKm.map(({ u, km }) => html`
        <a class="player" href="#/profil/${u.id}">
          ${sigil(u)}
          <span class="player__body">
            <span class="player__name" title="${u.full_name}">${u.full_name}</span>
            <span class="player__meta">${levelPip(u.skill_level || "Casual")} ${u.skill_level || "Casual"}${u.city ? ` · ${u.city}` : ""}${km != null ? ` · ${km < 1 ? "<1" : Math.round(km)} km` : ""}</span>
            ${(u.favorite_formats || []).length ? html`<span class="player__formats">${u.favorite_formats.slice(0, 2).join(" · ")}</span>` : ""}
          </span>
        </a>`)}
    </div>`);
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

  $("[data-count]", el).textContent = plural(list.length, "partie", "parties");

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

async function renderFriends(el, me) {
  if (!me) return;
  try {
    const fs = (await db.friendships.forUser(me.id)).filter((f) => f.status === "accepted");
    if (!fs.length || !el.isConnected) return;
    const ids = fs.map((f) => (f.requester_id === me.id ? f.receiver_id : f.requester_id));
    const profiles = await db.profiles.many(ids);
    const sec = $("[data-friends]", el);
    sec.hidden = false;
    mount(sec, html`
      <div class="section-head"><div><h2 id="friends-title">Compagnons d'armes</h2></div></div>
      <div class="friends-strip">
        ${profiles.map((u) => html`<a class="friend-chip" href="#/profil/${u.id}" title="${u.full_name}">${sigil(u, "lg")}<span>${u.full_name}</span></a>`)}
      </div>`);
  } catch { /* section facultative */ }
}

/* ---------- Le d20 : le hasard choisit une table ---------- */
function rollD20(btn, parties) {
  const open = parties.filter((p) => p.current_players < p.max_players);
  if (!open.length) {
    toast("Le dé roule dans le vide…", "Aucune partie ouverte pour l'instant. Organisez la vôtre !");
    return;
  }
  const n = 1 + Math.floor(Math.random() * 20);
  const pick = open[Math.floor(Math.random() * open.length)];
  btn.classList.remove("is-rolling");
  void btn.offsetWidth; // relance l'animation
  btn.classList.add("is-rolling");
  btn.disabled = true;
  setTimeout(() => {
    btn.disabled = false;
    const crit = n === 20 ? "Coup critique ! " : n === 1 ? "Échec critique… mais " : "";
    toast.success(`Le d20 indique ${n}`, `${crit}le destin vous envoie à « ${pick.title} ».`);
    location.hash = `#/partie/${pick.id}`;
  }, prefersReducedMotion() ? 0 : 720);
}

/* ---------- Inclinaison 3D de la carte de l'Oracle (souris uniquement) ---------- */
function oracleTilt(card) {
  if (!card || !canHover() || prefersReducedMotion()) return () => {};
  const wrap = card.parentElement;
  const foil = card.querySelector(".tcard__foil");
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;

  const tick = () => {
    // interpolation douce (effet ressort amorti)
    cx += (tx - cx) * 0.12;
    cy += (ty - cy) * 0.12;
    card.style.transform = `rotateX(${cy.toFixed(2)}deg) rotateY(${cx.toFixed(2)}deg)`;
    // le reflet est piloté sur son propre calque, pas sur la carte (pas de recalcul en cascade)
    foil?.style.setProperty("--mx", `${50 + cx * 4}%`);
    foil?.style.setProperty("--my", `${50 - cy * 4}%`);
    if (Math.abs(tx - cx) > 0.01 || Math.abs(ty - cy) > 0.01) raf = requestAnimationFrame(tick);
    else raf = 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  const move = (e) => {
    const r = wrap.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 14;
    ty = -((e.clientY - r.top) / r.height - 0.5) * 14;
    kick();
  };
  const leave = () => { tx = 0; ty = 0; kick(); };
  wrap.addEventListener("pointermove", move, { passive: true });
  wrap.addEventListener("pointerleave", leave);
  return () => { cancelAnimationFrame(raf); wrap.removeEventListener("pointermove", move); wrap.removeEventListener("pointerleave", leave); };
}
