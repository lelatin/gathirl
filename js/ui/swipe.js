/* =====================================================================
   Glisser pour changer de page (comme Instagram), sur écran tactile.
   - le sens du geste indique où l'on veut aller : glisser vers la droite
     ouvre l'onglet de droite, glisser vers la gauche ouvre celui de gauche
   - pendant le geste, la page s'efface vers le côté opposé (on « avance »
     vers la page voisine), puis la nouvelle arrive du côté visé
   - ignoré : bords de l'écran (gestes « retour » du système), champs de
     saisie, fenêtres, et toute zone qui défile déjà horizontalement
   ===================================================================== */
import { prefersReducedMotion } from "../lib/dom.js?v=202611141802";

const EDGE = 16;          // px réservés aux gestes système, de chaque côté
const LOCK = 8;           // px avant de décider si le geste est horizontal ou vertical
const RATIO = 1.1;        // horizontal dès que |dx| > 1,1 × |dy|
const DISTANCE = 0.16;    // part de la largeur à parcourir pour valider (≈ 60 px sur téléphone)
const FLICK = 0.25;       // ou vitesse (px/ms) d'un petit geste vif…
const FLICK_MIN = 24;     // …sur au moins cette distance
const FOLLOW = 0.35;      // la page bouge d'un tiers du geste (repère visuel, sans gêner)

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
    g = { idx, x: t.clientX, y: t.clientY, t: performance.now(), dx: 0, axis: null, v: 0, lx: t.clientX, lt: performance.now(), view: root.firstElementChild, w: root.clientWidth || window.innerWidth };
  }, { passive: true });

  root.addEventListener("touchmove", (e) => {
    if (!g) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.axis) {
      if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
      g.axis = Math.abs(dx) > Math.abs(dy) * RATIO ? "x" : "y";
      if (g.axis === "y") { g = null; return; }   // défilement vertical : on laisse faire
    }
    e.preventDefault();   // geste horizontal : la page ne défile plus verticalement
    g.dx = dx;
    // vitesse instantanée (lissée) : un petit coup sec suffit
    const now = performance.now();
    g.v = 0.6 * ((t.clientX - g.lx) / Math.max(1, now - g.lt)) + 0.4 * g.v;
    g.lx = t.clientX; g.lt = now;
    if (prefersReducedMotion() || !g.view) return;
    const target = g.idx + (dx > 0 ? 1 : -1);
    const free = target >= 0 && target < order.length;
    const shift = -dx * (free ? FOLLOW : 0.08);   // la page recule ; premier/dernier onglet : quasi immobile
    g.view.style.transition = "none";
    g.view.style.transform = `translate3d(${shift}px, 0, 0)`;
  }, { passive: false });

  const end = () => {
    if (!g || g.axis !== "x") { g = null; return; }
    const { dx, idx, view, w, v } = g;
    g = null;
    const target = idx + (dx > 0 ? 1 : -1);
    const flick = Math.abs(v) > FLICK && Math.sign(v) === Math.sign(dx) && Math.abs(dx) > FLICK_MIN;
    const valid = target >= 0 && target < order.length && (Math.abs(dx) > w * DISTANCE || flick);
    const still = prefersReducedMotion();

    if (!valid) {
      if (view && !still) {
        view.style.transition = "transform 220ms cubic-bezier(0.23, 1, 0.32, 1)";
        view.style.transform = "";
      }
      return;
    }
    const from = dx > 0 ? "right" : "left";   // la nouvelle page arrive du côté vers lequel on va
    if (view && !still) {
      view.style.transition = "transform 140ms cubic-bezier(0.23, 1, 0.32, 1), opacity 140ms ease";
      view.style.transform = `translate3d(${dx > 0 ? -w * 0.3 : w * 0.3}px, 0, 0)`;
      view.style.opacity = "0";
      setTimeout(() => go(order[target], from), 110);
    } else {
      go(order[target], from);
    }
  };
  root.addEventListener("touchend", end);
  root.addEventListener("touchcancel", () => { if (g) g.dx = 0; end(); });   // geste interrompu : retour en place
}
