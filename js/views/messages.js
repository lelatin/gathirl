/* =====================================================================
   MISSIVES — liste des conversations + fil de discussion
   ===================================================================== */
import { $, html, icon, mount } from "../lib/dom.js?v=202611141805";
import { fmtRelative, fmtTime, sigil } from "../lib/format.js?v=202611141805";
import { db } from "../data/index.js?v=202611141805";
import { toast } from "../ui/toast.js?v=202611141805";

function guard() {
  if (db.auth.user()) return true;
  location.replace("#/connexion?retour=" + encodeURIComponent(location.hash));
  return false;
}

/* ---------------------------------------------------------------------
   Liste des conversations
   --------------------------------------------------------------------- */
export async function renderInbox(el) {
  if (!guard()) return;

  let firstDraw = true;
  const draw = async () => {
    const me = db.auth.user();
    const msgs = await db.messages.mine().catch(() => []);
    if (!el.isConnected) return;
    const convos = new Map();
    for (const m of msgs) {
      const mine = m.sender_id === me.id;
      const pid = mine ? m.receiver_id : m.sender_id;
      const name = (mine ? m.receiver_name : m.sender_name) || "Joueur";
      const cur = convos.get(pid);
      const unread = !mine && !m.read ? 1 : 0;
      if (!cur) convos.set(pid, { pid, name, last: m, unread });
      else {
        cur.unread += unread;
        if (new Date(m.created_at) > new Date(cur.last.created_at)) cur.last = m;
      }
    }
    const list = [...convos.values()].sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));

    mount(el, html`
      <div class="wrap inbox">
        <h1>Missives</h1>
        ${list.length ? html`
          <div class="inbox__list ${firstDraw ? "stagger" : ""}">
            ${list.map((c, i) => html`
              <a class="convo ${c.unread ? "is-unread" : ""}" href="#/messages/${c.pid}" style="--i:${Math.min(i, 8)}">
                ${sigil({ id: c.pid, full_name: c.name })}
                <span class="convo__body">
                  <span class="convo__top"><p title="${c.name}">${c.name}</p><time datetime="${c.last.created_at}">${fmtRelative(c.last.created_at)}</time></span>
                  <p class="convo__last">${c.last.sender_id === me.id ? "Vous : " : ""}${c.last.content}</p>
                </span>
                ${c.unread ? html`<span class="dot" aria-label="${c.unread} non lu(s)"></span>` : ""}
              </a>`)}
          </div>` : html`
          <div class="empty" style="margin-top:24px">
            <svg class="empty__icon"><use href="#i-scroll"/></svg>
            <h3>Aucun message</h3>
            <p>Visitez le profil d'un joueur, ou de l'organisateur·rice d'une partie, pour démarrer une conversation.</p>
            <a class="btn" href="#/parties">${icon("swords")} Parcourir les parties</a>
          </div>`}
      </div>`);
    firstDraw = false;   // un nouveau message ne rejoue pas l'animation de toute la liste
  };

  await draw();
  return db.messages.subscribe(() => el.isConnected && draw());
}

/* ---------------------------------------------------------------------
   Fil de discussion avec un joueur
   --------------------------------------------------------------------- */
export async function renderThread(el, ctx) {
  if (!guard()) return;
  const otherId = ctx.params.id;
  const me = db.auth.user();

  if (otherId === me.id) { location.replace("#/messages"); return; }

  const other = await db.profiles.get(otherId).catch(() => null);
  if (!el.isConnected) return;

  mount(el, html`
    <div class="wrap thread">
      <header class="thread__head">
        <a class="thread__back" href="#/messages" aria-label="Retour aux missives">${icon("back")}</a>
        ${sigil(other || { id: otherId, full_name: "?" })}
        <div style="min-width:0">
          <h1 title="${other?.full_name || ""}"><a href="#/profil/${otherId}">${other?.full_name || "Joueur"}</a></h1>
          ${other?.city ? html`<p>${other.city}</p>` : ""}
        </div>
      </header>
      <div class="thread__scroll" data-scroll aria-live="polite"></div>
      <form class="composer" data-composer>
        <label class="sr-only" for="msg">Votre message</label>
        <textarea class="textarea" id="msg" name="msg" rows="1" maxlength="2000" placeholder="Écrivez votre missive…" enterkeyhint="send" autocomplete="off"></textarea>
        <button type="submit" class="btn btn--primary btn--icon" aria-label="Envoyer">${icon("send")}</button>
      </form>
    </div>`);

  const scroller = $("[data-scroll]", el);
  const form = $("[data-composer]", el);
  const input = form.msg;
  const seen = new Set();
  let first = true;

  const draw = async () => {
    const msgs = await db.messages.thread(otherId).catch(() => []);
    if (!el.isConnected) return;
    if (!msgs.length) {
      mount(scroller, html`<div class="empty" style="margin:auto"><h3>Aucun message pour le moment.</h3><p>Envoyez le premier message !</p></div>`);
      return;
    }
    let lastDay = "";
    mount(scroller, html`${msgs.map((m) => {
      const day = new Date(m.created_at).toDateString();
      const sep = day !== lastDay ? html`<p class="thread__day">${new Date(m.created_at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</p>` : "";
      lastDay = day;
      const isNew = !first && !seen.has(m.id);
      seen.add(m.id);
      return html`${sep}<div class="bubble ${m.sender_id === me.id ? "bubble--me" : "bubble--them"} ${isNew ? "is-new" : ""}"><p>${m.content}</p><time datetime="${m.created_at}">${fmtTime(m.created_at)}</time></div>`;
    })}`);
    scroller.scrollTop = scroller.scrollHeight;
    first = false;
    if (msgs.some((m) => m.sender_id === otherId && !m.read)) db.messages.markRead(otherId);
  };

  // Champ qui grandit avec le texte ; Entrée = envoyer, Maj+Entrée = retour à la ligne
  input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 160) + "px"; });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    input.style.height = "auto";
    try { await db.messages.send(otherId, text); await draw(); }
    catch (ex) { input.value = text; toast.error("Erreur", "Impossible d'envoyer le message."); }
    input.focus();
  });

  await draw();
  if (window.matchMedia("(pointer: fine)").matches) input.focus();
  return db.messages.subscribe(() => el.isConnected && draw());
}
