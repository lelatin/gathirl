/* =====================================================================
   Petits outils DOM : gabarits HTML échappés, icônes, sélecteurs.
   Toute valeur interpolée dans html`` est échappée (protection XSS),
   sauf si elle est elle-même un html`` ou passée par raw().
   ===================================================================== */

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const raw = (s) => new Raw(String(s));

function fmt(v) {
  if (v == null || v === false) return "";
  if (Array.isArray(v)) return v.map(fmt).join("");
  if (v instanceof Raw) return v.s;
  return escape(v);
}

export function html(strings, ...vals) {
  let out = "";
  strings.forEach((s, i) => {
    out += s;
    if (i < vals.length) out += fmt(vals[i]);
  });
  return new Raw(out);
}

/** Icône du sprite : icon("pin") */
export const icon = (name, cls = "") =>
  raw(`<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Monte un gabarit dans un élément */
export function mount(el, tpl) {
  el.innerHTML = String(tpl);
  return el;
}

/** Crée un élément à partir d'un gabarit */
export function create(tpl) {
  const t = document.createElement("template");
  t.innerHTML = String(tpl).trim();
  return t.content.firstElementChild;
}

/** Délégation d'événements : on(root, "click", "[data-x]", fn) */
export function on(root, type, selector, fn, opts) {
  const handler = (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) fn(e, target);
  };
  root.addEventListener(type, handler, opts);
  return () => root.removeEventListener(type, handler, opts);
}

export const debounce = (fn, ms = 300) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

export const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const canHover = () =>
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/** Révèle les éléments .reveal une seule fois quand ils entrent à l'écran */
export function revealOnScroll(root = document) {
  const els = $$(".reveal:not(.is-in)", root);
  if (!("IntersectionObserver" in window) || prefersReducedMotion()) {
    els.forEach((el) => el.classList.add("is-in"));
    return () => {};
  }
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
    }
  }, { rootMargin: "0px 0px -60px 0px" });
  els.forEach((el) => io.observe(el));
  return () => io.disconnect();
}
