/* =====================================================================
   PROFIL — gabarit Instagram : avatar + chiffres, nom, bio, boutons,
   puis les parties en onglets (à venir · historique · organisées)
   ===================================================================== */
import { $, html, icon, mount } from "../lib/dom.js?v=202611141805";
import { fmtDay, fmtMonth, fmtTime, levelPip, sigil } from "../lib/format.js?v=202611141805";
import { db } from "../data/index.js?v=202611141805";
import { openEditProfile } from "../ui/forms.js?v=202611141805";
import { toast } from "../ui/toast.js?v=202611141805";
import { holdToConfirm } from "../ui/hold.js?v=202611141805";

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
    return { user, hosted, joined, friends };
  };

  let data;
  try { data = await load(); } catch (e) { toast.error("Profil illisible", e.message); return; }
  if (!el.isConnected) return;

  const draw = () => {
    const { user, hosted, joined, friends } = data;
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

    // relation entre moi et ce profil
    const rel = meNow && !isMe ? friends.find((f) => (f.requester_id === meNow.id && f.receiver_id === user.id) || (f.requester_id === user.id && f.receiver_id === meNow.id)) : null;
    const contacts = isMe ? friends.filter((f) => f.status === "accepted").length : 0;
    const incoming = isMe ? friends.filter((f) => f.status === "pending" && f.receiver_id === user.id).length : 0;

    // Boutons façon Instagram : gris, même largeur, côte à côte
    let actions;
    if (isMe) {
      actions = html`
        <button type="button" class="ig-btn" data-edit>Modifier le profil</button>
        <button type="button" class="ig-btn" data-logout>Déconnexion</button>`;
    } else if (meNow) {
      let relBtn;
      if (!rel) relBtn = html`<button type="button" class="ig-btn ig-btn--primary" data-friend-add>Ajouter</button>`;
      else if (rel.status === "accepted") relBtn = html`<span class="ig-btn ig-btn--static">${icon("check")} Contact</span>`;
      else if (rel.requester_id === meNow.id) relBtn = html`<button type="button" class="ig-btn" data-friend-decline="${rel.id}">Demande envoyée</button>`;
      else relBtn = html`<button type="button" class="ig-btn ig-btn--primary" data-friend-accept="${rel.id}">Accepter</button><button type="button" class="ig-btn ig-btn--icon" data-friend-decline="${rel.id}" aria-label="Refuser">${icon("x")}</button>`;
      actions = html`${relBtn}<a class="ig-btn" href="#/messages/${user.id}">Missive</a>`;
    } else {
      actions = html`<a class="ig-btn ig-btn--primary" href="#/connexion?retour=${encodeURIComponent("#/profil/" + user.id)}">Se connecter pour contacter</a>`;
    }

    const stat = (n, one, other, href) => {
      const inner = html`<strong class="tnum">${n}</strong><span>${n > 1 ? other : one}</span>`;
      return href ? html`<li><a href="${href}">${inner}</a></li>` : html`<li>${inner}</li>`;
    };

    const bio = user.bio
      ? html`<p class="ig__bio-text">${user.bio}</p>`
      : html`<p class="ig__bio-text ig__bio-text--empty">${isMe ? "Présentez-vous en quelques mots : vos decks, vos formats, vos disponibilités." : "Pas encore de bio."}</p>`;

    // Les listes en onglets, comme la grille de publications d'Instagram
    const tabs = [
      { id: "avenir", ic: "calendar", label: "À venir", items: upcoming },
      { id: "historique", ic: "swords", label: "Historique", items: history },
      { id: "organisees", ic: "crown", label: "Organisées", items: [...organised].sort((a, b) => new Date(b.date) - new Date(a.date)) },
    ];
    const active = tabs.find((t) => t.id === currentTab) || tabs[0];

    mount(el, html`
      <div class="wrap sheet">
        <section class="ig" aria-label="Profil de ${user.full_name || "Joueur"}">
          <div class="ig__avatar">${sigil(user, "xl")}</div>
          <div class="ig__main">
            <h1 class="ig__name">${user.full_name || "Joueur"}</h1>
            <ul class="ig__stats" role="list">
              ${stat(history.length, "partie jouée", "parties jouées")}
              ${stat(organised.length, "organisée", "organisées")}
              ${isMe ? stat(contacts, "contact", "contacts", "#/social") : stat(upcoming.length, "à venir", "à venir")}
            </ul>
          </div>
          <div class="ig__info">
            <p class="ig__meta">
              <span>${levelPip(lvl)} ${lvl}</span>
              ${user.city ? html`<span>${icon("pin")} ${user.city}</span>` : ""}
            </p>
            ${(user.favorite_formats || []).length ? html`<p class="ig__formats">${user.favorite_formats.join(" · ")}</p>` : ""}
            <div class="ig__bio">
              <h2 class="ig__label">Bio</h2>
              ${bio}
            </div>
          </div>
          <div class="ig__actions">${actions}</div>
          ${incoming ? html`<a class="ig__notice" href="#/social">${icon("user-plus")} ${incoming > 1 ? `${incoming} demandes de contact` : "1 demande de contact"} en attente <span aria-hidden="true">›</span></a>` : ""}
        </section>

        <section class="ig-tabs">
          <div class="ig-tabs__bar" role="tablist" aria-label="Parties">
            ${tabs.map((t) => html`
              <button type="button" role="tab" class="ig-tabs__tab" id="tab-${t.id}" data-tab="${t.id}" aria-selected="${t === active}" aria-controls="panel-${t.id}" tabindex="${t === active ? 0 : -1}">
                ${icon(t.ic)}<span>${t.label}</span>
              </button>`)}
          </div>
          ${tabs.map((t) => html`
            <div class="ig-tabs__panel" role="tabpanel" id="panel-${t.id}" aria-labelledby="tab-${t.id}" ${t === active ? "" : "hidden"}>
              ${t.items.length ? miniList(t.items) : html`
                <div class="ig-empty">
                  ${icon(t.ic, "ig-empty__icon")}
                  <p>${emptyText(t.id, isMe)}</p>
                  ${isMe && t.id !== "historique" ? html`<a class="ig-btn ig-btn--primary" href="#/parties">Trouver une table</a>` : ""}
                </div>`}
            </div>`)}
        </section>

        ${isMe ? html`
          <!-- Exigé par l'App Store et le Play Store : supprimer son compte depuis l'app -->
          <section class="danger" aria-labelledby="danger-title">
            <div class="danger__text">
              <h2 id="danger-title">${icon("trash")} Supprimer mon compte</h2>
              <p>Votre profil, vos parties organisées, vos inscriptions, vos contacts et vos missives seront effacés définitivement. Cette action est irréversible.</p>
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
  let currentTab = null;
  draw();

  el.addEventListener("click", async (e) => {
    const t = e.target;
    const tab = t.closest("[data-tab]");
    if (tab) { selectTab(tab); return; }
    try {
      if (t.closest("[data-edit]")) openEditProfile(db.auth.user(), { onSaved: async () => { data = await load(); draw(); } });
      else if (t.closest("[data-logout]")) { await db.auth.signOut(); toast("À bientôt, aventurier·e", "Vous êtes déconnecté·e."); location.hash = "#/"; }
      else if (t.closest("[data-friend-add]")) { await db.friendships.request(userId); toast.success("Demande envoyée", "Un corbeau porte votre proposition d'alliance."); data = await load(); draw(); }
      else if (t.closest("[data-friend-accept]")) { await db.friendships.accept(t.closest("[data-friend-accept]").dataset.friendAccept); toast.success("Nouveau contact !", "Vous êtes désormais en contact."); data = await load(); draw(); }
      else if (t.closest("[data-friend-decline]")) { await db.friendships.remove(t.closest("[data-friend-decline]").dataset.friendDecline); data = await load(); draw(); }
    } catch (ex) { toast.error("Oups", ex.message); }
  });

  // Onglets : flèches gauche/droite au clavier (motif ARIA « tabs »)
  el.addEventListener("keydown", (e) => {
    const tab = e.target.closest?.("[data-tab]");
    if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const all = [...el.querySelectorAll("[data-tab]")];
    const i = all.indexOf(tab);
    const next = e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + all.length) % all.length;
    e.preventDefault();
    selectTab(all[next]);
    all[next].focus();
  });

  function selectTab(tab) {
    currentTab = tab.dataset.tab;
    el.querySelectorAll("[data-tab]").forEach((b) => {
      const on = b === tab;
      b.setAttribute("aria-selected", on);
      b.tabIndex = on ? 0 : -1;
      el.querySelector("#" + b.getAttribute("aria-controls")).hidden = !on;
    });
  }

  return db.on(async () => { if (el.isConnected) { data = await load().catch(() => data); draw(); } });
}

function miniList(items) {
  return html`
    <div class="mini-list">${items.map((p) => html`
      <a class="mini" href="#/partie/${p.id}">
        <span class="mini__date"><strong class="tnum">${fmtDay(p.date)}</strong>${fmtMonth(p.date)}</span>
        <span class="mini__body"><p title="${p.title}">${p.title}</p><p>${p.format} · ${p.city} · ${fmtTime(p.date)}</p></span>
        <span class="mini__count tnum">${p.current_players}/${p.max_players}</span>
      </a>`)}</div>`;
}

function emptyText(id, isMe) {
  if (id === "avenir") return isMe ? "Aucune partie à venir. Rejoignez une table !" : "Aucune partie à venir.";
  if (id === "historique") return isMe ? "Votre historique se remplira après vos premières parties." : "Aucune partie jouée pour l'instant.";
  return isMe ? "Vous n'avez pas encore organisé de partie." : "Aucune partie organisée.";
}
