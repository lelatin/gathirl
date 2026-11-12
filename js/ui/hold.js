/* =====================================================================
   Bouton « maintenir pour confirmer » (actions irréversibles).
   Port sans React du composant HoldToConfirmButton :
   - souris / doigt : maintenir `duration` ms ; relâcher ou sortir du bouton
     (marge de 8 px) annule ; capture du pointeur pendant l'appui ;
   - clavier : maintenir Entrée ou Espace (sans répétition), relâcher annule ;
   - le remplissage rouge avance en linéaire (geste délibéré) et se retire
     en 180 ms ease-out (réponse du système) : timing asymétrique ;
   - clavier et mouvement réduit : aucune animation, état direct.
   Balisage attendu :
     <button type="button" class="hold" data-hold>
       <span class="hold__label">Texte</span>
       <span class="hold__fill" aria-hidden="true">Texte</span>
     </button>
   ===================================================================== */

const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * @param {HTMLButtonElement} button
 * @param {{ duration?: number, resetAfter?: number, confirmed?: string,
 *           onConfirm: (input: "pointer"|"keyboard") => void }} opts
 * @returns {() => void} nettoyage
 */
export function holdToConfirm(button, { duration = 1600, resetAfter = 1800, confirmed = "Confirmé", onConfirm }) {
  const fill = button.querySelector(".hold__fill");
  const label = button.querySelector(".hold__label");
  const idleHTML = label.innerHTML;
  let status = "idle";          // idle | holding | confirmed
  let input = "pointer";
  let pointerId = null;
  let confirmTimer = 0, resetTimer = 0;

  const setFill = (holding) => {
    const instant = reduceMotion() || input === "keyboard";
    fill.style.transitionDuration = instant ? "0ms" : holding ? `${duration}ms` : "180ms";
    fill.style.transitionTimingFunction = holding ? "linear" : "cubic-bezier(0.23, 1, 0.32, 1)";
    fill.style.clipPath = holding ? "inset(0 0 0 0)" : "inset(0 100% 0 0)";
  };
  const setStatus = (s) => {
    status = s;
    button.dataset.status = s;
    button.dataset.input = input;
    button.setAttribute("aria-busy", String(s === "holding"));
  };

  const complete = () => {
    if (status !== "holding") return;
    clearTimeout(confirmTimer);
    pointerId = null;
    setStatus("confirmed");
    label.innerHTML = `<svg aria-hidden="true" focusable="false"><use href="#i-check"/></svg> ${confirmed}`;
    fill.hidden = true;
    onConfirm(input);
    if (resetAfter > 0) {
      resetTimer = setTimeout(() => {
        label.innerHTML = idleHTML;
        fill.hidden = false;
        setFill(false);
        setStatus("idle");
      }, resetAfter);
    }
  };
  const cancel = () => {
    if (status !== "holding") return;
    clearTimeout(confirmTimer);
    pointerId = null;
    setStatus("idle");
    setFill(false);
  };
  const start = (how) => {
    if (button.disabled || status !== "idle") return;
    clearTimeout(resetTimer);
    input = how;
    setStatus("holding");
    setFill(true);
    confirmTimer = setTimeout(complete, duration);
  };
  const release = (id) => { if (button.hasPointerCapture?.(id)) button.releasePointerCapture(id); };

  const onDown = (e) => {
    if (!e.isPrimary || e.button !== 0 || button.disabled) return;
    pointerId = e.pointerId;
    button.setPointerCapture(e.pointerId);
    start("pointer");
  };
  const onMove = (e) => {
    if (status !== "holding" || pointerId !== e.pointerId) return;
    const r = button.getBoundingClientRect(), pad = 8;
    if (e.clientX < r.left - pad || e.clientX > r.right + pad || e.clientY < r.top - pad || e.clientY > r.bottom + pad) {
      cancel();
      release(e.pointerId);
    }
  };
  const onEnd = (e) => {
    if (pointerId !== e.pointerId) return;
    cancel();
    release(e.pointerId);
  };
  const onKeyDown = (e) => {
    if (e.repeat || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    start("keyboard");
  };
  const onKeyUp = (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    cancel();
  };
  const onClick = (e) => e.preventDefault();   // un simple clic ne fait rien : il faut maintenir

  setFill(false);
  setStatus("idle");
  button.addEventListener("pointerdown", onDown);
  button.addEventListener("pointermove", onMove);
  button.addEventListener("pointerup", onEnd);
  button.addEventListener("pointercancel", onEnd);
  button.addEventListener("lostpointercapture", cancel);
  button.addEventListener("blur", cancel);
  button.addEventListener("keydown", onKeyDown);
  button.addEventListener("keyup", onKeyUp);
  button.addEventListener("click", onClick);
  button.addEventListener("contextmenu", onClick);   // pas de menu « appui long » sur mobile

  return () => {
    clearTimeout(confirmTimer); clearTimeout(resetTimer);
    for (const [t, f] of [["pointerdown", onDown], ["pointermove", onMove], ["pointerup", onEnd], ["pointercancel", onEnd],
      ["lostpointercapture", cancel], ["blur", cancel], ["keydown", onKeyDown], ["keyup", onKeyUp], ["click", onClick], ["contextmenu", onClick]]) {
      button.removeEventListener(t, f);
    }
  };
}
