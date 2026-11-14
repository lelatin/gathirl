/* =====================================================================
   Modale accessible basée sur <dialog> (focus piégé, Échap, retour
   du focus). Animation d'entrée via @starting-style (CSS).
   ===================================================================== */
import { create, html, icon } from "../lib/dom.js?v=202611141722";

export function openModal({ title, body, onMount, label, instant = false }) {
  const root = document.getElementById("modal-root");
  const opener = document.activeElement;

  const dlg = create(html`
    <dialog class="modal ${instant ? "modal--instant" : ""}" aria-label="${label || title}">
      <header class="modal__head">
        <h2>${title}</h2>
        <button type="button" class="btn btn--ghost btn--sm btn--icon" data-close aria-label="Fermer">${icon("x")}</button>
      </header>
      <div class="modal__body">${body}</div>
    </dialog>`);
  root.append(dlg);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    dlg.classList.add("is-closing");
    const done = () => { dlg.close(); dlg.remove(); opener?.focus?.({ preventScroll: true }); };
    // Mouvement réduit : pas d'attente
    if (instant || window.matchMedia("(prefers-reduced-motion: reduce)").matches) done();
    else setTimeout(done, 220);
  };

  dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
  dlg.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) close();
    // clic sur le fond (hors de la boîte)
    if (e.target === dlg) {
      const r = dlg.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) close();
    }
  });

  dlg.showModal();
  onMount?.(dlg, close);
  return { el: dlg, close };
}
