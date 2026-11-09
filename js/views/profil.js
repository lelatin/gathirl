/* =====================================================================
   FICHE DE PERSONNAGE — profil d'un joueur
   ===================================================================== */
import { $, html, icon, mount } from "../lib/dom.js";
import { fmtDay, fmtMonth, fmtTime, levelMeta, levelPip, sigil } from "../lib/format.js";
import { db } from "../data/index.js";
import { openEditProfile } from "../ui/forms.js";
import { toast } from "../ui/toast.js";

export async function render(el, ctx) {
  const me = db.auth.user();
  const userId = ctx.params.id || me?.id;

  if (!userId) {
    location.replace("#/connexion?retour=" + encodeURIComponent("#/profil"));
    return;
  }

  mount(el, html`<div class="wrap sheet"><div class="skeleton" style="height:220px"></div><div class="skeleton" style="height:120px"></div></div>`);

  const load = async () => {
    const [user, hosted, parts, friends] = await Promise.all([
      db.profiles.get(userId),
      db.parties.forHost(userId),
      db.participations.forUser(userId),
      me ? db.friendships.forUser(me.id) : Promise.resolve([]),
    ]);
    const joinedIds = parts.map((p) => p.partie_id).filter((id) => !hosted.some((h) => h.id === id));
    const joined = await db.parties.byIds(joinedIds);
    const ownFriends = me?.id === userId ? friends : userId ? await db.friendships.forUser(userId).catch(() => []) : [];
    return { user, hosted, joined, friends, ownFriends };
  };

  let data;
  try { data = await load(); } catch (e) { toast.error("Fiche illisible", e.message); return; }
  if (!el.isConnected) return;

  const draw = () => {
    const { user, hosted, joined, friends, ownFriends } = data;
    const meNow = db.auth.user();
    if (!user) {
      mount(el, html`<div class="wrap lost"><h1>Profil introuvable</h1><p class="muted">Cet utilisateur n'existe pas ou n'a pas de profil public.</p><a class="btn" href="#/">${icon("back")} Retour</a></div>`);
      return;
    }
    const isMe = meNow?.id === user.id;
    const now = new Date();
    const all = [...hosted, ...joined].filter((p) => p.status !== "annulé");
    const upcoming = all.filter((p) => new Date(p.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date));
    const history = all.filter((p) => new Date(p.date) < now).sort((a, b) => new Date(b.date) - new Date(a.date));
    const organised = hosted.filter((p) => p.status !== "annulé");
    const lvl = user.skill_level || "Casual";

    // relation d'amitié entre moi et ce profil
    const rel = meNow && !isMe ? friends.find((f) => (f.requester_id === meNow.id && f.receiver_id === user.id) || (f.requester_id === user.id && f.receiver_id === meNow.id)) : null;
    const incoming = isMe ? friends.filter((f) => f.status === "pending" && f.receiver_id === user.id) : [];
    const accepted = (isMe ? friends : ownFriends).filter((f) => f.status === "accepted");
    const mates = accepted.map((f) => (f.requester_id === user.id ? { id: f.receiver_id, full_name: f.receiver_name } : { id: f.requester_id, full_name: f.requester_name }));

    let friendBtn = "";
    if (meNow && !isMe) {
      if (!rel) friendBtn = html`<button type="button" class="btn btn--sm" data-friend-add>${icon("user-plus")} Ajouter en ami</button>`;
      else if (rel.status === "accepted") friendBtn = html`<span class="tag tag--gold">${icon("check")} Compagnon d'armes</span>`;
      else if (rel.requester_id === meNow.id) friendBtn = html`<span class="tag">Demande envoyée</span>`;
      else friendBtn = html`<button type="button" class="btn btn--sm btn--gold" data-friend-accept="${rel.id}">${icon("check")} Accepter</button><button type="button" class="btn btn--sm btn--icon" data-friend-decline="${rel.id}" aria-label="Refuser">${icon("x")}</button>`;
    }

    mount(el, html`
      <div class="wrap sheet">
        <section class="panel panel--corners sheet__head">
          ${sigil(user, "lg")}
          <div class="sheet__id">
            <p class="kicker">Fiche de personnage</p>
            <h1>${user.full_name || "Joueur"}</h1>
            <div class="sheet__meta">
              ${user.city ? html`<span>${icon("pin")} ${user.city}</span>` : ""}
              <span>${levelPip(lvl)} ${lvl}</span>
            </div>
            ${(user.favorite_formats || []).length ? html`<div class="sheet__tags">${user.favorite_formats.map((f) => html`<span class="tag tag--gold">${f}</span>`)}</div>` : ""}
            ${user.bio ? html`<p class="sheet__bio">« ${user.bio} »</p>` : isMe ? html`<p class="sheet__bio muted">Votre histoire reste à écrire… Ajoutez une bio !</p>` : ""}
          </div>
          <div class="sheet__actions">
            ${isMe
              ? html`<button type="button" class="btn btn--gold btn--sm" data-edit>${icon("edit")} Modifier ma fiche</button>
                     <button type="button" class="btn btn--ghost btn--sm" data-logout>${icon("logout")} Déconnexion</button>`
              : meNow ? html`<a class="btn btn--primary btn--sm" href="#/messages/${user.id}">${icon("scroll")} Missive</a>${friendBtn}`
              : html`<a class="btn btn--sm" href="#/connexion">Se connecter pour contacter</a>`}
          </div>
        </section>

        <section class="abilities" aria-label="Caractéristiques">
          <div class="ability"><span class="ability__label">Parties jouées</span><span class="ability__value">${history.length}</span><span class="ability__mod">XP</span></div>
          <div class="ability"><span class="ability__label">Niveau global</span><span class="ability__value ability__value--word">${lvl}</span><span class="ability__mod">${levelMeta(lvl).mod}</span></div>
          <div class="ability"><span class="ability__label">Organisées</span><span class="ability__value">${organised.length}</span><span class="ability__mod">MJ</span></div>
          <div class="ability"><span class="ability__label">À venir</span><span class="ability__value">${upcoming.length}</span><span class="ability__mod">⚔</span></div>
        </section>

        ${incoming.length ? html`
          <section class="sheet__section">
            <h2>${icon("user-plus")} Demandes d'amis</h2>
            <div class="mini-list">${incoming.map((f) => html`
              <div class="request">
                ${sigil({ id: f.requester_id, full_name: f.requester_name })}
                <div class="request__who"><p><a class="link" href="#/profil/${f.requester_id}">${f.requester_name}</a></p><p>Veut être votre compagnon d'armes</p></div>
                <button type="button" class="btn btn--sm btn--gold" data-friend-accept="${f.id}">${icon("check")} Accepter</button>
                <button type="button" class="btn btn--sm btn--icon" data-friend-decline="${f.id}" aria-label="Refuser">${icon("x")}</button>
              </div>`)}</div>
          </section>` : ""}

        ${mates.length ? html`
          <section class="sheet__section">
            <h2>${icon("users")} Compagnons (${mates.length})</h2>
            <div class="friends-strip">${mates.map((u) => html`<a class="friend-chip" href="#/profil/${u.id}" title="${u.full_name}">${sigil(u)}<span>${u.full_name}</span></a>`)}</div>
          </section>` : ""}

        ${listSection("calendar", "Parties à venir", upcoming)}
        ${listSection("swords", "Historique", history)}
        ${organised.length ? listSection("crown", "Parties organisées", organised.sort((a, b) => new Date(b.date) - new Date(a.date))) : ""}

        ${!all.length ? html`
          <div class="empty">
            <svg class="empty__icon"><use href="#i-scroll"/></svg>
            <h3>Aucune partie pour le moment.</h3>
            ${isMe ? html`<p>Rejoignez ou organisez une partie pour remplir votre historique !</p><a class="btn btn--primary" href="#/parties">${icon("swords")} Trouver une table</a>` : ""}
          </div>` : ""}
      </div>`);
  };

  draw();

  el.addEventListener("click", async (e) => {
    const t = e.target;
    try {
      if (t.closest("[data-edit]")) openEditProfile(db.auth.user(), { onSaved: async () => { data = await load(); draw(); } });
      else if (t.closest("[data-logout]")) { await db.auth.signOut(); toast("À bientôt, aventurier·e", "Vous êtes déconnecté·e."); location.hash = "#/"; }
      else if (t.closest("[data-friend-add]")) { await db.friendships.request(userId); toast.success("Demande envoyée", "Un corbeau porte votre proposition d'alliance."); data = await load(); draw(); }
      else if (t.closest("[data-friend-accept]")) { await db.friendships.accept(t.closest("[data-friend-accept]").dataset.friendAccept); toast.success("Nouvelle alliance !", "Vous êtes désormais compagnons d'armes."); data = await load(); draw(); }
      else if (t.closest("[data-friend-decline]")) { await db.friendships.remove(t.closest("[data-friend-decline]").dataset.friendDecline); data = await load(); draw(); }
    } catch (ex) { toast.error("Oups", ex.message); }
  });

  return db.on(async () => { if (el.isConnected) { data = await load().catch(() => data); draw(); } });
}

function listSection(ic, title, items) {
  if (!items.length) return "";
  return html`
    <section class="sheet__section">
      <h2>${icon(ic)} ${title}</h2>
      <div class="mini-list">${items.map((p) => html`
        <a class="mini" href="#/partie/${p.id}">
          <span class="mini__date"><strong class="tnum">${fmtDay(p.date)}</strong>${fmtMonth(p.date)}</span>
          <span class="mini__body"><p title="${p.title}">${p.title}</p><p>${p.format} · ${p.city} · ${fmtTime(p.date)}</p></span>
          <span class="mini__count tnum">${p.current_players}/${p.max_players}</span>
        </a>`)}</div>
    </section>`;
}
