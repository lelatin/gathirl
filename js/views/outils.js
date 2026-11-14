/* =====================================================================
   OUTILS — les outils pendant les parties (à venir : points de vie, dés…)
   Page vierge pour l'instant.
   ===================================================================== */
import { html, icon, mount } from "../lib/dom.js?v=202611141747";

export function render(el) {
  mount(el, html`
    <section class="wrap outils">
      <h1 class="outils__title">Outils</h1>
      <div class="ig-empty">
        ${icon("d20", "ig-empty__icon")}
        <p>Bientôt ici : les outils pour vos parties.</p>
      </div>
    </section>`);
}
