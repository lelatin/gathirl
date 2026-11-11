/* =====================================================================
   Pont vers l'application mobile (Capacitor).
   Sur le site web, tout ceci est inactif : isNative() vaut false.
   Dans l'app Android / iOS, Capacitor expose ses greffons natifs sur
   window.Capacitor.Plugins (aucun outil de build nécessaire côté site).
   ===================================================================== */

const cap = () => window.Capacitor;
const plugin = (name) => cap()?.Plugins?.[name];

/** Vrai dans l'application installée (Android / iOS), faux sur le site */
export const isNative = () => Boolean(cap()?.isNativePlatform?.());

/** Blob → base64 (sans l'en-tête data:) pour l'écriture de fichier */
function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

/**
 * Dans l'app, un lien « télécharger » ne fonctionne pas : on écrit le fichier
 * dans le cache de l'app puis on ouvre la feuille de partage du téléphone
 * (Enregistrer dans Photos, Ajouter au calendrier, envoyer par message…).
 */
export async function shareFile(blob, filename, title = "") {
  const fs = plugin("Filesystem"), share = plugin("Share");
  if (!fs || !share) throw new Error("Partage indisponible sur cet appareil.");
  const data = await toBase64(blob);
  const { uri } = await fs.writeFile({ path: filename, data, directory: "CACHE" });
  try {
    await share.share({ title, files: [uri], dialogTitle: title || "Partager" });
  } catch (e) {
    if (!/cancel/i.test(String(e?.message || e))) throw e;   // l'utilisateur a fermé la feuille : rien à signaler
  }
}

/** Réglages au démarrage de l'app : barre d'état, écran de lancement, bouton retour Android */
export function setupNative() {
  if (!isNative()) return;
  document.documentElement.classList.add("is-app");

  const status = plugin("StatusBar");
  status?.setStyle?.({ style: "DARK" }).catch?.(() => {});                 // texte clair sur fond sombre
  status?.setBackgroundColor?.({ color: "#121111" }).catch?.(() => {});    // Android

  plugin("SplashScreen")?.hide?.().catch?.(() => {});

  // Bouton retour Android : page précédente, ou quitter depuis l'accueil
  const app = plugin("App");
  app?.addListener?.("backButton", () => {
    const modal = document.querySelector("dialog[open]");
    if (modal) { modal.close(); return; }
    const home = location.hash === "" || location.hash === "#/" || location.hash === "#";
    if (home) app.exitApp?.();
    else history.back();
  });
}
