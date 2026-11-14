/* =====================================================================
   OUTILS — les outils pendant les parties
   1. Compteur de points de vie (1 à 6 joueurs, plein écran, panneaux
      tournés vers chaque joueur autour de la table, poison et blessures
      de commandant, partie sauvegardée)
   2. Dés et pièce
   Le compteur s'ouvre sur #/outils?jeu=1 : le bouton « retour » du
   téléphone le referme naturellement.
   ===================================================================== */
import { $, html, icon, mount, prefersReducedMotion } from "../lib/dom.js?v=202611141848";
import { mountDice, roll } from "../ui/dice.js?v=202611141848";

const KEY = "gathirl:vie:v1";
const PREFS = "gathirl:vie:prefs";
const LIVES = [20, 30, 40];
const COLORS = ["#b3202f", "#2b5f93", "#3f7d3a", "#6c3f93", "#b0812a", "#3d4b5c"];
// une illustration par joueur, voilée de sa couleur (adresse absolue : une url() dans une
// variable CSS se résout par rapport à la feuille de style, pas à la page)
const ARTS = ["02", "06", "10", "14", "17", "20"].map((n) => new URL(`assets/img/art-${n}.webp`, document.baseURI).href);
// orientation de chaque panneau : les joueurs sont assis autour du téléphone posé à plat
const ROTATIONS = {
  1: [0],
  2: [180, 0],
  3: [90, -90, 0],
  4: [90, -90, 90, -90],
  5: [90, -90, 90, -90, 0],
  6: [90, -90, 90, -90, 90, -90],
};
const HOLD_MS = 450;   // maintenir = ±10, répété tant que le doigt reste posé

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

function newGame(n, life) {
  return {
    n, life,
    players: Array.from({ length: n }, (_, i) => ({ life, poison: 0, cmd: Array(n).fill(0), color: COLORS[i] })),
  };
}

/* ===================================================================== */
export function render(el, ctx) {
  const prefs = store.get(PREFS) || { n: 2, life: 20 };
  const saved = store.get(KEY);
  const playing = ctx.query.get("jeu") && saved;

  mount(el, html`
    <section class="wrap outils">
      <h1 class="outils__title">Outils</h1>

      <article class="tool" aria-labelledby="tool-life">
        <h2 class="tool__title" id="tool-life">${icon("crown")} Compteur de points de vie</h2>
        <div class="tool__row">
          <span class="tool__label">Joueurs</span>
          <div class="seg" role="group" aria-label="Nombre de joueurs">
            ${[1, 2, 3, 4, 5, 6].map((n) => html`<button type="button" class="seg__btn" data-n="${n}" aria-pressed="${prefs.n === n}">${n}</button>`)}
          </div>
        </div>
        <div class="tool__row">
          <span class="tool__label">Points de vie</span>
          <div class="seg" role="group" aria-label="Points de vie de départ">
            ${LIVES.map((l) => html`<button type="button" class="seg__btn" data-start-life="${l}" aria-pressed="${prefs.life === l}">${l}</button>`)}
          </div>
        </div>
        <div class="tool__actions">
          <button type="button" class="ig-btn ig-btn--primary" data-start>Nouvelle partie</button>
          ${saved ? html`<button type="button" class="ig-btn" data-resume>Reprendre (${saved.n} ${saved.n > 1 ? "joueurs" : "joueur"})</button>` : ""}
        </div>
      </article>

      <article class="tool" aria-labelledby="tool-dice">
        <h2 class="tool__title" id="tool-dice">${icon("d20")} Dés et pièce</h2>
        <div data-dice></div>
      </article>
    </section>`);

  const offDice = mountDice($("[data-dice]", el));

  el.addEventListener("click", (e) => {
    const n = e.target.closest("[data-n]");
    const l = e.target.closest("[data-start-life]");
    if (n || l) {
      if (n) prefs.n = Number(n.dataset.n);
      if (l) prefs.life = Number(l.dataset.startLife);
      store.set(PREFS, prefs);
      el.querySelectorAll("[data-n]").forEach((b) => b.setAttribute("aria-pressed", Number(b.dataset.n) === prefs.n));
      el.querySelectorAll("[data-start-life]").forEach((b) => b.setAttribute("aria-pressed", Number(b.dataset.startLife) === prefs.life));
      return;
    }
    if (e.target.closest("[data-start]")) { store.set(KEY, newGame(prefs.n, prefs.life)); location.hash = "#/outils?jeu=1"; }
    else if (e.target.closest("[data-resume]")) location.hash = "#/outils?jeu=1";
  });

  const offGame = playing ? openCounter(saved) : () => {};
  return () => { offDice(); offGame(); };
}

/* =====================================================================
   Le compteur plein écran
   ===================================================================== */
function openCounter(game) {
  const { n } = game;
  const rots = ROTATIONS[n];
  const root = document.createElement("div");
  root.className = `lc lc--n${n}`;
  root.dataset.noswipe = "";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "Compteur de points de vie");

  mount(root, html`
    ${game.players.map((p, i) => html`
      <section class="lc__cell" style="grid-area:p${i};--pc:${p.color};--pimg:url('${ARTS[i]}')" data-cell="${i}">
        <div class="lc__face lc__face--r${rots[i]}">
          <button type="button" class="lc__half lc__half--minus" data-p="${i}" data-d="-1" aria-label="Joueur ${i + 1} : retirer un point de vie"><span aria-hidden="true">−</span></button>
          <button type="button" class="lc__half lc__half--plus" data-p="${i}" data-d="1" aria-label="Joueur ${i + 1} : ajouter un point de vie"><span aria-hidden="true">+</span></button>
          <div class="lc__center" aria-hidden="true">
            <span class="lc__name">J${i + 1}</span>
            <span class="lc__life" data-hp="${i}"></span>
            <span class="lc__delta" data-delta="${i}"></span>
            <span class="lc__badges" data-badges="${i}"></span>
          </div>
          <button type="button" class="lc__more" data-more="${i}" aria-label="Joueur ${i + 1} : poison et blessures de commandant">${icon("skull")}</button>
          <div class="lc__sheet" data-sheet="${i}" hidden></div>
        </div>
      </section>`)}
    <button type="button" class="lc__menu-btn" data-menu aria-label="Menu du compteur">${icon("d20")}</button>
    <div class="lc__menu" data-menu-panel hidden>
      <div class="lc__menu-card">
        <button type="button" class="lc__menu-close" data-menu-close aria-label="Fermer le menu">${icon("x")}</button>
        <div class="lc__menu-actions">
          <button type="button" class="ig-btn" data-first>Qui commence ?</button>
          <button type="button" class="ig-btn" data-reset>Recommencer</button>
          <button type="button" class="ig-btn" data-quit>Quitter</button>
        </div>
        <div data-menu-dice></div>
      </div>
    </div>`);

  document.body.append(root);
  document.documentElement.classList.add("lc-open");
  const offDice = mountDice($("[data-menu-dice]", root));

  /* ---------- Affichage ---------- */
  const pending = Array(n).fill(0);
  const deltaTimers = [];
  const save = () => store.set(KEY, game);
  const isOut = (p) => p.life <= 0 || p.poison >= 10 || p.cmd.some((c) => c >= 21);

  const paint = (i) => {
    const p = game.players[i];
    $(`[data-hp="${i}"]`, root).textContent = p.life;
    const b = [];
    if (p.poison) b.push(`☠ ${p.poison}`);
    p.cmd.forEach((c, j) => { if (c) b.push(`⚔ ${c} J${j + 1}`); });
    $(`[data-badges="${i}"]`, root).textContent = b.join("  ·  ");
    $(`[data-cell="${i}"]`, root).classList.toggle("is-out", isOut(p));
  };
  game.players.forEach((_, i) => paint(i));

  const change = (i, d) => {
    const p = game.players[i];
    p.life += d;
    pending[i] += d;
    const el = $(`[data-delta="${i}"]`, root);
    el.textContent = pending[i] > 0 ? `+${pending[i]}` : pending[i] < 0 ? `−${-pending[i]}` : "";
    el.classList.add("is-on");
    clearTimeout(deltaTimers[i]);
    deltaTimers[i] = setTimeout(() => { pending[i] = 0; el.classList.remove("is-on"); }, 1600);
    paint(i);
    save();
    navigator.vibrate?.(6);
  };

  /* ---------- Toucher = ±1, maintenir = ±10 en continu ---------- */
  let hold = null;
  const stopHold = () => { if (hold) { clearTimeout(hold.t); clearInterval(hold.r); } };
  root.addEventListener("pointerdown", (e) => {
    const h = e.target.closest(".lc__half");
    if (!h) return;
    e.preventDefault();
    if (hold) { stopHold(); hold.el.classList.remove("is-pressed"); }
    const i = Number(h.dataset.p), d = Number(h.dataset.d);
    hold = { i, d, held: false, id: e.pointerId, el: h };
    h.classList.add("is-pressed");
    hold.t = setTimeout(() => {
      hold.held = true;
      change(i, d * 10);
      hold.r = setInterval(() => change(i, d * 10), HOLD_MS);
    }, HOLD_MS);
  });
  const release = (e) => {
    if (!hold || e.pointerId !== hold.id) return;
    stopHold();
    hold.el.classList.remove("is-pressed");
    if (!hold.held && e.type === "pointerup") change(hold.i, hold.d);
    hold = null;
  };
  root.addEventListener("pointerup", release);
  root.addEventListener("pointercancel", release);
  root.addEventListener("contextmenu", (e) => e.preventDefault());

  /* ---------- Poison et blessures de commandant (dans le panneau du joueur, tourné vers lui) ---------- */
  const drawSheet = (i) => {
    const p = game.players[i];
    const row = (label, value, attrs) => html`
      <div class="lc__ctr">
        <span class="lc__ctr-label">${label}</span>
        <button type="button" class="lc__ctr-btn" ${attrs} data-d="-1" aria-label="Moins">−</button>
        <b class="lc__ctr-val">${value}</b>
        <button type="button" class="lc__ctr-btn" ${attrs} data-d="1" aria-label="Plus">+</button>
      </div>`;
    mount($(`[data-sheet="${i}"]`, root), html`
      <div class="lc__sheet-head">
        <strong>J${i + 1} · compteurs</strong>
        <button type="button" class="lc__sheet-close" data-close-sheet="${i}" aria-label="Fermer">${icon("x")}</button>
      </div>
      ${row("☠ Poison", p.poison, html`data-poison="${i}"`)}
      ${n > 1 ? html`
        <p class="lc__sub">Blessures de commandant reçues</p>
        <div class="lc__cmds">
          ${game.players.map((q, j) => j === i ? "" : row(html`<i class="lc__dot" style="background:${q.color}"></i>J${j + 1}`, p.cmd[j], html`data-cmd="${i}" data-from="${j}"`))}
        </div>
        <p class="lc__hint">Elles retirent aussi des points de vie. 21 du même commandant : partie perdue.</p>` : ""}`);
  };

  const menu = $("[data-menu-panel]", root);
  // le bouton du menu s'efface tant qu'une fiche est ouverte (il en masquerait un coin)
  const syncSheets = () => root.classList.toggle("has-sheet", [...root.querySelectorAll("[data-sheet]")].some((x) => !x.hidden));
  const resetBtn = $("[data-reset]", root);
  const resetArmed = () => { delete resetBtn.dataset.armed; resetBtn.textContent = "Recommencer"; resetBtn.classList.remove("ig-btn--primary"); };

  root.addEventListener("click", (e) => {
    const t = e.target;
    // clavier (Entrée / Espace) sur une moitié : ±1 (au doigt, c'est géré par pointerdown/up)
    const half = t.closest(".lc__half");
    if (half) { if (e.detail === 0) change(Number(half.dataset.p), Number(half.dataset.d)); return; }

    const more = t.closest("[data-more]");
    if (more) { const i = Number(more.dataset.more); drawSheet(i); $(`[data-sheet="${i}"]`, root).hidden = false; syncSheets(); return; }
    const close = t.closest("[data-close-sheet]");
    if (close) { $(`[data-sheet="${close.dataset.closeSheet}"]`, root).hidden = true; syncSheets(); return; }

    const poison = t.closest("[data-poison]");
    if (poison) {
      const i = Number(poison.dataset.poison), p = game.players[i];
      p.poison = Math.max(0, p.poison + Number(poison.dataset.d));
      save(); paint(i); drawSheet(i); return;
    }
    const cmd = t.closest("[data-cmd]");
    if (cmd) {
      const i = Number(cmd.dataset.cmd), j = Number(cmd.dataset.from), d = Number(cmd.dataset.d), p = game.players[i];
      if (d < 0 && p.cmd[j] === 0) return;
      p.cmd[j] += d;
      change(i, -d);   // une blessure de commandant est aussi une perte de points de vie
      drawSheet(i); return;
    }

    /* ---------- Menu central ---------- */
    if (t.closest("[data-menu]")) { menu.hidden = false; resetArmed(); return; }
    if (t.closest("[data-menu-close]") || t === menu) { menu.hidden = true; return; }
    if (t.closest("[data-first]")) { menu.hidden = true; pickFirst(); return; }
    if (t.closest("[data-reset]")) {
      if (!resetBtn.dataset.armed) { resetBtn.dataset.armed = "1"; resetBtn.textContent = "Toucher encore pour confirmer"; resetBtn.classList.add("ig-btn--primary"); return; }
      game.players.forEach((p) => { p.life = game.life; p.poison = 0; p.cmd.fill(0); });
      save(); game.players.forEach((_, i) => paint(i));
      menu.hidden = true; resetArmed(); return;
    }
    if (t.closest("[data-quit]")) location.replace(location.pathname + location.search + "#/outils");
  });

  /* « Qui commence ? » : les panneaux s'allument tour à tour, puis s'arrêtent sur un joueur */
  let pickTimer = 0;
  const pickFirst = () => {
    const winner = roll(n) - 1;
    const cells = [...root.querySelectorAll("[data-cell]")];
    const steps = prefersReducedMotion() ? 0 : n * 2 + winner;
    let k = 0;
    const tick = () => {
      if (k < steps) {
        cells.forEach((c, i) => c.classList.toggle("is-picked", i === k % n));
        k++;
        pickTimer = setTimeout(tick, 80 + k * 14);
        return;
      }
      cells.forEach((c, i) => { c.classList.toggle("is-picked", i === winner); c.classList.toggle("is-first", i === winner); });
      pickTimer = setTimeout(() => cells.forEach((c) => c.classList.remove("is-picked", "is-first")), 2600);
    };
    clearTimeout(pickTimer);
    tick();
  };

  /* ---------- L'écran reste allumé pendant la partie ---------- */
  let lock = null;
  const keepAwake = async () => { try { lock = await navigator.wakeLock?.request("screen"); } catch {} };
  const onVis = () => { if (document.visibilityState === "visible") keepAwake(); };
  keepAwake();
  document.addEventListener("visibilitychange", onVis);

  const onKey = (e) => {
    if (e.key !== "Escape") return;
    if (!menu.hidden) menu.hidden = true;
    else { root.querySelectorAll("[data-sheet]").forEach((s) => (s.hidden = true)); syncSheets(); }
  };
  document.addEventListener("keydown", onKey);

  return () => {
    stopHold();
    clearTimeout(pickTimer);
    deltaTimers.forEach(clearTimeout);
    offDice();
    lock?.release?.().catch(() => {});
    document.removeEventListener("visibilitychange", onVis);
    document.removeEventListener("keydown", onKey);
    document.documentElement.classList.remove("lc-open");
    root.remove();
  };
}
