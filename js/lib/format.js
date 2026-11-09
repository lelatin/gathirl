/* =====================================================================
   Constantes du jeu + formatage (dates, pluriels, couleurs de mana)
   ===================================================================== */
import { html, icon } from "./dom.js";

export const FORMATS = ["Commander", "Standard", "Modern", "Pioneer", "Legacy", "Vintage", "Pauper", "Draft", "Sealed", "Cube"];
export const LEVELS = ["Débutant", "Casual", "Compétitif"];

/* Niveau → coût de mana (1, 2 ou 3 pastilles) */
const LEVEL_META = {
  "Débutant": { pip: "g", icon: "leaf", count: 1, mod: "+1" },
  "Casual": { pip: "u", icon: "drop", count: 2, mod: "+2" },
  "Compétitif": { pip: "r", icon: "flame", count: 3, mod: "+3" },
};
export const levelMeta = (lvl) => LEVEL_META[lvl] || LEVEL_META.Casual;

export function manaCost(level) {
  const m = levelMeta(level);
  return html`<span class="pips" title="Niveau : ${level}" aria-label="Niveau : ${level}">${Array.from({ length: m.count }, () => html`<span class="pip pip--${m.pip}">${icon(m.icon)}</span>`)}</span>`;
}
export function levelPip(level) {
  const m = levelMeta(level);
  return html`<span class="pip pip--${m.pip}">${icon(m.icon)}</span>`;
}

export const frameClass = (format) => `frame--${String(format || "").toLowerCase()}`;

/* Couleur du sceau d'un joueur, stable selon son id */
const SIGIL_COLORS = ["var(--gold)", "var(--mana-r)", "var(--mana-u)", "var(--mana-g)", "var(--mana-b)", "var(--mana-w)", "#c58b4c"];
export function sigil(user, size = "") {
  const name = user?.full_name || user?.name || user?.user_name || "?";
  const c = SIGIL_COLORS[hash(user?.id || name) % SIGIL_COLORS.length];
  const inner = user?.avatar_url
    ? html`<img src="${user.avatar_url}" alt="" loading="lazy" />`
    : name.trim().charAt(0).toUpperCase() || "?";
  return html`<span class="sigil ${size ? "sigil--" + size : ""}" style="--c:${c}" aria-hidden="true">${inner}</span>`;
}

export function hash(str) {
  return String(str).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

/* Illustration déterministe pour une partie (22 illustrations) */
export const ART_COUNT = 22;
export function artFor(id) {
  const n = (hash(id) % ART_COUNT) + 1;
  return `assets/img/art-${String(n).padStart(2, "0")}.webp`;
}

/* ---------- Dates ---------- */
const dFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const dLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const tFmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric" });
const monFmt = new Intl.DateTimeFormat("fr-FR", { month: "short" });
const shortFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

export const fmtDate = (d) => dFmt.format(new Date(d));
export const fmtDateLong = (d) => dLong.format(new Date(d));
export const fmtTime = (d) => tFmt.format(new Date(d));
export const fmtDay = (d) => dayFmt.format(new Date(d));
export const fmtMonth = (d) => monFmt.format(new Date(d)).replace(".", "");

/** "il y a 5 min" puis date absolue après une semaine (UI cheatsheet) */
const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
export function fmtRelative(d) {
  const diff = (new Date(d) - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "à l'instant";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 7 * 86400) return rtf.format(Math.round(diff / 86400), "day");
  return shortFmt.format(new Date(d));
}

/** Compte à rebours lisible pour une partie à venir */
export function fmtCountdown(d) {
  const diff = new Date(d) - Date.now();
  if (diff < 0) return "terminée";
  const h = diff / 3600000;
  if (h < 1) return "imminente";
  if (h < 24) return `dans ${Math.round(h)} h`;
  return rtf.format(Math.round(h / 24), "day");
}

/* ---------- Pluriels (pas de "1 joueurs") ---------- */
const pr = new Intl.PluralRules("fr-FR");
export function plural(n, one, other) {
  return `${n} ${pr.select(n) === "one" ? one : other}`;
}

/* Valeur pour <input type="datetime-local"> */
export function toLocalInput(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
