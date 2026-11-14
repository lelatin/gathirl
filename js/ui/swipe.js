/* =====================================================================
   Glisser pour changer de page (comme Instagram), sur écran tactile.
   - le doigt va vers la gauche → page suivante ; vers la droite → précédente
   - la page suit le doigt, puis glisse hors de l'écran (ou revient en place)
   - ignoré : bords de l'écran (gestes « retour » du système), champs de
     saisie, fenêtres, et toute zone qui défile déjà horizontalement
   ===================================================================== */
import { prefersReducedMotion } from "../lib/dom.js?v=202611141757";

const EDGE = 22;          // px réservés aux gestes système, de chaque côté
const LOCK = 10;          // px avant de décider si le geste est horizontal ou vertical
const DISTANCE = 0.28;    // part de la largeur à parcourir pour valider
const FLICK = 0.45;       // ou vitesse (px/ms) d'un geste vif…
const FLICK_MIN = 40;     // …sur au moins cette distance

/**
 * @param {HTMLElement} root  conteneur des pages (#app)
 * @param {string[]} order    chemins des onglets, de gauche à droite
 * @param {() => string} current  chemin affiché
 * @param {(path: string, from: "left"|"right") => void} go  navigue, en précisant d'où entre la page
 */
export function enableSwipeNav(root, order, current, go) {
  let g = null;   // geste en cours

  const scrollsSideways = (el) => {
    for (; el && el !== root; el = el.parentElement) {
      if (el.scrollWidth > el.clientWidth + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowX)) return true;
    }
    return false;
  };

  root.addEventListener("touchstart", (e) => {
    g = null;
    if (e.touches.length !== 1) return;
    const idx = order.indexOf(current());
    if (idx < 0) return;
    const t = e.touches[0];
    if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return;
    if (e.target.closest("input, textarea, select, [contenteditable], dialog, [data-noswipe]")) return;
    if (scrollsSideways(e.target)) return;
    g = { idx, x: t.clientX, y: t.clientY, t: performance.now(), dx: 0, axis: null, view: root.firstElementChild, w: root.clientWidth || window.innerWidth };
  }, { passive: true });

  root.addEventListener("touchmove", (e) => {
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.axis) {
      if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
      g.axis = Math.abs(dx) > Math.abs(dy) * 1.3 ? "x" : "y";
      if (g.axis === "y") { g = null; return; }   // défilement vertical : on laisse faire
    }
    e.preventDefault();   // geste horizontal : la page ne défile plus verticalement
    g.dx = dx;
    if (prefersReducedMotion() || !g.view) return;
    const target = g.idx + (dx < 0 ? 1 : -1);
    const free = target >= 0 && target < order.length;
    const shift = free ? dx : dx * 0.2;   // premier/dernier onglet : résistance élastique
    g.view.style.transition = "none";
    g.view.style.transform = `translate3d(${shift}px, 0, 0)`;
  }, { passive: false });

  const end = () => {
    if (!g || g.axis !== "x") { g = null; return; }
    const { dx, idx, view, w, t } = g;
    g = null;
    const target = idx + (dx < 0 ? 1 : -1);
    const speed = Math.abs(dx) / Math.max(1, performance.now() - t);
    const valid = target >= 0 && target < order.length &&
      (Math.abs(dx) > w * DISTANCE || (speed > FLICK && Math.abs(dx) > FLICK_MIN));
    const still = prefersReducedMotion();

    if (!valid) {
      if (view && !still) {
        view.style.transition = "transform 220ms cubic-bezier(0.23, 1, 0.32, 1)";
        view.style.transform = "";
      }
      return;
    }
    const from = dx < 0 ? "right" : "left";   // la nouvelle page arrive du côté opposé au geste
    if (view && !still) {
      view.style.transition = "transform 140ms cubic-bezier(0.23, 1, 0.32, 1), opacity 140ms ease";
      view.style.transform = `translate3d(${dx < 0 ? -w * 0.45 : w * 0.45}px, 0, 0)`;
      view.style.opacity = "0";
      setTimeout(() => go(order[target], from), 110);
    } else {
      go(order[target], from);
    }
  };
  root.addEventListener("touchend", end);
  root.addEventListener("touchcancel", () => { if (g) g.dx = 0; end(); });   // geste interrompu : retour en place
}
