/* =====================================================================
   Carte de partie façon carte à collectionner.
   - Barre de nom : titre + coût de mana (= niveau)
   - Illustration
   - Ligne de type : "Partie — Format"
   - Boîte de texte : date, lieu, organisateur, inscrits
   - Boîte F/E : joueurs / max
   ===================================================================== */
import { html, icon } from "../lib/dom.js";
import { artFor, fmtDate, fmtTime, frameClass, manaCost, fmtCountdown } from "../lib/format.js";

export function partieCard(p, { participants = [], index = 0, distance = null } = {}) {
  const full = p.current_players >= p.max_players;
  const names = participants.map((x) => x.user_name || "Joueur").filter((n) => n !== p.host_name);
  const when = new Date(p.date);

  return html`
    <article class="tcard ${frameClass(p.format)} ${full ? "is-full" : ""}" style="--i:${index}" data-tilt>
      <a class="tcard__link" href="#/partie/${p.id}" aria-label="${p.title} — ${p.format}, ${fmtDate(p.date)} à ${fmtTime(p.date)}, ${p.city}">
        <div class="tcard__inner">
          <header class="tcard__name">
            <h3>${p.title}</h3>
            ${manaCost(p.level)}
          </header>
          <div class="tcard__art print">
            <img src="${artFor(p.id)}" alt="" loading="lazy" decoding="async" width="720" height="540" />
            <span class="tcard__badge">
              ${full ? html`<span class="tag tag--blood">Complet</span>` : html`<span class="tag" style="background:rgb(14 10 19 / .75)">${fmtCountdown(when)}</span>`}
            </span>
          </div>
          <div class="tcard__type">
            <span>Partie — ${p.format} · ${p.level}</span>
            ${icon("crown", "tcard__set")}
          </div>
          <div class="tcard__text">
            <p class="row">${icon("calendar")}<span class="tnum">${fmtDate(p.date)} · ${fmtTime(p.date)}</span></p>
            <p class="row">${icon("pin")}<span>${p.city}${p.location ? ` · ${p.location}` : ""}${distance != null ? ` · ${distance < 1 ? "<1" : Math.round(distance)} km` : ""}</span></p>
            <p class="row">${icon("crown")}<span>par ${p.host_name || "un·e aventurier·e"}</span></p>
            ${names.length ? html`<p class="tcard__flavor">Inscrits : ${names.join(" · ")}</p>` : html`<p class="tcard__flavor">« Une place à la table vous attend. »</p>`}
          </div>
        </div>
      </a>
      <span class="tcard__pt tnum" aria-hidden="true">${p.current_players}/${p.max_players}</span>
    </article>`;
}

export function skeletonCards(n = 3) {
  return html`${Array.from({ length: n }, () => html`<div class="skeleton" style="aspect-ratio:5/7"></div>`)}`;
}

/** Reflet "foil" qui suit la souris (décoratif, souris uniquement) */
export function enableFoil(root) {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return () => {};
  const onMove = (e) => {
    const card = e.target.closest(".tcard");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    card.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  root.addEventListener("pointermove", onMove, { passive: true });
  return () => root.removeEventListener("pointermove", onMove);
}
