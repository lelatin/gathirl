/* =====================================================================
   FICHE DE PERSONNAGE — profil d'un joueur
   ===================================================================== */
import { $, html, icon, mount } from "../lib/dom.js?v=202611120206";
import { fmtDay, fmtMonth, fmtTime, levelMeta, levelPip, sigil } from "../lib/format.js?v=202611120206";
import { db } from "../data/index.js?v=202611120206";
import { openEditProfile } from "../ui/forms.js?v=202611120206";
import { toast } from "../ui/toast.js?v=202611120206";
import { holdToConfirm } from "../ui/hold.js?v=202611120206";

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

    // Bio en carte citation (le négatif du thème) ; à défaut, une phrase utile
    const bio = user.bio
      ? html`« ${user.bio} »`
      : isMe ? html`Votre histoire reste à <em>écrire</em>. Ajoutez une bio !`
      : html`Un·e aventurier·e de <em>${user.city || "la taverne"}</em>.`;

    mount(el, html`
      <div class="wrap sheet">
        <!-- Grille bento : identité, caractéristiques, bio -->
        <section class="sheet__top">
          <div class="bcard sheet__head">
            <div class="sheet__who">
              ${sigil(user, "lg")}
              <div class="sheet__id">
                <span class="bcard__eyebrow">Fiche de personnage</span>
                <h1>${user.full_name || "Joueur"}</h1>
                <div class="sheet__meta">
                  ${user.city ? html`<span>${icon("pin")} ${user.city}</span>` : ""}
                  <span>${levelPip(lvl)} ${lvl}</span>
                </div>
              </div>
            </div>
            ${(user.favorite_formats || []).length ? html`<div class="bpills">${user.favorite_formats.map((f) => html`<span class="bpill">${f}</span>`)}</div>` : ""}
            <div class="sheet__actions">
              ${isMe
                ? html`<button type="button" class="btn btn--gold btn--sm" data-edit>${icon("edit")} Modifier ma fiche</button>
                       <button type="button" class="btn btn--ghost btn--sm" data-logout>${icon("logout")} Déconnexion</button>`
                : meNow ? html`<a class="btn btn--primary btn--sm" href="#/messages/${user.id}">${icon("scroll")} Missive</a>${friendBtn}`
                : html`<a class="btn btn--sm" href="#/connexion">Se connecter pour contacter</a>`}
            </div>
          </div>

          <div class="bcard sheet__s1"><span class="bcard__num tnum">${history.length}</span><span class="bcard__label">${history.length > 1 ? "parties" : "partie"} <strong>jouée${history.length > 1 ? "s" : ""}</strong></span><span class="sheet__mod">XP</span></div>
          <div class="bcard sheet__s2"><span class="bcard__num sheet__word">${lvl}</span><span class="bcard__label">niveau <strong>global</strong></span><span class="sheet__mod">${levelMeta(lvl).mod}</span></div>
          <div class="bcard sheet__s3"><span class="bcard__num tnum">${organised.length}</span><span class="bcard__label">${organised.length > 1 ? "parties" : "partie"} <strong>organisée${organised.length > 1 ? "s" : ""}</strong></span><span class="sheet__mod">MJ</span></div>
          <div class="bcard sheet__s4"><span class="bcard__num tnum">${upcoming.length}</span><span class="bcard__label"><strong>à venir</strong></span><span class="sheet__mod">⚔</span></div>

          <div class="bcard b-quote sheet__bio">
            <p class="b-quote__text">${bio}</p>
            <p class="b-quote__by">${user.full_name || "Joueur"}</p>
          </div>
        </section>

        <!-- Les listes, chacune dans sa carte -->
        <section class="sheet__lists">
          ${incoming.length ? html`
            <div class="bcard sheet__card">
              <h2>${icon("user-plus")} Demandes d'amis</h2>
              <div class="mini-list">${incoming.map((f) => html`
                <div class="request">
                  ${sigil({ id: f.requester_id, full_name: f.requester_name })}
                  <div class="request__who"><p><a class="link" href="#/profil/${f.requester_id}">${f.requester_name}</a></p><p>Veut être votre compagnon d'armes</p></div>
                  <button type="button" class="btn btn--sm btn--gold" data-friend-accept="${f.id}">${icon("check")} Accepter</button>
                  <button type="button" class="btn btn--sm btn--icon" data-friend-decline="${f.id}" aria-label="Refuser">${icon("x")}</button>
                </div>`)}</div>
            </div>` : ""}

          ${listSection("calendar", "Parties à venir", upcoming)}
          ${listSection("swords", "Historique", history)}
          ${organised.length ? listSection("crown", "Parties organisées", organised.sort((a, b) => new Date(b.date) - new Date(a.date))) : ""}

          ${mates.length ? html`
            <div class="bcard sheet__card">
              <h2>${icon("users")} Compagnons (${mates.length})</h2>
              <div class="friends-strip">${mates.map((u) => html`<a class="friend-chip" href="#/profil/${u.id}" title="${u.full_name}">${sigil(u)}<span>${u.full_name}</span></a>`)}</div>
            </div>` : ""}

          ${!all.length ? html`
            <div class="bcard sheet__card empty">
              <svg class="empty__icon"><use href="#i-scroll"/></svg>
              <h3>Aucune partie pour le moment.</h3>
              ${isMe ? html`<p>Rejoignez ou organisez une partie pour remplir votre historique !</p><a class="btn btn--primary" href="#/parties">${icon("swords")} Trouver une table</a>` : ""}
            </div>` : ""}
        </section>

        ${isMe ? html`
          <!-- Exigé par l'App Store et le Play Store : supprimer son compte depuis l'app -->
          <section class="danger" aria-labelledby="danger-title">
            <div class="danger__text">
              <h2 id="danger-title">${icon("trash")} Supprimer mon compte</h2>
              <p>Votre fiche, vos parties organisées, vos inscriptions, vos compagnons et vos missives seront effacés définitivement. Cette action est irréversible.</p>
            </div>
            <button type="button" class="hold" data-hold-delete>
              <span class="hold__label">${icon("trash")} Maintenir pour supprimer</span>
              <span class="hold__fill" aria-hidden="true">${icon("trash")} Maintenir pour supprimer</span>
            </button>
          </section>` : ""}
      </div>`);

    // Suppression du compte : il faut maintenir le bouton 1,6 s (rien ne part sur un simple clic)
    const del = $("[data-hold-delete]", el);
    if (del) {
      offHold?.();
      offHold = holdToConfirm(del, {
        duration: 1600,
        resetAfter: 0,
        confirmed: "Suppression…",
        onConfirm: async () => {
          del.disabled = true;
          try {
            await db.auth.deleteAccount();
            toast("Compte supprimé", "Toutes vos données ont été effacées. Au revoir, voyageur·se.");
            location.hash = "#/";
          } catch (ex) {
            toast.error("Suppression impossible", ex.message);
            draw();
          }
        },
      });
    }
  };

  let offHold = null;
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
    <div class="bcard sheet__card">
      <h2>${icon(ic)} ${title}</h2>
      <div class="mini-list">${items.map((p) => html`
        <a class="mini" href="#/partie/${p.id}">
          <span class="mini__date"><strong class="tnum">${fmtDay(p.date)}</strong>${fmtMonth(p.date)}</span>
          <span class="mini__body"><p title="${p.title}">${p.title}</p><p>${p.format} · ${p.city} · ${fmtTime(p.date)}</p></span>
          <span class="mini__count tnum">${p.current_players}/${p.max_players}</span>
        </a>`)}</div>
    </div>`;
}
