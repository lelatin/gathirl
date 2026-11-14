/* =====================================================================
   ACCUEIL — l'essentiel, dans l'ordre où on en a besoin :
   1. Héros (titre, actions) + carte de l'Oracle (le « lore » de la taverne)
   2. Les joueurs près de chez vous
   Les parties ont leur propre page (js/views/parties.js).
   ===================================================================== */
import { $, $$, html, icon, mount, canHover, prefersReducedMotion } from "../lib/dom.js?v=202611141827";
import { levelPip, plural, sigil } from "../lib/format.js?v=202611141827";
import { distanceKm } from "../lib/geo.js?v=202611141827";
import { db } from "../data/index.js?v=202611141827";
import { enableFoil } from "../ui/card.js?v=202611141827";
import { openCreatePartie } from "../ui/forms.js?v=202611141827";
import { toast } from "../ui/toast.js?v=202611141827";

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
          <button type="button" class="hero__more" data-scroll-down aria-label="Voir la suite">${icon("back")}</button>
        </div>

        <div class="oracle-wrap">
          <article class="tcard oracle" data-oracle aria-label="L'Oracle du Gathirl">
            <div class="tcard__inner">
              <header class="tcard__name"><h3>L'Oracle du Gathirl</h3>
                <span class="pips"><span class="pip pip--b">${icon("skull")}</span><span class="pip pip--r">${icon("flame")}</span></span>
              </header>
              <div class="tcard__art print"><img src="assets/img/oracle-moine.jpg" loading="lazy" alt="Un moine encapuchonné tenant une torche, dans la fenêtre en arche gothique d'une tour crénelée, sous une lune rouge, en bichromie rouge et noire." width="720" height="891" /></div>
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

    <section class="section wrap" data-players hidden aria-labelledby="players-title"></section>
  `);

  renderPlayers(el, me);

  /* ---------- Interactions ---------- */
  const offFoil = enableFoil(el);
  const offTilt = oracleTilt($("[data-oracle]", el));

  // le d20 tire au sort parmi les parties ouvertes : on les lit au premier lancer
  $("[data-roll]", el).addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    let parties = [];
    try { parties = await db.parties.listUpcoming(); } catch (ex) { toast.error("Le grimoire est illisible", ex.message); return; }
    rollD20(btn, parties);
  });

  // la petite flèche sous les boutons : descend jusqu'à la carte de l'Oracle
  $("[data-scroll-down]", el).addEventListener("click", () => {
    $(".oracle-wrap", el)?.scrollIntoView({ behavior: prefersReducedMotion() ? "instant" : "smooth", block: "start" });
  });

  if (ctx.query.get("organiser")) openCreatePartie();

  return () => { offFoil(); offTilt(); };
}

/* ===================================================================== */

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
