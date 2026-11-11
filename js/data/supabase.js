/* =====================================================================
   Adaptateur SUPABASE — vrai backend (Postgres + Auth + Realtime).
   Remplace Base44. Activé dès que js/config.js contient une URL + clé.
   Le schéma correspondant se trouve dans supabase/schema.sql.
   ===================================================================== */
import { CONFIG } from "../config.js?v=202611120042";
import { isNative } from "../lib/native.js?v=202611120042";

// Lien des e-mails (confirmation, connexion) : le site public, même depuis l'app
const returnUrl = () => (isNative() ? CONFIG.PUBLIC_URL : location.origin + location.pathname);

const SUPABASE_ESM = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

let sb = null;
let profile = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => { try { fn(); } catch {} });

function check({ data, error }) {
  if (error) throw new Error(translate(error.message));
  return data;
}
function translate(msg = "") {
  if (/Invalid login credentials/i.test(msg)) return "Email ou mot de passe incorrect.";
  if (/already registered/i.test(msg)) return "Un compte existe déjà avec cet email.";
  if (/Password should be at least/i.test(msg)) return "Le mot de passe doit contenir au moins 6 caractères.";
  if (/Email not confirmed/i.test(msg)) return "Confirmez d'abord votre email (vérifiez votre boîte de réception).";
  if (/PARTIE_FULL/.test(msg)) return "Désolé, cette partie n'a plus de place.";
  if (/ALREADY_JOINED/.test(msg)) return "Vous participez déjà à cette partie.";
  if (/HOST_CANNOT_LEAVE/.test(msg)) return "L'organisateur·rice ne peut pas quitter sa propre partie.";
  return msg || "Une erreur est survenue.";
}

async function loadProfile(userId) {
  if (!userId) { profile = null; return null; }
  const { data } = await sb.from("profiles").select("*").eq("id", userId).maybeSingle();
  profile = data || null;
  return profile;
}

function requireMe() {
  if (!profile) throw new Error("Vous devez être connecté·e.");
  return profile;
}

/* ===================================================================== */
export const supabaseAdapter = {
  mode: "supabase",

  async init() {
    const { createClient } = await import(SUPABASE_ESM);
    sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    const { data: { session } } = await sb.auth.getSession();
    await loadProfile(session?.user?.id);

    sb.auth.onAuthStateChange(async (_evt, s) => {
      await loadProfile(s?.user?.id);
      emit();
    });

    // Temps réel : nouveaux messages, parties, participations
    sb.channel("gathirl-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, emit)
      .on("postgres_changes", { event: "*", schema: "public", table: "participations" }, emit)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, emit)
      .subscribe();
  },

  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  /* ---------------- Authentification ---------------- */
  auth: {
    user: () => (profile ? { ...profile } : null),

    async signIn({ email, password }) {
      const data = check(await sb.auth.signInWithPassword({ email: email.trim(), password }));
      return loadProfile(data.user.id);
    },

    async signUp({ email, password, full_name }) {
      const data = check(await sb.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: full_name?.trim() },
          emailRedirectTo: returnUrl(),
        },
      }));
      if (data.session) await loadProfile(data.user.id);
      return { user: profile, needsConfirmation: !data.session };
    },

    async signInWithGoogle() {
      check(await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: returnUrl() } }));
    },

    async resetPassword(email) {
      check(await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname + "#/connexion" }));
    },

    async signOut() { await sb.auth.signOut(); profile = null; emit(); },
  },

  /* ---------------- Profils ---------------- */
  profiles: {
    async get(id) { return check(await sb.from("profiles").select("*").eq("id", id).maybeSingle()); },
    async many(ids) {
      if (!ids.length) return [];
      return check(await sb.from("profiles").select("*").in("id", ids));
    },
    /** Les joueurs inscrits (annuaire « Joueurs près de chez vous ») */
    async list({ limit = 24 } = {}) {
      return check(await sb.from("profiles").select("*").order("created_at", { ascending: false }).limit(limit));
    },
    async update(patch) {
      const me = requireMe();
      const { id, email, created_at, ...clean } = patch;
      const data = check(await sb.from("profiles").update(clean).eq("id", me.id).select().single());
      profile = data;
      emit();
      return data;
    },
  },

  /* ---------------- Parties ---------------- */
  parties: {
    async listUpcoming() {
      const since = new Date(Date.now() - 3 * 3600000).toISOString();
      return check(await sb.from("parties").select("*").gte("date", since).not("status", "in", "(annulé,terminé)").order("date", { ascending: true }).limit(200));
    },
    async get(id) { return check(await sb.from("parties").select("*").eq("id", id).maybeSingle()); },
    async byIds(ids) {
      if (!ids.length) return [];
      return check(await sb.from("parties").select("*").in("id", ids));
    },
    async forHost(uid) { return check(await sb.from("parties").select("*").eq("host_id", uid)); },
    async create(data) {
      const me = requireMe();
      const row = { ...data, host_id: me.id, host_name: me.full_name || "Joueur" };
      return check(await sb.from("parties").insert(row).select().single());
    },
    async cancel(id) {
      return check(await sb.from("parties").update({ status: "annulé" }).eq("id", id).select().single());
    },
  },

  /* ---------------- Participations ---------------- */
  participations: {
    async all() { return check(await sb.from("participations").select("*").limit(2000)); },
    async forPartie(id) { return check(await sb.from("participations").select("*").eq("partie_id", id)); },
    async forUser(uid) { return check(await sb.from("participations").select("*").eq("user_id", uid)); },
    async join(partieId) {
      requireMe();
      return check(await sb.rpc("join_partie", { p_partie: partieId }));
    },
    async leave(partieId) {
      requireMe();
      return check(await sb.rpc("leave_partie", { p_partie: partieId }));
    },
  },

  /* ---------------- Amitiés ---------------- */
  friendships: {
    async forUser(id) {
      return check(await sb.from("friendships").select("*").or(`requester_id.eq.${id},receiver_id.eq.${id}`));
    },
    async request(toId) {
      const me = requireMe();
      const to = await supabaseAdapter.profiles.get(toId);
      check(await sb.from("friendships").insert({ requester_id: me.id, requester_name: me.full_name, receiver_id: toId, receiver_name: to?.full_name || "Joueur", status: "pending" }));
    },
    async accept(id) { check(await sb.from("friendships").update({ status: "accepted" }).eq("id", id)); },
    async remove(id) { check(await sb.from("friendships").delete().eq("id", id)); },
  },

  /* ---------------- Messages ---------------- */
  messages: {
    async mine() {
      if (!profile) return [];
      return check(await sb.from("messages").select("*").or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`).order("created_at", { ascending: false }).limit(1000));
    },
    async thread(otherId) {
      const me = requireMe();
      return check(await sb.from("messages").select("*")
        .or(`and(sender_id.eq.${me.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${me.id})`)
        .order("created_at", { ascending: true }).limit(500));
    },
    async send(otherId, content) {
      const me = requireMe();
      const other = await supabaseAdapter.profiles.get(otherId);
      return check(await sb.from("messages").insert({ sender_id: me.id, sender_name: me.full_name, receiver_id: otherId, receiver_name: other?.full_name || "Joueur", content }).select().single());
    },
    async markRead(otherId) {
      if (!profile) return;
      await sb.from("messages").update({ read: true }).eq("receiver_id", profile.id).eq("sender_id", otherId).eq("read", false);
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  },
};
