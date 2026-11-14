/* =====================================================================
   Export calendrier (.ics, RFC 5545) — compatible Apple Calendrier,
   Google Agenda, Outlook, Samsung Calendar…
   ===================================================================== */
import { CONFIG } from "../config.js?v=202611141827";
import { isNative, shareFile } from "./native.js?v=202611141827";

const pad = (n) => String(n).padStart(2, "0");
/** Date → 20261113T190000Z (UTC) */
const icsDate = (d) => {
  const x = new Date(d);
  return `${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}T${pad(x.getUTCHours())}${pad(x.getUTCMinutes())}${pad(x.getUTCSeconds())}Z`;
};
/** Échappe le texte : \ ; , et retours à la ligne */
const esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Replie les lignes à 75 octets (UTF-8), sans couper un caractère */
function fold(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = "", bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ""; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/** Lien absolu vers une partie (utilisé aussi par le QR code du billet) */
// Dans l'app, l'adresse de la page est interne au téléphone : on renvoie vers le site public
export const partieUrl = (id) => `${isNative() ? CONFIG.PUBLIC_URL : location.origin + location.pathname}#/partie/${id}`;

export function partieToIcs(p, { durationHours = 3 } = {}) {
  const start = new Date(p.date);
  const end = new Date(start.getTime() + durationHours * 3600000);
  const url = partieUrl(p.id);
  const where = [p.location, p.location_address || p.city].filter(Boolean).join(", ");
  const desc = [
    `Partie de Magic · ${p.format}${p.level ? " · " + p.level : ""}`,
    `Organisée par ${p.host_name}`,
    `${p.current_players} / ${p.max_players} joueurs`,
    p.description || "",
    url,
  ].filter(Boolean).join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gathirl//Parties Magic//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${p.id}@gathirl`,
    `DTSTAMP:${icsDate(Date.now())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${esc(p.title)}`,
    where && `LOCATION:${esc(where)}`,
    p.location_lat && p.location_lng ? `GEO:${p.location_lat};${p.location_lng}` : "",
    `DESCRIPTION:${esc(desc)}`,
    `URL:${url}`,
    `CATEGORIES:${esc("Magic: The Gathering")}`,
    p.status === "annulé" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    // rappel 2 h avant
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(p.title)}`,
    "TRIGGER:-PT2H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Nom de fichier lisible : gathirl-commander-du-vendredi-soir */
export const slug = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "partie";

/** Télécharge un Blob (iOS l'ouvre dans Calendrier / Photos selon le type) */
export function downloadBlob(blob, filename) {
  if (isNative()) return shareFile(blob, filename);   // app : feuille de partage du téléphone
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function downloadIcs(p) {
  const blob = new Blob([partieToIcs(p)], { type: "text/calendar;charset=utf-8" });
  downloadBlob(blob, `gathirl-${slug(p.title)}.ics`);
}
