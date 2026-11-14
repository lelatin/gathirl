/* =====================================================================
   GATHIRL — point d'entrée
   Routeur par hash (compatible GitHub Pages sans configuration),
   HUD, raccourcis clavier, actions globales.
   ===================================================================== */
import { $, $$, html, icon, mount } from "./lib/dom.js?v=202611141722";
import { sigil } from "./lib/format.js?v=202611141722";
import { db, initData } from "./data/index.js?v=202611141722";
import { openCreatePartie } from "./ui/forms.js?v=202611141722";

import * as Home from "./views/home.js?v=202611141722";
import { isNative, setupNative } from "./lib/native.js?v=202611141722";

/* ---------------- Routes ----------------
   Seul l'accueil est chargé au démarrage. Les autres pages (et leurs
   dépendances, comme le générateur de QR code du billet) ne sont
   téléchargées qu'à la première visite : l'application s'ouvre plus vite. */
const lazy = (load, name = "render") => async (...a) => (await load())[name](...a);
const Partie = () => import("./views/partie.js?v=202611141722");
const Profil = () => import("./views/profil.js?v=202611141722");
const Social = () => import("./views/social.js?v=202611141722");
const Auth = () => import("./views/auth.js?v=202611141722");
const Messages = () => import("./views/messages.js?v=202611141722");
const Lore = () => import("./views/lore.js?v=202611141722");
const Legal = () => import("./views/legal.js?v=202611141722");

const routes = [
  { re: /^\/$/, nav: "home", title: "Taverne", view: Home.render },
  { re: /^\/parties$/, nav: "parties", title: "Parties", view: Home.render },
  { re: /^\/partie\/([\w-]+)$/, keys: ["id"], nav: "parties", title: "Partie", view: lazy(Partie) },
  { re: /^\/profil$/, nav: "profil", title: "Mon profil", view: lazy(Profil) },
  { re: /^\/profil\/([\w-]+)$/, keys: ["id"], nav: "social", title: "Profil", view: lazy(Profil) },
  { re: /^\/social$/, nav: "social", title: "Social", view: lazy(Social) },
  { re: /^\/messages$/, nav: "messages", title: "Missives", view: lazy(Messages, "renderInbox") },
  { re: /^\/messages\/([\w-]+)$/, keys: ["id"], nav: "messages", title: "Missive", view: lazy(Messages, "renderThread") },
  { re: /^\/connexion$/, nav: "profil", title: "Connexion", view: lazy(Auth) },
  { re: /^\/inscription$/, nav: "profil", title: "Inscription", view: lazy(Auth) },
  { re: /^\/lore$/, nav: null, title: "Le lore", view: lazy(Lore) },
  { re: /^\/confidentialite$/, nav: null, title: "Politique de confidentialité", view: lazy(Legal, "renderConfidentialite") },
  { re: /^\/donnees-personnelles$/, nav: null, title: "Données personnelles", view: lazy(Legal, "renderDonnees") },
  { re: /^\/mentions-legales$/, nav: null, title: "Mentions légales", view: lazy(Legal, "renderMentions") },
];

/* Une fois l'accueil affiché, on précharge en tâche de fond les pages de la barre
   d'onglets : le premier tap sur Social, Missives ou une partie est alors immédiat. */
function prefetchViews() {
  const go = () => [Partie, Social, Messages, Profil].forEach((f) => f().catch(() => {}));
  if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 4000 });
  else setTimeout(go, 2500);
}

/* ---------------- Mises à jour du site ----------------
   GitHub Pages laisse les navigateurs garder la page 10 minutes : sur téléphone,
   une nouvelle version pouvait mettre longtemps à apparaître. On compare donc
   la version chargée (le ?v= de ce fichier) à version.json, lu sans cache, à
   l'ouverture et à chaque retour sur l'onglet ; si elle a changé, on recharge. */
const VERSION = new URL(import.meta.url).searchParams.get("v");
let lastCheck = 0;
async function checkForUpdate() {
  if (isNative() || !VERSION || Date.now() - lastCheck < 30000) return;
  lastCheck = Date.now();
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return;
    const { v } = await r.json();
    if (!v || v === VERSION) return;
    // jamais pendant une saisie ou une fenêtre ouverte : on ne perd rien de ce qui est tapé
    if (document.querySelector("dialog[open]")) return;
    if ([...document.querySelectorAll("textarea, input:not([type=hidden])")].some((f) => f.value && f.type !== "search")) return;
    // une seule tentative par version et par session (évite toute boucle si le CDN hésite)
    const key = "gathirl:reloaded:" + v;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch {}
    // nouvelle adresse (?v=…) : le navigateur ne peut pas resservir l'ancienne page depuis son cache
    location.replace(`${location.pathname}?v=${v}${location.hash}`);
  } catch { /* hors ligne : on réessaiera */ }
}

const app = document.getElementById("app");
let cleanup = null;
let lastPath = null;

function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, qs = ""] = raw.split("?");
  return { path: path || "/", query: new URLSearchParams(qs) };
}

async function router() {
  const { path, query } = parseHash();
  let match = null, params = {};
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) { match = r; (r.keys || []).forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1]))); break; }
  }

  try { cleanup?.(); } catch {}
  cleanup = null;

  // Chaque vue reçoit un conteneur neuf : pas de fuite d'écouteurs
  const view = document.createElement("div");
  view.className = "view";
  app.replaceChildren(view);

  setActiveNav(match?.nav);
  document.title = `${match?.title || "Égaré·e"} · Gathirl`;

  // Remonter en haut sauf si on reste sur la même page
  if (path !== lastPath) window.scrollTo({ top: 0, behavior: "instant" });
  lastPath = path;

  if (!match) {
    mount(view, html`
      <div class="wrap lost">
        <svg class="empty__icon" style="width:72px;height:72px"><use href="#i-d20"/></svg>
        <h1>Vous vous êtes égaré·e</h1>
        <p class="muted">Ce chemin ne mène nulle part. Même l'Oracle ne le connaît pas.</p>
        <a class="btn btn--primary" href="#/">${icon("home")} Retour à la taverne</a>
      </div>`);
    return;
  }

  try {
    const c = await match.view(view, { params, query, path });
    // l'utilisateur est déjà sur une autre page (chargement lent) : on nettoie celle-ci sans écraser la suivante
    if (app.firstElementChild !== view) { if (typeof c === "function") c(); return; }
    if (typeof c === "function") cleanup = c;
  } catch (err) {
    console.error(err);
    mount(view, html`<div class="wrap lost"><h1>Un sortilège a échoué</h1><p class="muted">${err.message}</p><a class="btn" href="#/">Retour</a></div>`);
  }
}

function setActiveNav(nav) {
  $$("[data-nav]").forEach((a) => {
    if (a.dataset.nav === nav) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

/* ---------------- HUD ---------------- */
function renderHudAuth() {
  const me = db.auth.user();
  mount($("#hud-auth"), me
    ? html`
        <button type="button" class="btn btn--primary btn--sm hud__cta" data-action="create-partie">${icon("plus")} Organiser</button>
        <a href="#/profil" class="sigil-link" data-nav="profil" aria-label="Mon profil (${me.full_name})">${sigil(me, "sm")}</a>`
    : html`
        <a class="btn btn--ghost btn--sm hud__login" href="#/connexion">Se connecter</a>
        <a class="btn btn--primary btn--sm" href="#/inscription">S'inscrire</a>`);
}

async function refreshUnread() {
  const me = db.auth.user();
  let n = 0;
  if (me) {
    try { n = (await db.messages.mine()).filter((m) => m.receiver_id === me.id && !m.read).length; } catch {}
  }
  $$("[data-unread]").forEach((d) => (d.hidden = n === 0));
}

/* ---------------- Actions globales ---------------- */
document.addEventListener("click", (e) => {
  const b = e.target.closest('[data-action="create-partie"]');
  if (b) { e.preventDefault(); openCreatePartie(); }
});

/* Raccourcis : 1-4 pour naviguer, N pour organiser (jamais animés) */
document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
  const t = e.target;
  if (t.closest?.("input, textarea, select, [contenteditable], dialog")) return;
  const map = { "1": "#/", "2": "#/parties", "3": "#/messages", "4": "#/social" };
  if (map[e.key]) { location.hash = map[e.key]; }
  // Ouverte au clavier = instantanée : on n'anime jamais une action clavier
  else if (e.key === "n" || e.key === "N") { e.preventDefault(); openCreatePartie({ instant: true }); }
});

/* ---------------- Démarrage ---------------- */
(async function boot() {
  setupNative();   // application mobile : barre d'état, bouton retour (sans effet sur le site)
  await initData();

  renderHudAuth();
  refreshUnread();

  db.on(() => { renderHudAuth(); refreshUnread(); });
  // si l'utilisateur se connecte/déconnecte, recharger la vue courante
  let lastUser = db.auth.user()?.id || null;
  db.on(() => {
    const u = db.auth.user()?.id || null;
    if (u !== lastUser) { lastUser = u; router(); }
  });

  window.addEventListener("hashchange", router);
  await router();

  // le « ?v=… » ajouté par une mise à jour n'a pas à rester dans la barre d'adresse
  if (/^\?v=\d+$/.test(location.search)) history.replaceState(null, "", location.pathname + location.hash);
  prefetchViews();
  checkForUpdate();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkForUpdate(); });
})();
