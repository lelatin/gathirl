/* =====================================================================
   LA TAVERNE — accueil
   Héros + carte de l'Oracle · Grille bento (design system « Gathirl Bento »)
   · Compagnons · Tableau des quêtes (filtres)
   ===================================================================== */
import { $, $$, html, icon, mount, canHover, prefersReducedMotion } from "../lib/dom.js";
import { FORMATS, LEVELS, artFor, fmtDate, fmtTime, levelPip, plural, sigil } from "../lib/format.js";
import { distanceKm } from "../lib/geo.js";
import { db } from "../data/index.js";
import { CONFIG } from "../config.js";
import { partieCard, skeletonCards, enableFoil } from "../ui/card.js";
import { openCreatePartie } from "../ui/forms.js";
import { toast } from "../ui/toast.js";

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
              </div>
            </div>
            <span class="tcard__pt">∞/∞</span>
            <span class="tcard__foil" aria-hidden="true"></span>
          </article>
        </div>
      </div>
    </section>

    <section class="section wrap" aria-label="La taverne en un coup d'œil">
      <div class="bento" data-bento>${bento([], me)}</div>
    </section>

    <section class="section wrap" data-friends hidden aria-labelledby="friends-title"></section>

    <section class="section wrap" id="quetes" aria-labelledby="quetes-title">
      <div class="section-head">
        <div><h2 id="quetes-title">Le tableau des quêtes</h2></div>
        <span class="filters__count" data-count></span>
      </div>
      <div class="filters" data-filters></div>
      <div class="card-grid stagger" data-grid>${skeletonCards(3)}</div>
    </section>
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

  mount($("[data-bento]", el), bento(parties, me));
  renderFilters(el, me);
  renderGrid(el, parties, byPartie, me);
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

  // le d20 (bouton du héros et carte bento) et les cartes de format (filtre du tableau)
  el.addEventListener("click", (e) => {
    const roll = e.target.closest("[data-roll]");
    if (roll) { rollD20(roll, parties); return; }
    const cat = e.target.closest("[data-cat]");
    if (cat) {
      state.format = cat.dataset.cat;
      renderFilters(el, me);
      renderGrid(el, parties, byPartie, me, { animate: false });
      $("#quetes", el)?.scrollIntoView({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
  });

  if (ctx.query.get("organiser")) openCreatePartie();
  if (ctx.path === "/parties") requestAnimationFrame(() => $("#quetes", el)?.scrollIntoView({ block: "start" }));

  return () => { offFoil(); offTilt(); };
}

/* ===================================================================== */

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

  $("[data-count]", el).textContent = plural(list.length, "quête affichée", "quêtes affichées");

  const grid = $("[data-grid]", el);
  if (!list.length) {
    grid.classList.remove("card-grid");
    mount(grid, html`
      <div class="empty">
        <svg class="empty__icon"><use href="#i-d20"/></svg>
        <h3>${parties.length ? "Aucune quête ne correspond" : "Aucune partie à venir pour le moment."}</h3>
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

/* ---------- Grille bento de l'accueil (design system « Gathirl Bento ») ----------
   Chaque carte vient des vraies données : aucun chiffre décoratif. */

/* Teinte d'un format : les 4 couleurs du mot « Magic » */
const TINT = {
  Commander: "or", Standard: "or",
  Pioneer: "braise", Vintage: "braise", Sealed: "braise",
  Draft: "rouge", Pauper: "rouge",
  Modern: "violet", Legacy: "violet", Cube: "violet",
};
const tintOf = (f) => TINT[f] || "or";

/* Moments de la journée (barres du graphique) */
const MOMENTS = [
  { label: "Matin", test: (h) => h < 12 },
  { label: "Après-midi", test: (h) => h >= 12 && h < 18 },
  { label: "Soir", test: (h) => h >= 18 },
];

function bento(parties, me) {
  const open = parties.filter((p) => p.current_players < p.max_players);
  const cities = new Set(parties.map((p) => p.city?.trim().toLowerCase()).filter(Boolean));
  const players = parties.reduce((s, p) => s + (p.current_players || 0), 0);
  const word = (n, one, other) => plural(n, one, other).replace(/^\d+\s/, "");

  /* graphique : nombre de parties par moment de la journée */
  const counts = MOMENTS.map((m) => parties.filter((p) => m.test(new Date(p.date).getHours())).length);
  const max = Math.max(1, ...counts);
  const top = counts.indexOf(Math.max(...counts));

  /* catégories : les deux formats qui ont le plus de tables */
  const byFormat = {};
  for (const p of parties) (byFormat[p.format] ||= []).push(p);
  const cats = Object.entries(byFormat).sort((a, b) => b[1].length - a[1].length).slice(0, 2);
  // aucune cellule vide : sans assez de tables, on propose d'en dresser une
  for (const f of ["Commander", "Draft", "Modern"]) if (cats.length < 2 && !byFormat[f]) cats.push([f, []]);

  return html`
    <a class="bcard b-go" href="#/parties">
      <span class="b-go__art" aria-hidden="true"><img src="assets/img/art-14.webp" alt="" width="720" height="540" decoding="async" /></span>
      <span class="bcard__eyebrow">La taverne · tableau des quêtes</span>
      <span class="b-go__tagline">Une table vous attend. <span>Rejoignez-la ou dressez la vôtre.</span></span>
      <span class="bcard__label">${parties.length
        ? html`<strong>${plural(open.length, "partie ouverte", "parties ouvertes")}</strong> dans ${plural(cities.size, "ville", "villes")}`
        : "Aucune partie à venir pour l'instant"}</span>
      <span class="bcard__go">Voir les quêtes ${icon("arrow")}<kbd class="bcard__kbd" title="Raccourci clavier : 2">2</kbd></span>
    </a>

    <div class="bcard b-stat1 is-or">
      <span class="bcard__num tnum">${parties.length}</span>
      <span class="bcard__label">${word(parties.length, "partie", "parties")} <strong>à venir</strong></span>
    </div>
    <div class="bcard b-stat2 is-violet">
      <span class="bcard__num tnum">${players}</span>
      <span class="bcard__label">${word(players, "aventurier·e", "aventurier·es")} <strong>${word(players, "inscrit·e", "inscrit·es")}</strong></span>
    </div>

    <button type="button" class="bcard b-d20" data-roll title="Le dé choisit une partie ouverte au hasard">
      <span class="b-d20__label">Lancer le d20<br />Le hasard choisit une table</span>
      <span class="b-d20__row"><span class="b-d20__num" data-d20-num>20</span>${icon("d20", "d20")}</span>
    </button>

    <div class="bcard b-chart">
      <div class="b-chart__head">
        <span class="bcard__eyebrow">Parties par moment</span>
        ${parties.length ? html`<span class="b-chart__badge">${MOMENTS[top].label}</span>` : ""}
      </div>
      <div class="bars" role="img" aria-label="${MOMENTS.map((m, i) => `${m.label} : ${counts[i]}`).join(", ")}">
        ${MOMENTS.map((m, i) => html`
          <span class="bar"><span class="bar__val">${counts[i]}</span><span class="bar__fill" style="--h:${(counts[i] / max).toFixed(3)}"></span><span class="bar__lbl">${m.label}</span></span>`)}
      </div>
      <span class="bcard__label">${parties.length
        ? html`Le <strong>${MOMENTS[top].label.toLowerCase()}</strong> est le moment le plus demandé.`
        : "Les tables apparaîtront ici dès la première partie."}</span>
    </div>

    ${ACTIONS.map(actionCard)}

    ${cats.map(([f, list], i) => catCard(f, list, i))}

    <div class="bcard b-quote">
      <p class="b-quote__text">Une partie dont <em>vous</em> êtes le héros.</p>
      <p class="b-quote__by">Gathirl · le grimoire des rencontres</p>
    </div>`;
}

function catCard(format, list, i) {
  const tint = tintOf(format);
  const free = list.reduce((s, p) => s + Math.max(0, p.max_players - p.current_players), 0);
  const levels = [...new Set(list.map((p) => p.level))].slice(0, 1);
  const cities = [...new Set(list.map((p) => p.city).filter(Boolean))].slice(0, 1);
  const cls = `bcard b-cat b-cat${i + 1} is-${tint}`;
  if (!list.length) {
    return html`
      <button type="button" class="${cls}" data-action="create-partie">
        <span class="b-cat__name">${format}</span>
        <span class="b-cat__focus">Aucune table</span>
        <span class="bpills"><span class="bpill bpill--accent">Dresser la première</span></span>
      </button>`;
  }
  return html`
    <button type="button" class="${cls}" data-cat="${format}" title="Afficher les parties ${format}">
      <span class="b-cat__name">${format}</span>
      <span class="b-cat__focus">${plural(list.length, "table ouverte", "tables ouvertes")}</span>
      <span class="bpills">
        ${levels.map((l) => html`<span class="bpill">${l}</span>`)}
        ${cities.map((c) => html`<span class="bpill">${c}</span>`)}
        <span class="bpill ${free ? "bpill--accent" : ""}">${free ? plural(free, "place libre", "places libres") : "Complet"}</span>
      </span>
    </button>`;
}

/* ---------- Les 3 cartes d'action (la 4e, « Rejoindre », est la carte Hero) ---------- */
const ACTIONS = [
  { title: "Dresser votre table", action: "create-partie", art: "assets/img/art-13.webp", area: "b-new",
    text: "Un format, un lieu, une date : les joueurs viendront à vous.", go: "Organiser", key: "N" },
  { title: "Envoyer une missive", href: "#/messages", art: "assets/img/art-03.webp", area: "b-msg",
    text: "Calez la partie ou échangez des cartes avec les autres joueurs.", go: "Missives", key: "3" },
  { title: "Forger votre fiche", href: "#/profil", art: "assets/img/art-10.webp", area: "b-me",
    text: "Niveau, formats, ville : laissez les autres vous trouver.", go: "Ma fiche", key: "4" },
];

function actionCard(a) {
  const inner = html`
    <span class="b-act__art"><img src="${a.art}" alt="" loading="lazy" decoding="async" width="720" height="540" /></span>
    <span class="b-act__body">
      <span class="b-act__title">${a.title}</span>
      <span class="b-act__text">${a.text}</span>
      <span class="bcard__go">${a.go} ${icon("arrow")}<kbd class="bcard__kbd" title="Raccourci clavier : ${a.key}">${a.key}</kbd></span>
    </span>`;
  return a.href
    ? html`<a class="bcard b-act ${a.area}" href="${a.href}">${inner}</a>`
    : html`<button type="button" class="bcard b-act ${a.area}" data-action="${a.action}">${inner}</button>`;
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
  const face = btn.querySelector("[data-d20-num]");   // carte bento : le résultat s'affiche sur le dé
  if (face) face.textContent = n;
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
