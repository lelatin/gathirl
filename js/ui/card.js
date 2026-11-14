/* =====================================================================
   Carte de partie façon couverture de module d'aventure de JDR (années 80).
   - Bandeau : code du module, « Module d'aventure », niveau
   - Titre + « par » (organisateur·rice) comme un nom d'auteur
   - Illustration encadrée (format large : carte peu haute)
   - Pied : « Pour N aventuriers », date, lieu, sièges pris / places
   - Tampon « Complet » quand la table est pleine
   ===================================================================== */
import { html, icon } from "../lib/dom.js?v=202611141827";
import { artFor, fmtDate, fmtTime, frameClass, fmtCountdown, hash } from "../lib/format.js?v=202611141827";

/* Niveau → mention de couverture (« pour personnages de niveau… ») */
const LEVEL_LINE = { "Débutant": "aventuriers débutants", "Casual": "aventuriers de tous niveaux", "Compétitif": "aventuriers aguerris" };

export function partieCard(p, { participants = [], index = 0, distance = null } = {}) {
  const full = p.current_players >= p.max_players;
  const when = new Date(p.date);
  const place = `${p.city}${p.location ? ` · ${p.location}` : ""}`;
  const km = distance != null ? ` · ${distance < 1 ? "<1" : Math.round(distance)} km` : "";
  const code = `${(p.format || "M").charAt(0).toUpperCase()}${(hash(p.id) % 9) + 1}`;   // ex. « C4 »
  const names = participants.map((x) => x.user_name || "Joueur").filter((n) => n !== p.host_name);

  // Les textes tronqués portent un title : la valeur complète reste lisible au survol
  return html`
    <article class="module ${frameClass(p.format)} ${full ? "is-full" : ""}" style="--i:${index}">
      <a class="module__link" href="#/partie/${p.id}" aria-label="${p.title}, ${p.format}, ${fmtDate(p.date)} à ${fmtTime(p.date)}, ${p.city}">
        <header class="module__band">
          <span class="module__code" aria-hidden="true">${code}</span>
          <span class="module__series"><span>Module d'aventure</span><b>${p.format}</b></span>
          <span class="module__when">${full ? "Complet" : fmtCountdown(when)}</span>
        </header>

        <h3 class="module__title" title="${p.title}">${p.title}</h3>
        <p class="module__byline" title="${names.length ? `Avec ${names.join(", ")}` : ""}">par ${p.host_name || "un·e aventurier·e"}</p>

        <div class="module__art print">
          <img src="${artFor(p.id)}" alt="" loading="lazy" decoding="async" width="720" height="540" />
          <span class="module__ribbon" aria-hidden="true">Une partie dont <b>vous</b> êtes le héros !</span>
          ${full ? html`<span class="module__stamp">Complet</span>` : ""}
        </div>

        <footer class="module__foot">
          <div class="module__info">
            <p class="module__for">Pour ${p.max_players} ${LEVEL_LINE[p.level] || "aventuriers"}</p>
            <p>${icon("calendar")}<span class="tnum">${fmtDate(p.date)} · ${fmtTime(p.date)}</span></p>
            <p>${icon("pin")}<span title="${place}">${place}${km}</span></p>
          </div>
          <span class="module__seats tnum" aria-label="${p.current_players} joueurs sur ${p.max_players}">
            <b>${p.current_players}/${p.max_players}</b><small>places</small>
          </span>
        </footer>
      </a>
    </article>`;
}

export function skeletonCards(n = 3) {
  return html`${Array.from({ length: n }, () => html`<div class="skeleton" style="aspect-ratio:5/6"></div>`)}`;
}

/** Reflet "foil" qui suit la souris (décoratif, souris uniquement).
 *  On écrit sur .tcard__foil (aucun enfant) et non sur la carte : changer une
 *  variable CSS sur un parent recalcule le style de tous ses descendants. */
export function enableFoil(root) {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return () => {};
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  let raf = 0, last = null;
  const apply = () => {
    raf = 0;
    const { card, x, y } = last;
    const foil = card.querySelector(".tcard__foil");
    if (!foil) return;
    const r = card.getBoundingClientRect();
    foil.style.setProperty("--mx", `${((x - r.left) / r.width) * 100}%`);
    foil.style.setProperty("--my", `${((y - r.top) / r.height) * 100}%`);
  };
  const onMove = (e) => {
    const card = e.target.closest(".tcard");
    if (!card) return;
    last = { card, x: e.clientX, y: e.clientY };
    if (!raf) raf = requestAnimationFrame(apply);   // au plus une écriture par image
  };
  root.addEventListener("pointermove", onMove, { passive: true });
  return () => { cancelAnimationFrame(raf); root.removeEventListener("pointermove", onMove); };
}
