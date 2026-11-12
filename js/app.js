/* =====================================================================
   GATHIRL — point d'entrée
   Routeur par hash (compatible GitHub Pages sans configuration),
   HUD, raccourcis clavier, actions globales.
   ===================================================================== */
import { $, $$, html, icon, mount } from "./lib/dom.js?v=202611120209";
import { sigil } from "./lib/format.js?v=202611120209";
import { db, initData } from "./data/index.js?v=202611120209";
import { openCreatePartie } from "./ui/forms.js?v=202611120209";

import * as Home from "./views/home.js?v=202611120209";
import * as Partie from "./views/partie.js?v=202611120209";
import * as Profil from "./views/profil.js?v=202611120209";
import * as Auth from "./views/auth.js?v=202611120209";
import { renderInbox, renderThread } from "./views/messages.js?v=202611120209";
import * as Lore from "./views/lore.js?v=202611120209";
import * as Legal from "./views/legal.js?v=202611120209";
import { setupNative } from "./lib/native.js?v=202611120209";

/* ---------------- Routes ---------------- */
const routes = [
  { re: /^\/$/, nav: "home", title: "Taverne", view: Home.render },
  { re: /^\/parties$/, nav: "parties", title: "Parties", view: Home.render },
  { re: /^\/partie\/([\w-]+)$/, keys: ["id"], nav: "parties", title: "Partie", view: Partie.render },
  { re: /^\/profil$/, nav: "profil", title: "Ma fiche", view: Profil.render },
  { re: /^\/profil\/([\w-]+)$/, keys: ["id"], nav: "profil", title: "Fiche de personnage", view: Profil.render },
  { re: /^\/messages$/, nav: "messages", title: "Missives", view: renderInbox },
  { re: /^\/messages\/([\w-]+)$/, keys: ["id"], nav: "messages", title: "Missive", view: renderThread },
  { re: /^\/connexion$/, nav: "profil", title: "Connexion", view: Auth.render },
  { re: /^\/inscription$/, nav: "profil", title: "Inscription", view: Auth.render },
  { re: /^\/lore$/, nav: null, title: "Le lore", view: Lore.render },
  { re: /^\/confidentialite$/, nav: null, title: "Politique de confidentialité", view: Legal.renderConfidentialite },
  { re: /^\/donnees-personnelles$/, nav: null, title: "Données personnelles", view: Legal.renderDonnees },
  { re: /^\/mentions-legales$/, nav: null, title: "Mentions légales", view: Legal.renderMentions },
];

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
        <a href="#/profil" class="sigil-link" aria-label="Ma fiche (${me.full_name})">${sigil(me, "sm")}</a>`
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

function startClock() {
  const el = $("#hud-clock");
  const fmt = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const tick = () => (el.textContent = fmt.format(new Date()));
  tick();
  setInterval(tick, 30000);
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
  const map = { "1": "#/", "2": "#/parties", "3": "#/messages", "4": "#/profil" };
  if (map[e.key]) { location.hash = map[e.key]; }
  // Ouverte au clavier = instantanée : on n'anime jamais une action clavier
  else if (e.key === "n" || e.key === "N") { e.preventDefault(); openCreatePartie({ instant: true }); }
});

/* ---------------- Démarrage ---------------- */
(async function boot() {
  setupNative();   // application mobile : barre d'état, bouton retour (sans effet sur le site)
  await initData();

  $("#hud-mode").textContent = db.mode === "demo" ? "◆ MODE DÉMO" : "◆ SERVEUR";
  startClock();
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
  router();
})();
