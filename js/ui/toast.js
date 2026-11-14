/* =====================================================================
   Toasts — transitions (interruptibles), pause quand l'onglet est caché,
   sortie plus rapide que l'entrée.
   ===================================================================== */
import { create, html, icon } from "../lib/dom.js?v=202611141753";

const ICONS = { success: "check", error: "skull", info: "sparkle" };
const MAX = 3;

export function toast(title, description = "", type = "info", duration = 4200) {
  const root = document.getElementById("toaster");
  if (!root) return;

  const el = create(html`
    <div class="toast toast--${type}" role="${type === "error" ? "alert" : "status"}">
      ${icon(ICONS[type] || "sparkle")}
      <strong>${title}</strong>
      ${description ? html`<p>${description}</p>` : ""}
    </div>`);
  root.append(el);

  // garder la pile courte
  const items = root.querySelectorAll(".toast:not(.is-leaving)");
  if (items.length > MAX) dismiss(items[0]);

  let remaining = duration;
  let start = Date.now();
  let timer = setTimeout(() => dismiss(el), remaining);

  const pause = () => { clearTimeout(timer); remaining -= Date.now() - start; };
  const resume = () => { start = Date.now(); clearTimeout(timer); timer = setTimeout(() => dismiss(el), Math.max(800, remaining)); };

  el.addEventListener("pointerenter", pause);
  el.addEventListener("pointerleave", resume);
  el.addEventListener("click", () => dismiss(el));
  const onVis = () => (document.hidden ? pause() : resume());
  document.addEventListener("visibilitychange", onVis);
  el._cleanup = () => document.removeEventListener("visibilitychange", onVis);
}

function dismiss(el) {
  if (!el || el.classList.contains("is-leaving")) return;
  el._cleanup?.();
  el.classList.add("is-leaving");
  setTimeout(() => el.remove(), 180);
}

toast.success = (t, d) => toast(t, d, "success");
toast.error = (t, d) => toast(t, d, "error", 5200);
