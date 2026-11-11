/* =====================================================================
   LA PARTIE — le billet au centre, et seulement ce qu'il ne dit pas
   ===================================================================== */
import { $, html, icon, mount } from "../lib/dom.js?v=202611120004";
import { fmtDateLong, fmtTime, initial, plural, sigil } from "../lib/format.js?v=202611120004";
import { osmLink } from "../lib/geo.js?v=202611120004";
import { db } from "../data/index.js?v=202611120004";
import { toast } from "../ui/toast.js?v=202611120004";
import { downloadIcs } from "../lib/calendar.js?v=202611120004";
import { ticketFor, saveTicket, ticketTilt, lastTicket } from "../ui/ticket.js?v=202611120004";


export async function render(el, ctx) {
  const id = ctx.params.id;
  mount(el, html`<div class="wrap"><div class="skeleton" style="height:340px;margin-top:64px"></div></div>`);

  const load = async () => {
    const [p, roster] = await Promise.all([db.parties.get(id), db.participations.forPartie(id)]);
    return { p, roster };
  };

  let data;
  try { data = await load(); } catch (e) { data = { p: null, roster: [] }; }
  if (!el.isConnected) return;

  const draw = () => {
    const { p, roster } = data;
    if (!p) {
      mount(el, html`
        <div class="wrap lost">
          <svg class="empty__icon" style="width:72px;height:72px;color:var(--blood)"><use href="#i-skull"/></svg>
          <h1>Partie introuvable</h1>
          <p class="muted">Cette partie n'existe plus ou a été supprimée.</p>
          <a class="btn" href="#/">${icon("back")} Retour à la taverne</a>
        </div>`);
      return;
    }

    const me = db.auth.user();
    const isHost = me && me.id === p.host_id;
    const joined = me && roster.some((r) => r.user_id === me.id);
    const full = p.current_players >= p.max_players;
    const left = p.max_players - p.current_players;
    const past = new Date(p.date) < new Date();
    const cancelled = p.status === "annulé";

    // Action principale, juste sous le billet
    let cta;
    if (cancelled) cta = html`<p class="party__state party__state--off">Partie annulée</p>`;
    else if (past) cta = html`<p class="party__state">Cette partie a déjà eu lieu</p>`;
    else if (isHost) cta = html`<p class="party__state">${icon("crown")} Vous organisez cette partie</p>
      <button type="button" class="btn btn--ghost btn--block btn--sm" data-cancel>Annuler la partie</button>`;
    else if (joined) cta = html`<p class="party__state">${icon("check")} Vous êtes inscrit·e</p>
      <button type="button" class="btn btn--ghost btn--block btn--sm" data-leave>Se désister</button>`;
    else if (full) cta = html`<button type="button" class="btn btn--block" disabled>Cette partie est complète</button>`;
    else cta = html`<button type="button" class="btn btn--primary btn--block" data-join>${icon("swords")} Rejoindre la partie</button>`;

    const live = !cancelled && !past;

    /* Le billet porte déjà titre, format, date, lieu, organisateur·rice et places :
       la page ne les répète pas. À côté, seulement ce que le billet ne dit pas. */
    mount(el, html`
      <div class="wrap">
        <a class="back" href="#/parties">${icon("back")} Toutes les parties</a>
        <h1 class="sr-only">${p.title}</h1>

        <div class="party">
          <div class="party__ticket">
            <div class="ticket ${live ? "" : "is-off"}" data-ticket-tilt>
              <img data-ticket-img width="360" height="450" alt="Billet de la partie « ${p.title} » : ${p.format}, ${p.level}, ${fmtDateLong(p.date)} à ${fmtTime(p.date)}, ${p.location || p.city}, organisée par ${p.host_name}, ${p.current_players} joueurs sur ${p.max_players}, avec un QR code vers la partie" ${lastTicket(p.id) ? html`src="${lastTicket(p.id).url}"` : "hidden"} />
            </div>
            <div class="party__actions">
              ${cta}
              ${live ? html`
                <div class="party__row">
                  <button type="button" class="btn btn--sm" data-ticket-dl>${icon("download")} Billet</button>
                  <button type="button" class="btn btn--sm" data-ics>${icon("calendar")} Agenda</button>
                  ${p.location_lat ? html`<a class="btn btn--sm" href="${osmLink(p.location_lat, p.location_lng)}" target="_blank" rel="noopener">${icon("map")} Carte</a>` : ""}
                </div>` : ""}
            </div>
          </div>

          <div class="party__info">
            <section class="pcard" aria-labelledby="host-title">
              <h2 class="pcard__title" id="host-title">Le mot de l'organisateur·rice</h2>
              <div class="host">
                ${sigil({ id: p.host_id, full_name: p.host_name })}
                <div>
                  <p class="host__name">${p.host_name}</p>
                  <a class="link" href="#/profil/${p.host_id}" style="font-size:14px">Voir le profil →</a>
                </div>
                ${me && !isHost ? html`<a class="btn btn--sm host__msg" href="#/messages/${p.host_id}">${icon("scroll")} Missive</a>` : ""}
              </div>
              <p class="party__desc">${p.description || "Pas de description : écrivez à l'organisateur·rice pour en savoir plus."}</p>
              ${p.location_address ? html`<p class="party__where">${icon("pin")} ${p.location_address}</p>` : ""}
            </section>

            <section class="pcard" aria-labelledby="table-title">
              <h2 class="pcard__title" id="table-title">Autour de la table <span class="tnum">${p.current_players}/${p.max_players}</span></h2>
              <div class="seats" aria-hidden="true">
                ${Array.from({ length: p.max_players }, (_, i) => {
                  const r = roster[i];
                  return r ? html`<span class="seat is-taken" title="${r.user_name}">${initial(r.user_name)}</span>` : html`<span class="seat">·</span>`;
                })}
              </div>
              <p class="seats-caption">${full ? "Table complète" : plural(left, "place libre", "places libres")}</p>
              ${roster.length ? html`
                <ul class="roster" role="list">
                  ${roster.map((r) => html`<li>${r.user_id?.startsWith?.("ghost") ? html`${sigil({ id: r.id, full_name: r.user_name }, "sm")}<span>${r.user_name}</span>` : html`<a href="#/profil/${r.user_id}">${sigil({ id: r.user_id, full_name: r.user_name }, "sm")}<span>${r.user_name}${r.user_id === p.host_id ? " · hôte" : ""}</span></a>`}</li>`)}
                </ul>` : ""}
            </section>
          </div>
        </div>
      </div>`);

    const img = $("[data-ticket-img]", el);
    if (img) {
      ticketFor(p).then((t) => {
        if (!img.isConnected) return;
        // apparition animée seulement la toute première fois ; ensuite on remplace l'image sans bouger
        if (img.hidden) img.classList.add("is-entering");
        if (img.getAttribute("src") !== t.url) img.src = t.url;
        img.hidden = false;
      }).catch(() => {});
    }
  };

  draw();
  const offTilt = ticketTilt(el);

  const act = async (fn, okTitle, okDesc) => {
    try {
      await fn();
      data = await load();
      draw();
      if (okTitle) toast.success(okTitle, okDesc);
    } catch (e) {
      toast.error(e.code === "already" ? "Déjà inscrit" : e.code === "full" ? "Partie complète" : "Oups", e.message);
      data = await load().catch(() => data);
      draw();
    }
  };

  el.addEventListener("click", async (e) => {
    if (e.target.closest("[data-ics]") && data.p) {
      downloadIcs(data.p);
      toast.success("Événement prêt", "Ouvrez le fichier .ics pour l'ajouter à votre calendrier.");
    }
    if (e.target.closest("[data-ticket-dl]") && data.p) {
      try { await saveTicket(data.p); }
      catch { toast.error("Oups", "Le billet n'a pas pu être généré."); }
    }
    if (e.target.closest("[data-join]")) {
      if (!db.auth.user()) {
        location.hash = "#/connexion?retour=" + encodeURIComponent(location.hash);
        return;
      }
      e.target.closest("[data-join]").disabled = true;
      act(() => db.participations.join(id), "Inscrit·e !", "Vous avez rejoint la partie. À bientôt sur le terrain !");
    }
    if (e.target.closest("[data-leave]")) {
      if (!confirm("Libérer votre place à cette table ?")) return;
      act(() => db.participations.leave(id), "Place libérée", "Votre siège est de nouveau disponible.");
    }
    if (e.target.closest("[data-cancel]")) {
      if (!confirm("Annuler définitivement cette partie ? Les inscrits ne pourront plus la rejoindre.")) return;
      act(() => db.parties.cancel(id), "Partie annulée", "Pensez à prévenir vos joueurs par missive.");
    }
  });

  // rafraîchir si quelqu'un rejoint en même temps (temps réel / autre onglet)
  const off = db.on(async () => {
    if (!el.isConnected) return;
    data = await load().catch(() => data);
    draw();
  });
  return () => { off?.(); offTilt(); };
}
