// =====================================================================
// Gathirl : prépare le dossier www/ embarqué dans l'application mobile.
// Le site n'a pas d'étape de build : on copie seulement ce que l'app doit
// contenir (jamais origine/, .claude/, tools/, supabase/, README…).
//   npm run build:app     → www/
//   npm run sync          → www/ puis copie dans android/ et ios/
// =====================================================================
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "www");
const keep = ["index.html", "manifest.webmanifest", "css", "js", "assets"];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const entry of keep) {
  const src = join(root, entry);
  if (!existsSync(src)) { console.warn(`(absent) ${entry}`); continue; }
  cpSync(src, join(out, entry), { recursive: true });
}
console.log(`www/ prêt : ${keep.join(", ")}`);
