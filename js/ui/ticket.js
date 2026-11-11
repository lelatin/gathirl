/* =====================================================================
   BILLET DE PARTIE — dessiné en <canvas>, affiché tel quel dans la page
   et téléchargeable en PNG (ce que l'on voit = ce que l'on télécharge).
   Silhouette inspirée du ticket de dqnamo.com : coins coupés, encoches
   en V au niveau de la perforation, talon avec le QR code.
   Format post Instagram : 1080 × 1350 px (4:5).
   ===================================================================== */
import qrcode from "../vendor/qrcode.js";
import { artFor, fmtTime, hash, plural } from "../lib/format.js";
import { partieUrl, slug, downloadBlob } from "../lib/calendar.js";

/* Teintes « Magic » par format : les mêmes que les cartouches de parties */
const TINTS = {
  Commander: ["#ffb35c", "#1a0e0a"], Standard: ["#ffb35c", "#1a0e0a"],
  Draft: ["#e3283a", "#fff4ea"], Pauper: ["#e3283a", "#fff4ea"],
  Pioneer: ["#ff6a3d", "#1a0e0a"], Vintage: ["#ff6a3d", "#1a0e0a"], Sealed: ["#ff6a3d", "#1a0e0a"],
  Modern: ["#a865e0", "#140a1c"], Legacy: ["#a865e0", "#140a1c"], Cube: ["#a865e0", "#140a1c"],
};
const tintFor = (f) => TINTS[f] || TINTS.Commander;

const C = {
  ink: "#0e0a13", ink2: "#16101b", parch: "#efe3c8", parch2: "#cdbfa3", muted: "#9a8d8f",
  gold: "#e3b35b", neon: "#ff4a57", blood: "#e3283a",
};
const F = {
  display: '"Grenze Gotisch", Georgia, serif',
  body: 'Spectral, Georgia, serif',
  mono: '"Space Mono", ui-monospace, Menlo, monospace',
};

/* Gabarit (unités logiques ; le PNG est rendu à ×3) */
// 360 × 450 logiques, rendu ×3 = 1080 × 1350 px (post Instagram 4:5)
export const TICKET = { W: 360, H: 450, CORNER: 10, NOTCH: 12 };
TICKET.STUB = 112;

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const dayMonth = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });
export const ticketCode = (p) => `${(p.format || "M").charAt(0).toUpperCase()}${(hash(p.id) % 9) + 1}`;

async function fontsReady() {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load(`700 34px ${F.display}`),
    document.fonts.load(`600 15px ${F.body}`),
    document.fonts.load(`400 13px ${F.body}`),
    document.fonts.load(`700 11px ${F.mono}`),
    document.fonts.load(`400 11px ${F.mono}`),
  ]).catch(() => {});
}

function loadImage(src) {
  return new Promise((res) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });
}

/* Silhouette : coins coupés + encoches en V à la perforation */
function ticketPath(ctx) {
  const { W, H, CORNER: c, NOTCH: n, STUB: s } = TICKET;
  const y = H - s;
  ctx.beginPath();
  ctx.moveTo(0, c); ctx.lineTo(c, 0); ctx.lineTo(W - c, 0); ctx.lineTo(W, c);
  ctx.lineTo(W, y - n); ctx.lineTo(W - n, y); ctx.lineTo(W, y + n);
  ctx.lineTo(W, H - c); ctx.lineTo(W - c, H); ctx.lineTo(c, H); ctx.lineTo(0, H - c);
  ctx.lineTo(0, y + n); ctx.lineTo(n, y); ctx.lineTo(0, y - n);
  ctx.closePath();
}

/* Texte avec interlettrage (si le navigateur le gère) */
function spaced(ctx, px) { if ("letterSpacing" in ctx) ctx.letterSpacing = `${px}px`; }

/** Coupe un texte en lignes (au plus maxLines, avec « … ») */
function wrap(ctx, text, maxW, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width <= maxW || !cur) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(last + "…").width > maxW) last = last.slice(0, -1);
    lines[maxLines - 1] = last.trimEnd() + "…";
  }
  return lines;
}

function label(ctx, text, x, y, color = C.muted) {
  ctx.font = `700 8.5px ${F.mono}`;
  spaced(ctx, 1.4);
  ctx.fillStyle = color;
  ctx.fillText(text.toUpperCase(), x, y);
  spaced(ctx, 0);
}

/** Un champ « étiquette + valeur », renvoie sa hauteur */
function field(ctx, name, value, sub, x, y, w) {
  label(ctx, name, x, y);
  ctx.font = `600 13.5px ${F.body}`;
  ctx.fillStyle = C.parch;
  const lines = wrap(ctx, value, w, 2);
  lines.forEach((l, i) => ctx.fillText(l, x, y + 13 + i * 16));
  let h = 13 + lines.length * 16;
  if (sub) {
    ctx.font = `400 11.5px ${F.body}`;
    ctx.fillStyle = C.muted;
    ctx.fillText(wrap(ctx, sub, w, 1)[0] || "", x, y + h + 1);
    h += 15;
  }
  return h;
}

function drawQR(ctx, text, x, y, size, ink) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2;
  const cell = size / (n + quiet * 2);
  ctx.fillStyle = ink;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      // +0.02 : évite les fines lignes claires entre modules à l'antialiasing
      if (qr.isDark(r, c)) ctx.fillRect(x + (c + quiet) * cell, y + (r + quiet) * cell, cell + 0.02, cell + 0.02);
    }
  }
}

/** Dessine le billet (format post Instagram 4:5) et renvoie le <canvas> */
export async function renderTicket(p, { scale = 3 } = {}) {
  const { W, H, NOTCH: N, STUB: S } = TICKET;
  const Y = H - S;
  const M = 22;                      // marge intérieure
  const [tint, onTint] = tintFor(p.format);
  await fontsReady();
  const art = await loadImage(artFor(p.id));

  const cv = document.createElement("canvas");
  cv.width = W * scale; cv.height = H * scale;
  const ctx = cv.getContext("2d");
  ctx.scale(scale, scale);
  ctx.textBaseline = "top";

  ticketPath(ctx);
  ctx.save();
  ctx.clip();

  /* --- Papier : encre profonde + lueurs violette / rouge + reflet --- */
  let g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1e1523"); g.addColorStop(1, "#0b080f");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(W * 0.9, 0, 0, W * 0.9, 0, W * 0.9);
  g.addColorStop(0, "rgba(122,63,176,.28)"); g.addColorStop(1, "rgba(122,63,176,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(0, H * 0.6, 0, 0, H * 0.6, W);
  g.addColorStop(0, "rgba(227,40,58,.14)"); g.addColorStop(1, "rgba(227,40,58,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createLinearGradient(0, 0, W * 0.6, H * 0.5);
  g.addColorStop(0, "rgba(255,255,255,.07)"); g.addColorStop(0.42, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  /* Liseré de la teinte du format, en haut */
  ctx.fillStyle = tint; ctx.fillRect(0, 0, W, 4);

  /* --- En-tête : logo néon + numéro de billet --- */
  ctx.save();
  ctx.font = `700 23px ${F.display}`;
  spaced(ctx, 1.8);
  ctx.fillStyle = C.neon;
  ctx.shadowColor = "rgba(227,40,58,.85)";
  ctx.shadowBlur = 10 * scale;
  ctx.fillText("Gathirl", M, 14);
  ctx.shadowBlur = 0;
  ctx.restore();
  ctx.textAlign = "right";
  label(ctx, "Billet d'aventure", W - M, 15, C.gold);
  label(ctx, `N° ${ticketCode(p)} · ${String(hash(p.id) % 10000).padStart(4, "0")}`, W - M, 28);
  ctx.textAlign = "left";

  /* --- Bandeau illustré --- */
  const ax = 14, ay = 46, aw = W - 28, ah = 104;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(ax, ay, aw, ah, 5); ctx.clip();
  ctx.fillStyle = C.ink; ctx.fillRect(ax, ay, aw, ah);
  if (art) {
    const r = Math.max(aw / art.width, ah / art.height);
    const iw = art.width * r, ih = art.height * r;
    ctx.filter = "saturate(1.15) contrast(1.06)";
    ctx.drawImage(art, ax + (aw - iw) / 2, ay + (ah - ih) / 2, iw, ih);
    ctx.filter = "none";
  }
  g = ctx.createLinearGradient(0, ay + ah * 0.4, 0, ay + ah);
  g.addColorStop(0, "rgba(14,10,19,0)"); g.addColorStop(1, "rgba(14,10,19,.85)");
  ctx.fillStyle = g; ctx.fillRect(ax, ay, aw, ah);
  ctx.restore();
  ctx.strokeStyle = "rgba(239,227,200,.16)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(ax + 0.5, ay + 0.5, aw - 1, ah - 1, 5); ctx.stroke();
  /* équerre d'angle, comme sur les cartouches */
  ctx.strokeStyle = tint; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(ax + aw - 6, ay + ah - 18); ctx.lineTo(ax + aw - 6, ay + ah - 6); ctx.lineTo(ax + aw - 18, ay + ah - 6); ctx.stroke();

  /* étiquette du format sur l'illustration */
  ctx.font = `700 9.5px ${F.mono}`;
  spaced(ctx, 1.3);
  const tag = `${p.format}${p.level ? " · " + p.level : ""}`.toUpperCase();
  const tw = ctx.measureText(tag).width + 16;
  ctx.fillStyle = tint;
  ctx.beginPath(); ctx.roundRect(ax + 10, ay + ah - 29, tw, 19, 3); ctx.fill();
  ctx.fillStyle = onTint;
  ctx.fillText(tag, ax + 18, ay + ah - 24);
  spaced(ctx, 0);

  /* --- Titre (2 lignes max) --- */
  ctx.font = `700 25px ${F.display}`;
  ctx.fillStyle = C.parch;
  const titleLines = wrap(ctx, p.title, W - M * 2, 2);
  // un titre d'une seule ligne est centré dans l'espace prévu pour deux
  const ty = ay + ah + 12 + (2 - titleLines.length) * 13;
  titleLines.forEach((l, i) => ctx.fillText(l, M, ty + i * 26));

  /* --- Informations : calées au-dessus de la perforation --- */
  const fy = 232;
  ctx.fillStyle = "rgba(239,227,200,.12)";
  ctx.fillRect(M, fy - 10, W - M * 2, 1);
  const gap = 12, col = (W - M * 2 - gap * 2) / 3;
  const c1 = M, c2 = M + col + gap, c3 = M + (col + gap) * 2;
  const d = new Date(p.date);
  const left = p.max_players - p.current_players;
  const rowA = Math.max(
    field(ctx, "Date", cap(dayMonth.format(d)), String(d.getFullYear()), c1, fy, col),
    field(ctx, "Heure", fmtTime(p.date), null, c2, fy, col),
    field(ctx, "Joueurs", `${p.current_players} / ${p.max_players}`,
      left > 0 ? plural(left, "place libre", "places libres") : "Complet", c3, fy, col),
  );
  const fy2 = fy + rowA + 10;
  field(ctx, "Lieu", p.location || p.city, p.location_address || (p.location ? p.city : ""), c1, fy2, col * 2 + gap);
  field(ctx, "Organisation", p.host_name, null, c3, fy2, col);

  /* --- Perforation --- */
  ctx.strokeStyle = "rgba(239,227,200,.32)"; ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(N + 6, Y + 0.5); ctx.lineTo(W - N - 6, Y + 0.5); ctx.stroke();
  ctx.setLineDash([]);

  /* --- Talon : QR code sur parchemin + mention --- */
  const qs = 86, qx = M, qy = Y + (S - qs) / 2;
  ctx.fillStyle = C.parch;
  ctx.beginPath(); ctx.roundRect(qx, qy, qs, qs, 5); ctx.fill();
  drawQR(ctx, partieUrl(p.id), qx + 3, qy + 3, qs - 6, C.ink);

  const tx = qx + qs + 16, tW = W - tx - M;
  label(ctx, "Scannez-moi", tx, qy + 2, tint);
  ctx.font = `700 20px ${F.display}`;
  ctx.fillStyle = C.parch;
  ctx.fillText(wrap(ctx, "Ouvrir la partie", tW, 1)[0], tx, qy + 16);
  ctx.font = `400 11.5px ${F.body}`;
  ctx.fillStyle = C.muted;
  ctx.fillText(wrap(ctx, "Présentez ce billet à la table.", tW, 1)[0], tx, qy + 41);
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 18px ${F.mono}`;
  ctx.fillStyle = tint;
  ctx.fillText(ticketCode(p), tx, qy + qs - 1);
  ctx.textAlign = "right";
  ctx.font = `700 8.5px ${F.mono}`;
  spaced(ctx, 1.4);
  ctx.fillStyle = C.parch2;
  ctx.fillText("ADMET 1 AVENTURIER·E", W - M, qy + qs - 2);
  spaced(ctx, 0);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  /* Liseré intérieur qui suit la silhouette */
  ticketPath(ctx);
  ctx.strokeStyle = "rgba(239,227,200,.16)"; ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  return cv;
}

/* Cache par partie (on ne redessine que si une info du billet change) */
const cache = new Map();
/** Dernier billet dessiné pour cette partie (même périmé) : affiché tout de suite au redessin */
export const lastTicket = (id) => cache.get(id) || null;
const keyOf = (p) => [p.id, p.title, p.date, p.location, p.location_address, p.city, p.format, p.level, p.host_name, p.current_players, p.max_players].join("|");

export async function ticketFor(p) {
  const key = keyOf(p);
  const hit = cache.get(p.id);
  if (hit && hit.key === key) return hit;
  const cv = await renderTicket(p);
  const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
  if (hit) URL.revokeObjectURL(hit.url);
  const entry = { key, blob, url: URL.createObjectURL(blob), name: `gathirl-billet-${slug(p.title)}.png` };
  cache.set(p.id, entry);
  return entry;
}

/** Télécharge le billet ; sur téléphone, ouvre la feuille de partage (« Enregistrer l'image ») */
export async function saveTicket(p) {
  const t = await ticketFor(p);
  const file = typeof File === "function" ? new File([t.blob], t.name, { type: "image/png" }) : null;
  const touch = matchMedia("(pointer: coarse)").matches;
  if (touch && file && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: p.title }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  downloadBlob(t.blob, t.name);
}

/** Inclinaison au survol (souris uniquement, mouvement réduit respecté) */
export function ticketTilt(root) {
  const media = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
  const move = (e) => {
    const el = e.target.closest?.("[data-ticket-tilt]");
    if (!el || !media.matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1100px) rotateX(${(-y * 12).toFixed(2)}deg) rotateY(${(x * 12).toFixed(2)}deg) scale(1.018)`;
  };
  const leave = (e) => {
    const el = e.target.closest?.("[data-ticket-tilt]");
    if (el && !el.contains(e.relatedTarget)) el.style.transform = "";
  };
  root.addEventListener("pointermove", move);
  root.addEventListener("pointerout", leave);
  return () => { root.removeEventListener("pointermove", move); root.removeEventListener("pointerout", leave); };
}
