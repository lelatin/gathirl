/* =====================================================================
   LA QUÊTE — détail d'une partie
   ===================================================================== */
import { $, html, icon, mount } from "../lib/dom.js";
import { artFor, fmtDateLong, fmtTime, initial, manaCost, plural, sigil, fmtCountdown } from "../lib/format.js";
import { osmLink } from "../lib/geo.js";
import { db } from "../data/index.js";
import { toast } from "../ui/toast.js";
import { downloadIcs } from "../lib/calendar.js";
import { ticketFor, saveTicket, ticketTilt, lastTicket } from "../ui/ticket.js";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

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

    let cta;
    if (cancelled) cta = html`<p class="tag tag--blood" style="justify-content:center;padding:12px">Partie annulée</p>`;
    else if (past) cta = html`<p class="tag" style="justify-content:center;padding:12px">Cette partie a déjà eu lieu</p>`;
    else if (isHost) cta = html`<p class="tag tag--gold" style="justify-content:center;padding:12px">${icon("crown")} Vous organisez cette partie</p>
      <button type="button" class="btn btn--ghost btn--block btn--sm" data-cancel>Annuler la partie</button>`;
    else if (joined) cta = html`<p class="tag tag--gold" style="justify-content:center;padding:12px">${icon("check")} Vous êtes inscrit·e</p>
      <button type="button" class="btn btn--ghost btn--block btn--sm" data-leave>Se désister</button>`;
    else if (full) cta = html`<button type="button" class="btn btn--block" disabled>Cette partie est complète</button>`;
    else cta = html`<button type="button" class="btn btn--primary btn--block" data-join>${icon("swords")} Rejoindre la partie</button>`;

    mount(el, html`
      <div class="wrap">
        <a class="back" href="#/parties">${icon("back")} Tableau des quêtes</a>

        <div class="quest">
          <div class="quest__main">
            <div class="quest__banner print">
              <img src="${artFor(p.id)}" alt="" width="720" height="540" />
              <div class="quest__banner-text">
                <div class="quest__tags">
                  <span class="tag tag--gold">${p.format}</span>
                  <span class="tag" style="background:rgb(14 10 19 / .7)">${manaCost(p.level)} ${p.level}</span>
                  ${full ? html`<span class="tag tag--blood">Complet</span>` : ""}
                </div>
                <h1>${p.title}</h1>
              </div>
            </div>

            <div class="quest__facts">
              <div class="fact">
                <span class="fact__label">${icon("calendar")} Date</span>
                <span class="fact__value tnum">${cap(fmtDateLong(p.date))}<small>à ${fmtTime(p.date)} · ${fmtCountdown(p.date)}</small></span>
              </div>
              <div class="fact">
                <span class="fact__label">${icon("pin")} Lieu</span>
                <span class="fact__value">${p.location || p.city}<small>${p.location_address || p.city}</small>
                  ${p.location_lat ? html`<a class="link" style="font-size:14px" href="${osmLink(p.location_lat, p.location_lng)}" target="_blank" rel="noopener">Voir sur la carte ↗</a>` : ""}
                </span>
              </div>
              <div class="fact">
                <span class="fact__label">${icon("users")} Joueurs</span>
                <span class="fact__value tnum">${p.current_players} / ${p.max_players}<small>${full ? "Table complète" : plural(left, "place restante", "places restantes")}</small></span>
              </div>
            </div>

            ${p.description ? html`<div class="quest__desc"><h2>Le parchemin de l'organisateur·rice</h2><p>${p.description}</p></div>` : ""}
          </div>

          <aside class="quest__aside">
            <div class="panel panel--corners">
              <p class="aside-title">Places autour de la table</p>
              <div class="seats" aria-hidden="true">
                ${Array.from({ length: p.max_players }, (_, i) => {
                  const r = roster[i];
                  return r ? html`<span class="seat is-taken" title="${r.user_name}">${initial(r.user_name)}</span>` : html`<span class="seat">·</span>`;
                })}
              </div>
              <p class="seats-caption"><strong class="tnum">${p.current_players}/${p.max_players}</strong> · ${full ? "complet" : plural(left, "siège libre", "sièges libres")}</p>
              <div style="display:grid;gap:8px;margin-top:16px">${cta}</div>
            </div>

            ${!cancelled && !past ? html`
              <div class="panel ticket-panel">
                <p class="aside-title">Votre billet</p>
                <div class="ticket" data-ticket-tilt>
                  <img data-ticket-img width="360" height="450" alt="Billet Gathirl de la partie « ${p.title} » : ${fmtDateLong(p.date)} à ${fmtTime(p.date)}, ${p.location || p.city}, avec un QR code vers la partie" ${lastTicket(p.id) ? html`src="${lastTicket(p.id).url}"` : "hidden"} />
                </div>
                <div class="ticket-actions">
                  <button type="button" class="btn btn--sm btn--block" data-ticket-dl>${icon("download")} Télécharger le billet</button>
                  <button type="button" class="btn btn--sm btn--ghost btn--block" data-ics>${icon("calendar")} Ajouter à mon calendrier</button>
                </div>
              </div>` : ""}

            <div class="panel" style="padding:20px">
              <p class="aside-title">Organisateur·rice</p>
              <div class="host">
                ${sigil({ id: p.host_id, full_name: p.host_name })}
                <div>
                  <p class="host__name">${p.host_name}</p>
                  <a class="link" href="#/profil/${p.host_id}" style="font-size:14px">Voir le profil →</a>
                </div>
              </div>
              ${me && !isHost ? html`<a class="btn btn--sm btn--block" style="margin-top:14px" href="#/messages/${p.host_id}">${icon("scroll")} Envoyer une missive</a>` : ""}
            </div>

            ${roster.length ? html`
              <div class="panel" style="padding:20px">
                <p class="aside-title">Inscrits (${roster.length})</p>
                <ul class="roster" role="list">
                  ${roster.map((r) => html`<li>${r.user_id?.startsWith?.("ghost") ? html`${sigil({ id: r.id, full_name: r.user_name }, "sm")}<span>${r.user_name}</span>` : html`<a href="#/profil/${r.user_id}">${sigil({ id: r.user_id, full_name: r.user_name }, "sm")}<span>${r.user_name}${r.user_id === p.host_id ? " · hôte" : ""}</span></a>`}</li>`)}
                </ul>
              </div>` : ""}
          </aside>
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
