/* =====================================================================
   SOCIAL — chercher des comptes, gérer ses contacts.
   Gabarit Instagram : barre de recherche en haut, puis des lignes
   « avatar · nom · sous-titre · bouton » (demandes, contacts, suggestions).
   ===================================================================== */
import { $, html, icon, mount, debounce } from "../lib/dom.js?v=202611141757";
import { levelPip, plural, sigil } from "../lib/format.js?v=202611141757";
import { db } from "../data/index.js?v=202611141757";
import { toast } from "../ui/toast.js?v=202611141757";

let lastQuery = "";   // la recherche survit à un aller-retour vers un profil

export async function render(el) {
  mount(el, html`
    <div class="wrap social">
      <div class="social__top">
        <h1 class="social__title">Social</h1>
        ${db.auth.user() ? html`<a class="social__dm" href="#/messages" aria-label="Missives">${icon("send")}<span class="dot" data-dm-unread hidden></span></a>` : ""}
      </div>
      <label class="search">
        ${icon("search")}
        <span class="sr-only">Rechercher un compte</span>
        <input type="search" data-q placeholder="Rechercher un joueur ou une ville" autocomplete="off" enterkeyhint="search" value="${lastQuery}" />
      </label>
      <div data-body><div class="skeleton" style="height:180px;border-radius:14px"></div></div>
    </div>`);

  const input = $("[data-q]", el);
  const body = $("[data-body]", el);
  let friends = [];
  let seq = 0;

  const loadFriends = async () => {
    const me = db.auth.user();
    friends = me ? await db.friendships.forUser(me.id).catch(() => []) : [];
  };

  /* relation entre moi et un compte : null | "me" | "friend" | "sent" | "received" */
  const relation = (id) => {
    const me = db.auth.user();
    if (!me) return { kind: null };
    if (id === me.id) return { kind: "me" };
    const f = friends.find((x) => (x.requester_id === me.id && x.receiver_id === id) || (x.requester_id === id && x.receiver_id === me.id));
    if (!f) return { kind: null };
    if (f.status === "accepted") return { kind: "friend", f };
    return { kind: f.requester_id === me.id ? "sent" : "received", f };
  };

  const action = (u) => {
    if (!db.auth.user()) return "";
    const r = relation(u.id);
    if (r.kind === "me") return html`<span class="person__note">Vous</span>`;
    if (r.kind === "friend") return html`<a class="ig-btn" href="#/messages/${u.id}">Missive</a>`;
    if (r.kind === "sent") return html`<button type="button" class="ig-btn" data-cancel="${r.f.id}">Demande envoyée</button>`;
    if (r.kind === "received") return html`
      <button type="button" class="ig-btn ig-btn--primary" data-accept="${r.f.id}">Accepter</button>
      <button type="button" class="ig-btn ig-btn--icon" data-decline="${r.f.id}" aria-label="Refuser la demande de ${u.full_name}">${icon("x")}</button>`;
    return html`<button type="button" class="ig-btn ig-btn--primary" data-add="${u.id}">Ajouter</button>`;
  };

  const row = (u, sub) => html`
    <li class="person">
      <a class="person__who" href="#/profil/${u.id}">
        ${sigil(u)}
        <span class="person__text">
          <span class="person__name">${u.full_name || "Joueur"}</span>
          <span class="person__sub">${sub ?? subtitle(u)}</span>
        </span>
      </a>
      <span class="person__act">${action(u)}</span>
    </li>`;

  const block = (title, users, opts = {}) => users.length ? html`
    <section class="social__block">
      <h2 class="social__h">${title}${opts.count ? html` <span class="social__count">${users.length}</span>` : ""}</h2>
      <ul class="people" role="list">${users.map((u) => row(u, opts.sub?.(u)))}</ul>
    </section>` : "";

  /* ---------- Sans recherche : demandes, contacts, suggestions ---------- */
  const drawHome = async () => {
    const me = db.auth.user();
    const mySeq = ++seq;
    if (!me) {
      let users = [];
      try { users = await db.profiles.list({ limit: 12 }); } catch {}
      if (mySeq !== seq || !el.isConnected) return;
      mount(body, html`
        <div class="social__guest">
          ${icon("users", "social__guest-icon")}
          <h2>Vos contacts au même endroit</h2>
          <p>Connectez-vous pour ajouter des joueurs et retrouver vos contacts.</p>
          <div class="social__guest-ctas">
            <a class="ig-btn ig-btn--primary" href="#/connexion?retour=${encodeURIComponent("#/social")}">Se connecter</a>
            <a class="ig-btn" href="#/inscription">S'inscrire</a>
          </div>
        </div>
        ${block("Joueurs de la communauté", users)}`);
      return;
    }

    const incoming = friends.filter((f) => f.status === "pending" && f.receiver_id === me.id);
    const accepted = friends.filter((f) => f.status === "accepted");
    const contactIds = accepted.map((f) => (f.requester_id === me.id ? f.receiver_id : f.requester_id));
    const [requesters, contacts, community] = await Promise.all([
      db.profiles.many(incoming.map((f) => f.requester_id)).catch(() => []),
      db.profiles.many(contactIds).catch(() => []),
      db.profiles.list({ limit: 24 }).catch(() => []),
    ]);
    if (mySeq !== seq || !el.isConnected) return;

    const known = new Set([me.id, ...friends.flatMap((f) => [f.requester_id, f.receiver_id])]);
    const suggestions = community.filter((u) => !known.has(u.id)).slice(0, 8);
    contacts.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "", "fr"));

    mount(body, html`
      ${block("Demandes reçues", requesters, { count: true, sub: () => "Veut vous ajouter en contact" })}
      ${contacts.length
        ? block("Mes contacts", contacts, { count: true })
        : html`<section class="social__block">
            <h2 class="social__h">Mes contacts</h2>
            <p class="social__empty">Vous n'avez pas encore de contact. Cherchez un joueur ci-dessus, ou ajoutez-en un parmi les suggestions.</p>
          </section>`}
      ${block("Suggestions", suggestions)}`);
  };

  /* ---------- Avec recherche : les résultats ---------- */
  const drawResults = async (q) => {
    const mySeq = ++seq;
    let users = [];
    try { users = await db.profiles.search(q); } catch (e) { toast.error("Recherche impossible", e.message); }
    if (mySeq !== seq || !el.isConnected) return;
    mount(body, users.length
      ? block(plural(users.length, "résultat", "résultats"), users)
      : html`<p class="social__empty social__empty--center">Aucun compte ne correspond à « ${q} ».</p>`);
  };

  const draw = () => (lastQuery.trim() ? drawResults(lastQuery.trim()) : drawHome());

  // pastille rouge sur l'icône des missives, comme celle de l'onglet
  const markUnread = async () => {
    const me = db.auth.user(), dot = $("[data-dm-unread]", el);
    if (!me || !dot) return;
    try { dot.hidden = !(await db.messages.mine()).some((m) => m.receiver_id === me.id && !m.read); } catch {}
  };

  await loadFriends();
  if (!el.isConnected) return;
  draw();
  markUnread();

  input.addEventListener("input", debounce(() => { lastQuery = input.value; draw(); }, 200));

  el.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-add], [data-accept], [data-decline], [data-cancel]");
    if (!t) return;
    t.disabled = true;
    try {
      if (t.dataset.add) { await db.friendships.request(t.dataset.add); toast.success("Demande envoyée", "Un corbeau porte votre proposition."); }
      else if (t.dataset.accept) { await db.friendships.accept(t.dataset.accept); toast.success("Nouveau contact !", "Vous êtes désormais en contact."); }
      else await db.friendships.remove(t.dataset.decline || t.dataset.cancel);
      await loadFriends();
      draw();
    } catch (ex) { t.disabled = false; toast.error("Oups", ex.message); }
  });

  // une demande reçue pendant qu'on est sur la page
  return db.on(async () => { if (!el.isConnected) return; await loadFriends(); draw(); markUnread(); });
}

function subtitle(u) {
  const lvl = u.skill_level || "Casual";
  return html`${levelPip(lvl)} ${lvl}${u.city ? ` · ${u.city}` : ""}`;
}
