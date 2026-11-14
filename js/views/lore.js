/* =====================================================================
   LE LORE — la mythologie du Gathirl
   Textes tirés du dossier d'origine du projet (« Storytelling Gathirl »)
   et de la charte graphique (« Au début des mondes »), à peine retouchés.
   Page de lecture : chapitres courts, 62 caractères par ligne au plus.
   ===================================================================== */
import { html, icon, mount } from "../lib/dom.js?v=202611141757";

const CHAPTERS = [
  {
    n: "I", id: "commencement", title: "Au commencement",
    body: html`
      <p>Tout commença il y a des temps immémoriaux, lorsque les dieux créèrent le multivers. Ils voulaient un lieu où toutes les créatures pourraient se rencontrer : un lieu de paix et d'échange, un pont entre les mondes et les réalités.</p>
      <p>Ainsi fut créé le <strong>Gathirl, le lieu de tous les lieux</strong>, où des portails s'ouvraient pour permettre aux voyageurs de traverser les dimensions. Les premiers à l'explorer furent les êtres les plus puissants et les plus sages de chaque monde. Ils venaient y partager leur savoir, nouer des alliances, renforcer les liens entre les peuples.</p>
      <p>Avec le temps, le Gathirl devint le lieu de rassemblement de toutes les créatures, des plus nobles aux plus viles. Des aventuriers y cherchaient quêtes et trésors, des marchands y échangeaient des secrets, des mages y étudiaient les arcanes du multivers.</p>`,
  },
  {
    n: "II", id: "nuit", title: "La nuit où tout bascula",
    body: html`
      <p>Mais le Gathirl n'était pas seulement un lieu de rencontre. Les rivalités y menaient parfois à des affrontements sanglants, et bien des héros tombèrent en le protégeant des forces obscures qui cherchaient à le corrompre.</p>
      <p>Les années de paix ne pouvaient pas durer. Il y a des siècles, au cours d'une seule nuit, les forces obscures parvinrent à envahir le Gathirl. <strong>Les portails furent fermés</strong>, isolant le lieu de tous les lieux du reste du multivers, et la terreur se répandit partout où passaient les créatures maléfiques.</p>
      <p>Puis ce monde devint silencieux. Il n'en reste aujourd'hui que des échos : <em>les Échos des combats passés</em>.</p>`,
  },
  {
    n: "III", id: "oracle", title: "L'Oracle, Gardien des Portails", figure: "oracle",
    body: html`
      <p>Certains disent que le Gathirl est vivant, une conscience qui veille sur les voyageurs et les guide dans leur quête. D'autres y voient une manifestation du pouvoir des dieux.</p>
      <p>Une seule chose est sûre : un être est resté pour veiller sur ce qui pourrait advenir du Gathirl. <strong>L'Oracle</strong>, le sage parmi les sages, le voyant parmi les non-voyants, celui qui sait parmi ceux qui ne savent pas encore. Porteur de messages et de visions, c'est lui qui fit fuir les forces obscures.</p>
      <p>Il connaît le passé, le présent et l'avenir. Il sait ce que vous avez, ce qui vous manque, et comment vous le transmettre. Seul capable de voyager à travers les dimensions, il relie les joueurs de <em>Magic</em> et de <em>Donjons &amp; Dragons</em> par ses portails mystiques.</p>`,
  },
  {
    n: "IV", id: "symbole", title: "La Pierre de Convergence", figure: "sigil",
    body: html`
      <p>Un jour, en explorant les profondeurs d'un ancien donjon, l'Oracle découvrit une relique antique : <strong>la Pierre de Convergence</strong>. Elle émettait une aura éblouissante et renfermait une puissance sans égale, celle de créer un passage entre tous les voyageurs.</p>
      <p>De sa magie ancienne, l'Oracle traça les contours d'un symbole. Ses lignes représentent les mystères du plan dimensionnel ; ses formes, la complexité et la stratégie des jeux ; et en son centre, il déposa sa lumière, la passion des voyageurs.</p>
      <p>Puis il leva la Pierre et laissa la magie se répandre à travers tous les portails, pour que chaque voyageur reconnaisse ce symbole et sache qu'il appartient à une communauté extraordinaire. Depuis ce jour, le sceau du Gathirl est un signe de camaraderie, de passion et d'aventure.</p>`,
  },
  {
    n: "V", id: "voyageurs", title: "Les voyageurs",
    body: html`
      <p>Magiciens et aventuriers, ici, vous serez des <strong>voyageurs</strong> : les voyageurs d'entre les mondes, ceux qui cherchent à découvrir, à trouver d'autres voyageurs et à les rencontrer, pour enfin ne plus être seuls.</p>
      <p>Car une nouvelle nuit approche, une nuit qui ira au-delà des mondes, si maléfique que même le feu des torches en deviendrait froid. Ce monde n'est pas pour les faibles de cœur. Mais à ceux qui ont le courage de répondre à l'appel, le Gathirl offre des possibilités infinies et des aventures inoubliables.</p>`,
  },
  {
    n: "VI", id: "nom", title: "Le nom",
    body: html`
      <p><strong>Gathirl</strong> réunit deux mots. <em>Gather</em>, rassembler, comme dans <em>Magic: The Gathering</em>. Et <em>IRL</em>, <em>in real life</em> : dans la vraie vie. Car tout l'intérêt de ces jeux est de se réunir, et tout l'intérêt de Gathirl est de vous réunir pour de vrai, autour d'une même table.</p>
      <p>Chacun le prononce comme il le veut, ou comme il le peut. Et s'il est facile à lire mais difficile à dire, c'est qu'on y revient, jusqu'à trouver la bonne prononciation. Plus on le lit, plus il s'imprègne.</p>`,
  },
];

export function render(el) {
  mount(el, html`
    <article class="lore">
      <header class="lore__head wrap">
        <p class="lore__eyebrow">La mythologie du Gathirl</p>
        <h1 class="lore__title">Le lieu de tous les lieux</h1>
        <p class="lore__lede">Avant les tables, les dés et les decks, il y avait un monde entre les mondes. Voici son histoire, telle que l'Oracle la raconte.</p>
        <nav class="lore__toc" aria-label="Chapitres">
          ${CHAPTERS.map((c) => html`<a href="#/lore" data-to="${c.id}"><span>${c.n}</span>${c.title}</a>`)}
        </nav>
      </header>

      <div class="wrap lore__body">
        ${CHAPTERS.map((c) => html`
          <section class="lore__chapter ${c.figure ? "has-figure" : ""}" id="${c.id}" aria-labelledby="${c.id}-t">
            <div class="lore__text">
              <p class="lore__num" aria-hidden="true">${c.n}</p>
              <h2 id="${c.id}-t">${c.title}</h2>
              ${c.body}
            </div>
            ${c.figure === "oracle" ? html`
              <figure class="lore__figure">
                <img src="assets/img/oracle-moine.jpg" alt="L'Oracle : un moine encapuchonné, torche à la main, dans l'arche gothique d'une tour, sous une lune rouge." width="720" height="891" loading="lazy" />
                <figcaption>L'Oracle, Gardien des Portails</figcaption>
              </figure>` : ""}
            ${c.figure === "sigil" ? html`
              <figure class="lore__figure lore__figure--sigil">
                <img src="assets/img/logo-gathirl.png" alt="Le logo du Gathirl : trois octogones et cercles emboîtés, entourés de six points." width="640" height="640" loading="lazy" />
                <figcaption>Le sceau du Gathirl</figcaption>
                <!-- Signification, d'après la charte graphique (Logo · Construction) -->
                <ul class="lore__legend" role="list">
                  <li><b>Les six points</b> : les joueurs autour d'une table de jeu</li>
                  <li><b>Les octogones</b> : Magic et Donjons &amp; Dragons, la pluralité des jeux</li>
                  <li><b>Le cercle au centre</b> : l'unification, la communauté</li>
                </ul>
              </figure>` : ""}
          </section>
          ${c.id === "oracle" ? html`<blockquote class="lore__quote"><p>« Vous n'êtes pas seul, venez rejoindre ce combat. Seul vous ne pourrez rien, ensemble vous saurez combattre… »</p><cite>L'Oracle</cite></blockquote>` : ""}`)}
      </div>

      <footer class="lore__end wrap">
        <p class="lore__call">Vous n'êtes pas seul. <span>Aventurez-vous.</span></p>
        <div class="lore__ctas">
          <a class="btn btn--primary" href="#/parties">${icon("swords")} Trouver une partie</a>
          <button type="button" class="btn" data-action="create-partie">${icon("plus")} Organiser la vôtre</button>
        </div>
      </footer>
    </article>`);

  // Sommaire : défilement vers le chapitre sans changer de route (le routeur utilise le #)
  el.addEventListener("click", (e) => {
    const a = e.target.closest("[data-to]");
    if (!a) return;
    e.preventDefault();
    document.getElementById(a.dataset.to)?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
}
