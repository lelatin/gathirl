/* =====================================================================
   Lanceur de dés et de pièce — utilisé sur la page Outils et dans le
   menu du compteur de points de vie.
   ===================================================================== */
import { html, icon, mount, prefersReducedMotion } from "../lib/dom.js?v=202611141851";

const DICE = [4, 6, 8, 10, 12, 20];

/** Tirage équitable (crypto si disponible) entre 1 et n */
export function roll(n) {
  if (crypto?.getRandomValues) {
    const max = Math.floor(0x100000000 / n) * n;   // rejet : pas de biais de modulo
    const buf = new Uint32Array(1);
    do crypto.getRandomValues(buf); while (buf[0] >= max);
    return (buf[0] % n) + 1;
  }
  return 1 + Math.floor(Math.random() * n);
}

/**
 * Monte le lanceur dans `el`. Retourne une fonction de nettoyage.
 */
export function mountDice(el) {
  const history = [];
  let timer = 0;

  mount(el, html`
    <div class="dice">
      <div class="dice__result" aria-live="polite">
        <span class="dice__value" data-value>${icon("d20", "dice__idle")}</span>
        <span class="dice__label" data-label>Choisissez un dé</span>
      </div>
      <div class="dice__grid">
        ${DICE.map((n) => html`<button type="button" class="dice__btn" data-die="${n}">d${n}</button>`)}
        <button type="button" class="dice__btn dice__btn--coin" data-coin>Pile ou face</button>
      </div>
      <p class="dice__history" data-history hidden></p>
    </div>`);

  const valueEl = el.querySelector("[data-value]");
  const labelEl = el.querySelector("[data-label]");
  const histEl = el.querySelector("[data-history]");

  const show = (final, label, fake) => {
    clearInterval(timer);
    el.querySelector(".dice").classList.remove("is-done");
    const done = () => {
      clearInterval(timer);
      valueEl.textContent = final;
      labelEl.textContent = label;
      const d = el.querySelector(".dice");
      void d.offsetWidth;
      d.classList.add("is-done");
      history.unshift(`${label.split(" ")[0]} : ${final}`);
      history.length = Math.min(history.length, 6);
      histEl.hidden = false;
      histEl.textContent = "Derniers : " + history.join(" · ");
      navigator.vibrate?.(12);
    };
    if (prefersReducedMotion()) return done();
    // le résultat « roule » une demi-seconde avant de s'arrêter
    let n = 0;
    labelEl.textContent = "…";
    timer = setInterval(() => {
      valueEl.textContent = fake();
      if (++n >= 9) done();
    }, 55);
  };

  el.addEventListener("click", (e) => {
    const die = e.target.closest("[data-die]");
    if (die) {
      const n = Number(die.dataset.die);
      show(roll(n), `d${n} lancé`, () => roll(n));
      return;
    }
    if (e.target.closest("[data-coin]")) {
      const r = roll(2) === 1 ? "Pile" : "Face";
      show(r, "Pièce lancée", () => (roll(2) === 1 ? "Pile" : "Face"));
    }
  });

  return () => clearInterval(timer);
}
