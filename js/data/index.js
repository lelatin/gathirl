/* =====================================================================
   Sélection de l'adaptateur de données : démo (local) ou Supabase.
   ===================================================================== */
import { CONFIG } from "../config.js?v=202611120009";
import { localAdapter } from "./local.js?v=202611120009";

export const usingSupabase = Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);

export let db = localAdapter;

export async function initData() {
  if (usingSupabase) {
    try {
      const { supabaseAdapter } = await import("./supabase.js?v=202611120009");
      await supabaseAdapter.init();
      db = supabaseAdapter;
      return db;
    } catch (err) {
      console.error("[Gathirl] Supabase indisponible, bascule en mode démo.", err);
    }
  }
  await localAdapter.init();
  db = localAdapter;
  return db;
}
