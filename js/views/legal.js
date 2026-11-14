/* =====================================================================
   PAGES LÉGALES
   - #/confidentialite        Politique de confidentialité (lien exigé par
                              l'App Store et le Play Store), en bref
   - #/donnees-personnelles   Le détail RGPD + vos données en un clic
                              (modifier, télécharger, supprimer)
   - #/mentions-legales       Mentions légales (LCEN)
   Modèle : les pages équivalentes du site Unemployed Staff.
   ===================================================================== */
import { $, html, icon, mount } from "../lib/dom.js?v=202611141815";
import { CONFIG } from "../config.js?v=202611141815";
import { db } from "../data/index.js?v=202611141815";
import { downloadBlob } from "../lib/calendar.js?v=202611141815";
import { toast } from "../ui/toast.js?v=202611141815";

const UPDATED = "12 novembre 2026";
const EDITOR = "Anthony Peyronin";

/** Adresse de contact (CONFIG.CONTACT_EMAIL) ; tant qu'elle manque, un repère visible */
const contact = () => CONFIG.CONTACT_EMAIL
  ? html`<a class="link" href="mailto:${CONFIG.CONTACT_EMAIL}">${CONFIG.CONTACT_EMAIL}</a>`
  : html`<span class="todo">[adresse email à compléter]</span>`;

function page(el, { eyebrow, title, intro, body, others }) {
  mount(el, html`
    <article class="legal wrap">
      <a class="back" href="#/">${icon("back")} Retour à la taverne</a>
      <header class="legal__head">
        <p class="legal__eyebrow">${eyebrow}</p>
        <h1>${title}</h1>
        <p class="legal__date">Dernière mise à jour : ${UPDATED}</p>
        ${intro ? html`<p class="legal__intro">${intro}</p>` : ""}
      </header>
      <div class="legal__body">${body}</div>
      <nav class="legal__others" aria-label="Autres pages légales">
        ${others.map(([href, label]) => html`<a class="link" href="${href}">${label}</a>`)}
      </nav>
    </article>`);
}

/* ---------------------------------------------------------------------
   Politique de confidentialité : l'essentiel en une page
   --------------------------------------------------------------------- */
export function renderConfidentialite(el) {
  page(el, {
    eyebrow: "Gathirl · site et application",
    title: "Politique de confidentialité",
    intro: "Gathirl sert à trouver des joueurs et des parties près de chez vous. Nous ne collectons que ce qu'il faut pour ça, nous ne vendons rien, et vous pouvez tout supprimer vous-même en un geste.",
    others: [["#/donnees-personnelles", "Données personnelles (le détail)"], ["#/mentions-legales", "Mentions légales"]],
    body: html`
      <h2>En bref</h2>
      <ul class="legal__list">
        <li><strong>Pas de publicité, pas de mesure d'audience, pas de revente</strong> de vos données. Aucun cookie de suivi.</li>
        <li><strong>Pas de géolocalisation</strong> de votre appareil : seule la ville que vous indiquez sert à calculer les distances.</li>
        <li><strong>Votre fiche et vos parties sont publiques</strong> (c'est le but : être trouvé). Vos missives et vos compagnons ne sont visibles que des personnes concernées.</li>
        <li><strong>Vous gardez la main</strong> : modifier votre fiche, télécharger vos données et supprimer votre compte, directement depuis l'application.</li>
      </ul>

      <h2>Les données utilisées</h2>
      <div class="legal__table" role="region" aria-label="Données utilisées" tabindex="0">
        <table>
          <thead><tr><th>Donnée</th><th>Pourquoi</th><th>Qui la voit</th></tr></thead>
          <tbody>
            <tr><td>Email, mot de passe (chiffré) ou compte Google, Apple, Discord, GitHub, Twitch</td><td>Vous connecter</td><td>Personne d'autre que vous</td></tr>
            <tr><td>Nom d'aventurier, ville, niveau, formats préférés, bio, photo</td><td>Votre fiche, pour que les joueurs vous trouvent</td><td>Tous les visiteurs</td></tr>
            <tr><td>Parties organisées (titre, date, lieu, description) et inscriptions</td><td>Organiser et rejoindre des parties</td><td>Tous les visiteurs</td></tr>
            <tr><td>Demandes et liste de compagnons</td><td>Retrouver vos partenaires de jeu</td><td>Vous et la personne concernée</td></tr>
            <tr><td>Missives (messages privés)</td><td>Échanger avec un joueur</td><td>L'expéditeur et le destinataire</td></tr>
            <tr><td>Adresse IP et journaux techniques</td><td>Sécurité et bon fonctionnement</td><td>Nos hébergeurs, à des fins techniques</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Où vont vos données</h2>
      <p>Vos données sont stockées chez <strong>Supabase</strong> (base de données et connexion). Le site est hébergé par <strong>GitHub Pages</strong>. Ces deux prestataires sont des sociétés américaines : le transfert est encadré par les garanties prévues par le RGPD. Le détail de chaque service se trouve sur la page <a class="link" href="#/donnees-personnelles">Données personnelles</a>.</p>

      <h2>Supprimer votre compte</h2>
      <p>Dans <a class="link" href="#/profil">Ma fiche</a>, en bas de page, maintenez le bouton <strong>« Maintenir pour supprimer »</strong>. Votre compte, votre fiche, vos parties organisées, vos inscriptions, vos compagnons et vos missives sont effacés immédiatement et définitivement. Vous pouvez aussi en faire la demande par email : ${contact()}.</p>

      <h2>Âge minimum</h2>
      <p>Gathirl s'adresse aux personnes de <strong>15 ans et plus</strong>. Les parties se jouant en personne, nous recommandons aux plus jeunes de s'y rendre accompagnés.</p>

      <h2>Contact</h2>
      <p>Responsable du traitement : ${EDITOR}, éditeur de Gathirl. Pour toute question : ${contact()}. Vous pouvez aussi saisir la <a class="link" href="https://www.cnil.fr" target="_blank" rel="noopener">CNIL</a>.</p>`,
  });
}

/* ---------------------------------------------------------------------
   Données personnelles : le détail (modèle Unemployed Staff) + actions
   --------------------------------------------------------------------- */
export function renderDonnees(el) {
  const me = db.auth.user();
  page(el, {
    eyebrow: "RGPD",
    title: "Données personnelles",
    others: [["#/confidentialite", "Politique de confidentialité (en bref)"], ["#/mentions-legales", "Mentions légales"]],
    body: html`
      <section class="legal__actions" aria-label="Vos données en un clic">
        <h2>Vos données en un clic</h2>
        ${me ? html`
          <div class="legal__btns">
            <a class="btn btn--sm" href="#/profil">${icon("edit")} Modifier ma fiche</a>
            <button type="button" class="btn btn--sm" data-export>${icon("download")} Télécharger mes données</button>
            <a class="btn btn--sm btn--ghost" href="#/profil">${icon("trash")} Supprimer mon compte</a>
          </div>
          <p class="legal__note">Le téléchargement contient votre fiche, vos parties, vos inscriptions, vos compagnons et vos missives, au format JSON (lisible par n'importe quel logiciel).</p>`
        : html`<p>Connectez-vous pour modifier, télécharger ou supprimer vos données. <a class="link" href="#/connexion?retour=${encodeURIComponent("#/donnees-personnelles")}">Se connecter</a></p>`}
      </section>

      <h2>1. Qui est responsable de vos données ?</h2>
      <p>Le responsable du traitement est ${EDITOR}, éditeur de Gathirl. Contact : ${contact()}.</p>

      <h2>2. Quelles données, pourquoi, et sur quelle base ?</h2>
      <p><strong>Compte.</strong> Adresse email et mot de passe (stocké chiffré, jamais lisible), ou l'identifiant de votre compte Google, Apple, Discord, GitHub ou Twitch si vous choisissez de vous connecter avec. Ce fournisseur nous transmet alors votre adresse email, votre nom et, le cas échéant, votre photo de profil. Finalité : vous connecter et sécuriser votre compte. Base légale : l'exécution du service que vous demandez.</p>
      <p><strong>Fiche de joueur.</strong> Nom d'aventurier, ville (et ses coordonnées approximatives, pour calculer les distances), niveau, formats préférés, présentation, photo. Finalité : vous présenter aux autres joueurs et permettre de vous trouver. Base légale : l'exécution du service ; ces informations sont fournies volontairement par vous.</p>
      <p><strong>Parties et inscriptions.</strong> Titre, format, niveau, date, lieu (nom, adresse, coordonnées), description, nombre de places, liste des inscrits. Finalité : organiser et rejoindre des parties. Base légale : l'exécution du service.</p>
      <p><strong>Compagnons et missives.</strong> Demandes d'amis, liste de compagnons, messages privés (texte, date, lu ou non). Finalité : vous permettre d'échanger avec d'autres joueurs. Base légale : l'exécution du service.</p>
      <p><strong>Données techniques.</strong> Un jeton de session est conservé sur votre appareil (stockage local) pour que vous restiez connecté. Nos hébergeurs enregistrent des journaux techniques (adresse IP, date, page demandée). Finalité : sécurité et bon fonctionnement. Base légale : notre intérêt légitime à protéger le service.</p>
      <p><strong>Ce que nous ne faisons pas.</strong> Pas de géolocalisation de votre appareil, pas de publicité, pas de mesure d'audience, pas de profilage, pas de revente. Le billet d'une partie et le fichier d'agenda sont fabriqués sur votre appareil : rien n'est envoyé.</p>

      <h2>3. Combien de temps ?</h2>
      <p>Vos données sont conservées tant que votre compte existe. Quand vous le supprimez (bouton « Maintenir pour supprimer » dans Ma fiche, ou sur demande par email), le compte et tout ce qui s'y rattache sont effacés immédiatement et définitivement. Les journaux techniques de nos hébergeurs sont conservés pendant la durée prévue par ces prestataires, à des fins de sécurité.</p>

      <h2>4. Qui reçoit ces données ?</h2>
      <p>Votre fiche, vos parties et la liste des inscrits sont <strong>publiques</strong> : toute personne qui visite Gathirl peut les consulter. Vos compagnons ne sont visibles que de vous et de la personne concernée ; vos missives, que de l'expéditeur et du destinataire. Les missives ne sont pas chiffrées de bout en bout : elles restent techniquement accessibles à l'éditeur et à son hébergeur, qui ne les consultent pas, sauf obligation légale ou signalement d'un abus.</p>
      <p>Nos prestataires, qui traitent les données pour notre compte :</p>
      <ul class="legal__list">
        <li><strong>Supabase, Inc.</strong> : base de données, connexion et envoi des emails de compte.</li>
        <li><strong>GitHub, Inc.</strong> (GitHub Pages) : hébergement du site.</li>
      </ul>
      <p>Ces sociétés sont établies aux États-Unis, ce qui peut impliquer un transfert de données hors de l'Union européenne, encadré par les garanties prévues par le RGPD (clauses contractuelles types et cadre de protection des données UE–États-Unis).</p>

      <h2>5. Cookies et services tiers</h2>
      <p>Gathirl n'utilise <strong>aucun cookie de suivi</strong> ni outil de mesure d'audience. Pour fonctionner, il fait appel à quelques services, qui reçoivent alors votre adresse IP :</p>
      <ul class="legal__list">
        <li><strong>Google Fonts</strong> (Google) : affichage des polices Fraunces, Spectral, Space Mono et Grenze Gotisch.</li>
        <li><strong>jsDelivr</strong> : chargement de la bibliothèque qui relie l'application à la base de données.</li>
        <li><strong>Photon</strong> (Komoot, Allemagne), données OpenStreetMap : suggestions d'adresses quand vous saisissez une ville ou un lieu. Le texte saisi lui est envoyé.</li>
        <li><strong>OpenStreetMap</strong> : uniquement si vous ouvrez le lien « Carte » d'une partie.</li>
        <li><strong>Google, Apple, Discord, GitHub, Twitch</strong> : uniquement si vous choisissez de vous connecter avec l'un d'eux. Chacun applique sa propre politique de confidentialité.</li>
        <li><strong>App Store (Apple) et Google Play</strong> : si vous installez l'application, la boutique traite les données liées au téléchargement selon ses propres règles.</li>
      </ul>

      <h2>6. Vos droits</h2>
      <p>Vous pouvez accéder à vos données, les rectifier, les effacer, en limiter le traitement ou vous y opposer, les récupérer (portabilité) et retirer votre consentement à tout moment. La plupart de ces droits s'exercent directement dans l'application (voir « Vos données en un clic » ci-dessus). Pour le reste, écrivez à ${contact()} : nous répondons dans un délai d'un mois.</p>
      <p>Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la CNIL : <a class="link" href="https://www.cnil.fr" target="_blank" rel="noopener">cnil.fr</a>.</p>`,
  });

  $("[data-export]", el)?.addEventListener("click", (e) => exportMyData(e.currentTarget));
}

/** Portabilité : tout ce qui concerne le joueur connecté, dans un fichier JSON */
async function exportMyData(btn) {
  const me = db.auth.user();
  if (!me) return;
  btn.disabled = true;
  try {
    const [profile, hosted, participations, friendships, messages] = await Promise.all([
      db.profiles.get(me.id),
      db.parties.forHost(me.id),
      db.participations.forUser(me.id),
      db.friendships.forUser(me.id),
      db.messages.mine().catch(() => []),
    ]);
    const data = {
      export: { service: "Gathirl", date: new Date().toISOString(), compte: me.id },
      fiche: profile, parties_organisees: hosted, inscriptions: participations,
      compagnons: friendships, missives: messages,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    await downloadBlob(blob, `gathirl-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`);
    toast.success("Données prêtes", "Le fichier contient votre fiche, vos parties, vos compagnons et vos missives.");
  } catch (ex) {
    toast.error("Téléchargement impossible", ex.message);
  } finally {
    btn.disabled = false;
  }
}

/* ---------------------------------------------------------------------
   Mentions légales (modèle Unemployed Staff)
   --------------------------------------------------------------------- */
export function renderMentions(el) {
  page(el, {
    eyebrow: "Informations légales",
    title: "Mentions légales",
    others: [["#/confidentialite", "Politique de confidentialité"], ["#/donnees-personnelles", "Données personnelles"]],
    body: html`
      <h2>1. Éditeur du site</h2>
      <p>Le site et l'application « Gathirl » sont édités par ${EDITOR}, statut : particulier.</p>
      <p>Email : ${contact()}</p>
      <p>Directeur de la publication : ${EDITOR}.</p>

      <h2>2. Hébergement</h2>
      <p>Le site est hébergé par <strong>GitHub, Inc.</strong> (service GitHub Pages), 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis. Site : github.com.</p>
      <p>Les données des comptes sont hébergées par <strong>Supabase, Inc.</strong> Site : supabase.com.</p>

      <h2>3. Objet du site</h2>
      <p>Gathirl permet de trouver des joueurs et des parties de <em>Magic: The Gathering</em> près de chez soi, d'organiser des parties et d'échanger entre joueurs. Les parties se déroulent en personne, sous la responsabilité de leurs participants : Gathirl n'est pas partie aux rencontres organisées et n'est pas responsable de leur déroulement.</p>

      <h2>4. Contenus publiés par les joueurs</h2>
      <p>Les fiches, parties et missives sont rédigées par les joueurs, qui sont responsables de leur contenu et de leur exactitude. Tout contenu illicite ou inapproprié peut être signalé à ${contact()} : il sera examiné et, le cas échéant, retiré. Chacun peut modifier ou supprimer sa fiche et son compte à tout moment depuis « Ma fiche ».</p>

      <h2>5. Propriété intellectuelle</h2>
      <p>La structure du site, son identité visuelle (logo, charte graphique, illustrations), ses textes, son univers (l'Oracle, le lore du Gathirl) et son code sont protégés. Toute reproduction sans autorisation est interdite.</p>
      <p>Gathirl est un projet de fan, non officiel, non affilié à Wizards of the Coast. <em>Magic: The Gathering</em> et <em>Dungeons &amp; Dragons</em> sont des marques de Wizards of the Coast LLC, citées ici uniquement pour désigner les jeux pratiqués.</p>

      <h2>6. Responsabilité et liens externes</h2>
      <p>Les informations du site sont données à titre indicatif, sans garantie de disponibilité ni d'exhaustivité. Le site contient des liens vers des services tiers (OpenStreetMap, fournisseurs de connexion). Leur contenu ne relève pas de la responsabilité de l'éditeur.</p>

      <h2>7. Données personnelles</h2>
      <p>Le traitement des données personnelles est détaillé sur les pages <a class="link" href="#/confidentialite">Politique de confidentialité</a> et <a class="link" href="#/donnees-personnelles">Données personnelles</a>.</p>

      <h2>8. Droit applicable</h2>
      <p>Le présent site est soumis au droit français. En cas de litige, les tribunaux français sont compétents, sous réserve des règles impératives applicables.</p>`,
  });
}
