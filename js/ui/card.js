/* =====================================================================
   Carte de partie façon jaquette de cassette VHS des années 80.
   - Tranche verticale : logo VHS, titre, numéro de cassette
   - Jaquette : illustration, logo VHS, case de classification (= niveau),
     autocollant de vidéoclub (compte à rebours / « Complet »)
   - Bandes de couleur rétro (teinte du format)
   - Titre chromé, infos de la séance, compteur de magnétoscope (joueurs)
   ===================================================================== */
import { html, icon } from "../lib/dom.js";
import { artFor, fmtDate, fmtTime, frameClass, fmtCountdown, hash } from "../lib/format.js";

/* Niveau → case de classification façon visa d'exploitation */
const RATING = { "Débutant": "DÉB", "Casual": "CAS", "Compétitif": "CMP" };

export function partieCard(p, { participants = [], index = 0, distance = null } = {}) {
  const full = p.current_players >= p.max_players;
  const names = participants.map((x) => x.user_name || "Joueur").filter((n) => n !== p.host_name);
  const when = new Date(p.date);
  const place = `${p.city}${p.location ? ` · ${p.location}` : ""}`;
  const km = distance != null ? ` · ${distance < 1 ? "<1" : Math.round(distance)} km` : "";
  const pad = (n) => String(n).padStart(2, "0");
  const tapeNo = String(hash(p.id) % 900 + 100);   // n° de cassette du vidéoclub

  // Les textes tronqués portent un title : la valeur complète reste lisible au survol
  return html`
    <article class="vhs ${frameClass(p.format)} ${full ? "is-full" : ""}" style="--i:${index}">
      <a class="vhs__link" href="#/partie/${p.id}" aria-label="${p.title} — ${p.format}, ${fmtDate(p.date)} à ${fmtTime(p.date)}, ${p.city}">
        <div class="vhs__spine" aria-hidden="true">
          <span class="vhs__spine-logo">VHS</span>
          <span class="vhs__spine-title">${p.title}</span>
          <span class="vhs__spine-no">${tapeNo}</span>
        </div>

        <div class="vhs__cover">
          <div class="vhs__art print">
            <img src="${artFor(p.id)}" alt="" loading="lazy" decoding="async" width="720" height="540" />
            <span class="vhs__logo" aria-hidden="true">VHS</span>
            <span class="vhs__rating" title="Niveau : ${p.level}">${RATING[p.level] || "CAS"}</span>
            ${full
              ? html`<span class="vhs__sticker vhs__sticker--full">Complet</span>`
              : html`<span class="vhs__sticker">${fmtCountdown(when)}</span>`}
          </div>

          <div class="vhs__stripes" aria-hidden="true"><i></i><i></i><i></i><i></i></div>

          <div class="vhs__body">
            <p class="vhs__format">${p.format} · ${p.level}</p>
            <h3 class="vhs__title" title="${p.title}">${p.title}</h3>
            <ul class="vhs__meta" role="list">
              <li>${icon("calendar")}<span class="tnum">${fmtDate(p.date)} · ${fmtTime(p.date)}</span></li>
              <li>${icon("pin")}<span title="${place}">${place}${km}</span></li>
              <li>${icon("crown")}<span title="${p.host_name || ""}">par ${p.host_name || "un·e aventurier·e"}</span></li>
            </ul>
            ${names.length ? html`<p class="vhs__cast" title="${names.join(" · ")}">Avec ${names.join(" · ")}</p>` : html`<p class="vhs__cast">Une place à la table vous attend.</p>`}

            <div class="vhs__footer">
              <span class="vhs__fine" aria-hidden="true">HI-FI · STÉRÉO · SP</span>
              <span class="vhs__counter tnum" aria-label="${p.current_players} joueurs sur ${p.max_players}">
                <span class="vhs__play" aria-hidden="true">▶</span>${pad(p.current_players)}/${pad(p.max_players)}
              </span>
            </div>
          </div>
        </div>
      </a>
      <span class="tcard__foil" aria-hidden="true"></span>
    </article>`;
}

export function skeletonCards(n = 3) {
  return html`${Array.from({ length: n }, () => html`<div class="skeleton" style="aspect-ratio:5/7"></div>`)}`;
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
    const card = e.target.closest(".tcard, .vhs");
    if (!card) return;
    last = { card, x: e.clientX, y: e.clientY };
    if (!raf) raf = requestAnimationFrame(apply);   // au plus une écriture par image
  };
  root.addEventListener("pointermove", onMove, { passive: true });
  return () => { cancelAnimationFrame(raf); root.removeEventListener("pointermove", onMove); };
}
