/* =====================================================================
   LA TAVERNE — accueil
   Héros + carte de l'Oracle · Choisissez votre voie · Près de chez vous
   · Compagnons · Tableau des quêtes (filtres)
   ===================================================================== */
import { $, $$, html, icon, mount, canHover, prefersReducedMotion, revealOnScroll } from "../lib/dom.js";
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
        <div>
          <p class="kicker hero__kicker">Chapitre I · La Taverne</p>
          <h1 class="hero__title">Trouvez votre prochaine partie de <span class="chrome">Magic</span></h1>
          <p class="hero__lede">Découvrez des joueurs près de chez vous, rejoignez une table ou organisez la vôtre — <em>Commander, Modern, Draft</em> et plus encore.</p>
          <div class="hero__ctas">
            <button type="button" class="btn btn--primary" data-action="create-partie">${icon("plus")} Organiser une partie</button>
            <a class="btn" href="#/parties">${icon("swords")} Voir les parties</a>
            <button type="button" class="btn btn--ghost" data-roll title="Le dé choisit une partie au hasard">${icon("d20", "d20")} Lancer le d20</button>
          </div>
          <div class="hero__stats" data-stats aria-live="polite">
            <span><strong class="tnum">–</strong>parties à venir</span>
            <span><strong class="tnum">–</strong>villes</span>
            <span><strong class="tnum">–</strong>aventurier·es inscrit·es</span>
          </div>
        </div>

        <div class="oracle-wrap">
          <article class="tcard oracle" data-oracle aria-label="L'Oracle du Gathirl">
            <div class="tcard__inner">
              <header class="tcard__name"><h3>L'Oracle du Gathirl</h3>
                <span class="pips"><span class="pip pip--b">${icon("skull")}</span><span class="pip pip--r">${icon("flame")}</span></span>
              </header>
              <div class="tcard__art print"><img src="assets/img/oracle.webp" alt="Une silhouette encapuchonnée tenant un bâton, sur un pont de pierre face à un portail runique et un vortex écarlate." width="720" height="960" fetchpriority="high" /></div>
              <div class="tcard__type"><span>Créature légendaire — Gardien·ne</span>${icon("crown", "tcard__set")}</div>
              <div class="tcard__text">
                <p style="font-size:14.5px">Au début de chaque semaine, révélez les tables ouvertes près de chez vous.</p>
                <p class="tcard__flavor">« Vous n'êtes pas seul. Aventurez-vous. »</p>
              </div>
            </div>
            <span class="tcard__pt">∞/∞</span>
          </article>
        </div>
      </div>
    </section>

    <section class="section wrap reveal" aria-labelledby="voies-title">
      <div class="section-head">
        <div><span class="kicker">Rendez-vous au paragraphe de votre choix</span><h2 id="voies-title">Choisissez votre voie</h2></div>
        <span class="mono muted" style="font-size:12px;letter-spacing:.08em">CLAVIER : 1 – 4 · N</span>
      </div>
      <div class="paths">
        <a class="path" href="#/parties">
          <span class="path__no">§ 1 <kbd class="path__key">2</kbd></span>
          <h3>Rejoindre une table</h3>
          <p>Parcourez le tableau des quêtes et prenez place à une partie ouverte.</p>
          <span class="path__go">Consulter les quêtes ${icon("arrow")}</span>
        </a>
        <button type="button" class="path" data-action="create-partie" style="text-align:left">
          <span class="path__no">§ 2 <kbd class="path__key">N</kbd></span>
          <h3>Dresser votre table</h3>
          <p>Choisissez un format, un lieu, une date : les joueurs viendront à vous.</p>
          <span class="path__go">Organiser une partie ${icon("arrow")}</span>
        </button>
        <a class="path" href="#/messages">
          <span class="path__no">§ 3 <kbd class="path__key">3</kbd></span>
          <h3>Envoyer une missive</h3>
          <p>Discutez avec les autres joueurs pour caler la partie ou échanger des cartes.</p>
          <span class="path__go">Ouvrir la messagerie ${icon("arrow")}</span>
        </a>
        <a class="path" href="#/profil">
          <span class="path__no">§ 4 <kbd class="path__key">4</kbd></span>
          <h3>Forger votre fiche</h3>
          <p>Niveau, formats préférés, ville : laissez les autres vous trouver.</p>
          <span class="path__go">Voir ma fiche ${icon("arrow")}</span>
        </a>
      </div>
    </section>

    <section class="section wrap" data-poster hidden aria-label="L'arcane de la semaine"></section>

    <section class="section wrap" data-near hidden aria-labelledby="near-title"></section>
    <section class="section wrap" data-friends hidden aria-labelledby="friends-title"></section>

    ${interlude()}

    <section class="section wrap" id="quetes" aria-labelledby="quetes-title">
      <div class="section-head">
        <div><span class="kicker">Fil d'actualité</span><h2 id="quetes-title">Le tableau des quêtes</h2></div>
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

  renderStats(el, parties);
  renderFilters(el, me);
  renderGrid(el, parties, byPartie, me);
  renderPoster(el, parties);
  renderNear(el, parties, byPartie, me);
  renderFriends(el, me);

  /* ---------- Interactions ---------- */
  const offFoil = enableFoil(el);
  const offTilt = oracleTilt($("[data-oracle]", el));
  const offReveal = revealOnScroll(el);

  $("[data-filters]", el).addEventListener("click", (e) => {
    const b = e.target.closest("[data-f]");
    if (!b) return;
    const { f, v } = b.dataset;
    if (f === "near") state.near = !state.near;
    else state[f] = state[f] === v || v === "" ? null : v;
    renderFilters(el, me);
    renderGrid(el, parties, byPartie, me);
  });

  $("[data-roll]", el).addEventListener("click", (e) => rollD20(e.currentTarget, parties));

  if (ctx.query.get("organiser")) openCreatePartie();
  if (ctx.path === "/parties") requestAnimationFrame(() => $("#quetes", el)?.scrollIntoView({ block: "start" }));

  return () => { offFoil(); offTilt(); offReveal(); };
}

/* ===================================================================== */

function renderStats(el, parties) {
  const cities = new Set(parties.map((p) => p.city?.trim().toLowerCase()).filter(Boolean));
  const players = parties.reduce((s, p) => s + (p.current_players || 0), 0);
  const vals = [parties.length, cities.size, players];
  $$("[data-stats] strong", el).forEach((s, i) => { s.textContent = vals[i]; });
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

function renderGrid(el, parties, byPartie, me) {
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
  mount(grid, html`${list.map((p, i) => partieCard(p, { participants: byPartie[p.id] || [], index: Math.min(i, 8), distance: coords && p.location_lat ? distanceKm(coords.lat, coords.lng, p.location_lat, p.location_lng) : null }))}`);
}

function renderNear(el, parties, byPartie, me) {
  const sec = $("[data-near]", el);
  if (!me?.city_lat) return;
  const near = parties
    .map((p) => ({ p, d: p.location_lat ? distanceKm(me.city_lat, me.city_lng, p.location_lat, p.location_lng) : Infinity }))
    .filter((x) => x.d <= CONFIG.NEARBY_RADIUS_KM)
    .slice(0, 3);
  if (!near.length) return;
  sec.hidden = false;
  mount(sec, html`
    <div class="section-head">
      <div><span class="kicker">${icon("pin")} Autour de ${me.city}</span><h2 id="near-title">Près de chez vous</h2></div>
    </div>
    <div class="card-grid stagger">${near.map(({ p, d }, i) => partieCard(p, { participants: byPartie[p.id] || [], index: i, distance: d }))}</div>`);
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
      <div class="section-head"><div><span class="kicker">Votre groupe</span><h2 id="friends-title">Compagnons d'armes</h2></div></div>
      <div class="friends-strip">
        ${profiles.map((u) => html`<a class="friend-chip" href="#/profil/${u.id}">${sigil(u, "lg")}<span>${u.full_name}</span></a>`)}
      </div>`);
  } catch { /* section facultative */ }
}

/* ---------- L'arcane de la semaine : affiche façon tarot / roman de poche ---------- */
const ROMAN = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"];

function renderPoster(el, parties) {
  const p = parties.find((x) => x.current_players < x.max_players);
  if (!p) return;
  const sec = $("[data-poster]", el);
  const left = p.max_players - p.current_players;
  const arcana = ROMAN[new Date(p.date).getDate() % ROMAN.length];
  sec.hidden = false;
  mount(sec, html`
    <article class="poster">
      <a class="poster__arch" href="#/partie/${p.id}" tabindex="-1" aria-hidden="true">
        <img src="${artFor(p.id)}" alt="" loading="lazy" width="720" height="540" />
        <span class="poster__num">${arcana}</span>
      </a>
      <div class="poster__body">
        <p class="kicker">Arcane ${arcana} · La quête à ne pas manquer</p>
        <h2 class="poster__title"><a href="#/partie/${p.id}">${p.title}</a></h2>
        <p class="poster__blurb">${p.description ? p.description.split("\n")[0] : "Une table vous attend. Les dés sont prêts, les decks mélangés ; il ne manque que vous."}</p>
        <dl class="poster__facts">
          <div><dt>Format</dt><dd>${p.format}</dd></div>
          <div><dt>Quand</dt><dd class="tnum">${fmtDate(p.date)} · ${fmtTime(p.date)}</dd></div>
          <div><dt>Où</dt><dd>${p.city}${p.location ? ` · ${p.location}` : ""}</dd></div>
          <div><dt>Places</dt><dd class="tnum">${plural(left, "siège libre", "sièges libres")}</dd></div>
        </dl>
        <a class="btn btn--primary" href="#/partie/${p.id}">${icon("swords")} Prendre place</a>
      </div>
    </article>`);
}

/* ---------- Interlude : château sur son piton, dragon, soleil couchant ---------- */
function interlude() {
  return html`
    <section class="interlude" aria-label="Interlude">
      <svg class="interlude__scene" viewBox="0 0 1200 420" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#3a0f12"/><stop offset=".35" stop-color="#9e2f17"/><stop offset=".7" stop-color="#e2552c"/><stop offset="1" stop-color="#f39a4a"/>
          </linearGradient>
          <pattern id="dots" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.1" fill="#000" opacity=".35"/></pattern>
        </defs>
        <rect width="1200" height="420" fill="url(#sky)"/>
        <circle cx="830" cy="250" r="150" fill="#f3e6c9" opacity=".92"/>
        <circle cx="830" cy="250" r="150" fill="url(#dots)"/>
        <rect width="1200" height="420" fill="url(#dots)" opacity=".45"/>
        <!-- montagnes lointaines -->
        <path d="M0 330 L120 280 L210 305 L330 240 L430 290 L520 260 L600 300 L700 270 L780 310 L900 280 L1010 320 L1100 290 L1200 310 V420 H0Z" fill="#5a1a10" opacity=".85"/>
        <!-- piton rocheux + château -->
        <g fill="#0e0a13">
          <path d="M560 420 L600 360 L640 330 L690 300 L720 250 L760 240 L800 250 L840 300 L880 330 L930 380 L960 420Z"/>
          <path d="M0 420 V370 Q160 340 300 360 Q420 330 520 380 L560 420Z M960 420 L1040 370 Q1120 350 1200 360 V420Z"/>
          <rect x="722" y="190" width="96" height="60"/>
          <path d="M722 190 h10 v-10 h10 v10 h12 v-10 h10 v10 h12 v-10 h10 v10 h12 v-10 h10 v10 h10 v6 h-96z"/>
          <rect x="730" y="140" width="22" height="60"/><path d="M726 140 L741 96 L756 140Z"/>
          <rect x="758" y="100" width="28" height="100"/><path d="M753 100 L772 40 L791 100Z"/>
          <rect x="792" y="150" width="20" height="50"/><path d="M788 150 L802 112 L816 150Z"/>
          <path d="M772 40 v-14 l14 5 -14 5" />
          <!-- dragon -->
          <path d="M300 150 C318 138 334 134 350 138 L366 104 L376 132 L404 96 L410 134 L446 126 C428 144 404 152 380 154 L368 168 L356 158 C336 162 314 162 300 150Z M300 150 C284 146 268 150 252 166 C270 156 284 156 300 156Z"/>
          <!-- oiseaux -->
          <path d="M540 120 q8 -6 14 0 q6 -6 14 0 q-7 -3 -14 3 q-7 -6 -14 -3Z M590 150 q6 -5 11 0 q5 -5 11 0 q-6 -2 -11 2 q-5 -4 -11 -2Z"/>
        </g>
        <g fill="#f3c46b"><rect x="767" y="130" width="5" height="9"/><rect x="738" y="160" width="4" height="8"/><rect x="798" y="168" width="4" height="7"/></g>
      </svg>
      <div class="interlude__text wrap">
        <p class="kicker" style="color:var(--cream)">Chapitre II · Les terres du crépuscule</p>
        <p class="interlude__quote">Chaque table est un donjon.<br/>Chaque joueur, un allié.</p>
      </div>
    </section>`;
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
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;

  const tick = () => {
    // interpolation douce (effet ressort amorti)
    cx += (tx - cx) * 0.12;
    cy += (ty - cy) * 0.12;
    card.style.transform = `rotateX(${cy.toFixed(2)}deg) rotateY(${cx.toFixed(2)}deg)`;
    card.style.setProperty("--mx", `${50 + cx * 4}%`);
    card.style.setProperty("--my", `${50 - cy * 4}%`);
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
