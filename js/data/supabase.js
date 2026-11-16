/* =====================================================================
   Adaptateur SUPABASE — vrai backend (Postgres + Auth + Realtime).
   Remplace Base44. Activé dès que js/config.js contient une URL + clé.
   Le schéma correspondant se trouve dans supabase/schema.sql.
   ===================================================================== */
import { CONFIG } from "../config.js?v=202611160255";
import { isNative } from "../lib/native.js?v=202611160255";

// Lien des e-mails (confirmation, connexion) : le site public, même depuis l'app
const returnUrl = () => (isNative() ? CONFIG.PUBLIC_URL : location.origin + location.pathname);

// Retour dans l'application après une connexion Google / GitHub / Apple
const APP_RETURN = "fr.gathirl.app://auth";
function listenForAppReturn() {
  const app = window.Capacitor?.Plugins?.App;
  app?.addListener?.("appUrlOpen", async ({ url }) => {
    if (!url?.startsWith(APP_RETURN)) return;
    const code = new URL(url.replace("fr.gathirl.app://", "https://app.local/")).searchParams.get("code");
    window.Capacitor?.Plugins?.Browser?.close?.().catch?.(() => {});
    if (code) await sb.auth.exchangeCodeForSession(code);
  });
}

// (même adresse dans le <link rel="modulepreload"> de index.html : à changer aux deux endroits)
const SUPABASE_ESM ="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

let sb = null;
let profile = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => { try { fn(); } catch {} });
// Les alertes temps réel arrivent souvent en rafale : un seul rafraîchissement des vues
let emitTimer = 0;
const emitSoon = () => { clearTimeout(emitTimer); emitTimer = setTimeout(emit, 300); };

/* ---------------- Cache des lectures ----------------
   Chaque page relisait tout sur le serveur à chaque visite : désormais une
   lecture identique faite il y a moins d'une minute est resservie aussitôt
   (et deux lectures simultanées identiques ne partent qu'une fois). Le cache
   est vidé à chaque écriture et à chaque changement signalé en temps réel. */
const TTL = 60_000;
const cache = new Map();   // clé → { t, p }
function cached(key, fn, ttl = TTL) {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.t > ttl) {
    const p = fn();
    p.catch(() => cache.delete(key));
    cache.set(key, { t: Date.now(), p });
  }
  // une copie : une vue qui trie ou modifie sa liste ne touche pas au cache
  return cache.get(key).p.then((d) => (d && typeof d === "object" ? structuredClone(d) : d));
}
const invalidate = (...prefixes) => {
  for (const k of [...cache.keys()]) if (!prefixes.length || prefixes.some((x) => k.startsWith(x))) cache.delete(k);
};
const q = async (builder) => check(await builder);

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

const PROFILE_KEY = "gathirl:profil";
const saveProfile = () => { try { profile ? localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)) : localStorage.removeItem(PROFILE_KEY); } catch {} };
async function fetchProfile(userId) {
  const { data } = await sb.from("profiles").select("*").eq("id", userId).maybeSingle();
  return data || null;
}
/** Au démarrage, le profil gardé sur l'appareil s'affiche tout de suite ; la version
    du serveur arrive ensuite en arrière-plan (plus d'attente réseau avant la 1re page). */
async function loadProfile(userId, { background = false } = {}) {
  if (!userId) { profile = null; saveProfile(); return null; }
  let local = null;
  try { local = JSON.parse(localStorage.getItem(PROFILE_KEY)); } catch {}
  if (background && local?.id === userId) {
    profile = local;
    fetchProfile(userId).then((fresh) => {
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(profile)) { profile = fresh; saveProfile(); emit(); }
    }).catch(() => {});
    return profile;
  }
  profile = await fetchProfile(userId);
  saveProfile();
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
      // PKCE : le fournisseur renvoie « ?code=… » (compatible avec le routeur à #), échangé contre une session
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
    });
    const { data: { session } } = await sb.auth.getSession();
    // Retour d'un fournisseur (Google, GitHub, Apple) : on retire le code de l'adresse
    if (/[?&](code|error)=/.test(location.search)) history.replaceState(null, "", location.pathname + location.hash);
    if (isNative()) listenForAppReturn();
    await loadProfile(session?.user?.id, { background: true });

    // Seul un changement de compte compte (le renouvellement automatique du jeton
    // relançait jusqu'ici le chargement complet de la page)
    sb.auth.onAuthStateChange(async (_evt, s) => {
      const id = s?.user?.id || null;
      if (id === (profile?.id || null)) return;
      invalidate();
      await loadProfile(id);
      emit();
    });

    // Temps réel : on vide seulement le cache concerné, puis un seul rafraîchissement groupé
    const live = (...prefixes) => () => { invalidate(...prefixes); emitSoon(); };
    sb.channel("gathirl-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, live("messages"))
      .on("postgres_changes", { event: "*", schema: "public", table: "participations" }, live("participations", "parties"))
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, live("friendships"))
      .on("postgres_changes", { event: "*", schema: "public", table: "parties" }, live("parties"))
      .subscribe();
  },

  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  /* ---------------- Authentification ---------------- */
  auth: {
    user: () => (profile ? { ...profile } : null),

    async signIn({ email, password }) {
      const data = check(await sb.auth.signInWithPassword({ email: email.trim(), password }));
      invalidate();
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

    /** Fournisseurs de connexion activés dans Supabase (Authentication → Sign In / Providers) */
    async providers() {
      try {
        const r = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: CONFIG.SUPABASE_ANON_KEY } });
        const ext = (await r.json()).external || {};
        return ["google", "apple", "discord", "github", "twitch"].filter((p) => ext[p]);
      } catch { return []; }
    },

    /** Connexion via Google, GitHub ou Apple */
    async signInWithProvider(provider) {
      if (!isNative()) {
        check(await sb.auth.signInWithOAuth({ provider, options: { redirectTo: returnUrl() } }));
        return;
      }
      // App : la page du fournisseur s'ouvre dans le navigateur du téléphone,
      // puis revient dans l'app par le lien fr.gathirl.app://auth
      const data = check(await sb.auth.signInWithOAuth({ provider, options: { redirectTo: APP_RETURN, skipBrowserRedirect: true } }));
      const browser = window.Capacitor?.Plugins?.Browser;
      if (browser) await browser.open({ url: data.url, presentationStyle: "popover" });
      else location.href = data.url;
    },

    async resetPassword(email) {
      check(await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname + "#/connexion" }));
    },

    async signOut() { await sb.auth.signOut(); profile = null; saveProfile(); invalidate(); emit(); },

    /** Supprime définitivement le compte et tout ce qui s'y rattache (fonction SQL delete_my_account) */
    async deleteAccount() {
      requireMe();
      check(await sb.rpc("delete_my_account"));
      await sb.auth.signOut({ scope: "local" }).catch(() => {});
      profile = null;
      saveProfile();
      invalidate();
      emit();
    },
  },

  /* ---------------- Profils ---------------- */
  profiles: {
    get(id) { return cached(`profiles:get:${id}`, () => q(sb.from("profiles").select("*").eq("id", id).maybeSingle())); },
    async many(ids) {
      if (!ids.length) return [];
      const key = [...new Set(ids)].sort().join(",");
      return cached(`profiles:many:${key}`, () => q(sb.from("profiles").select("*").in("id", ids)));
    },
    /** Les joueurs inscrits (annuaire « Joueurs près de chez vous ») */
    list({ limit = 24 } = {}) {
      return cached(`profiles:list:${limit}`, () => q(sb.from("profiles").select("*").order("created_at", { ascending: false }).limit(limit)));
    },
    /** Recherche de comptes par nom ou par ville (page Social) */
    async search(q, { limit = 30 } = {}) {
      // on retire les caractères qui ont un sens dans un filtre PostgREST (virgules, parenthèses, jokers)
      const t = String(q || "").replace(/[%_,()*\\:"']/g, " ").trim();
      if (!t) return [];
      return check(await sb.from("profiles").select("*").or(`full_name.ilike.%${t}%,city.ilike.%${t}%`).order("full_name").limit(limit));
    },
    async update(patch) {
      const me = requireMe();
      const { id, email, created_at, ...clean } = patch;
      const data = check(await sb.from("profiles").update(clean).eq("id", me.id).select().single());
      profile = data;
      saveProfile();
      invalidate("profiles", "parties", "participations");   // le nom est recopié dans les parties et inscriptions
      emit();
      return data;
    },
  },

  /* ---------------- Parties ---------------- */
  parties: {
    listUpcoming() {
      return cached("parties:upcoming", () => {
        const since = new Date(Date.now() - 3 * 3600000).toISOString();
        return q(sb.from("parties").select("*").gte("date", since).not("status", "in", "(annulé,terminé)").order("date", { ascending: true }).limit(200));
      });
    },
    get(id) { return cached(`parties:get:${id}`, () => q(sb.from("parties").select("*").eq("id", id).maybeSingle())); },
    async byIds(ids) {
      if (!ids.length) return [];
      return cached(`parties:ids:${[...ids].sort().join(",")}`, () => q(sb.from("parties").select("*").in("id", ids)));
    },
    forHost(uid) { return cached(`parties:host:${uid}`, () => q(sb.from("parties").select("*").eq("host_id", uid))); },
    async create(data) {
      const me = requireMe();
      const row = { ...data, host_id: me.id, host_name: me.full_name || "Joueur" };
      const r = check(await sb.from("parties").insert(row).select().single());
      invalidate("parties", "participations");
      return r;
    },
    async cancel(id) {
      const r = check(await sb.from("parties").update({ status: "annulé" }).eq("id", id).select().single());
      invalidate("parties");
      return r;
    },
  },

  /* ---------------- Participations ---------------- */
  participations: {
    all() { return cached("participations:all", () => q(sb.from("participations").select("*").limit(2000))); },
    /** Seulement les inscriptions des parties affichées (au lieu de toutes) */
    async forParties(ids) {
      if (!ids.length) return [];
      return cached(`participations:parties:${[...ids].sort().join(",")}`, async () => {
        const chunks = [];
        for (let i = 0; i < ids.length; i += 60) chunks.push(ids.slice(i, i + 60));   // adresses courtes
        const parts = await Promise.all(chunks.map((c) => q(sb.from("participations").select("*").in("partie_id", c))));
        return parts.flat();
      });
    },
    forPartie(id) { return cached(`participations:partie:${id}`, () => q(sb.from("participations").select("*").eq("partie_id", id))); },
    forUser(uid) { return cached(`participations:user:${uid}`, () => q(sb.from("participations").select("*").eq("user_id", uid))); },
    async join(partieId) {
      requireMe();
      const r = check(await sb.rpc("join_partie", { p_partie: partieId }));
      invalidate("participations", "parties");
      return r;
    },
    async leave(partieId) {
      requireMe();
      const r = check(await sb.rpc("leave_partie", { p_partie: partieId }));
      invalidate("participations", "parties");
      return r;
    },
  },

  /* ---------------- Amitiés ---------------- */
  friendships: {
    forUser(id) {
      return cached(`friendships:${id}`, () => q(sb.from("friendships").select("*").or(`requester_id.eq.${id},receiver_id.eq.${id}`)));
    },
    async request(toId) {
      const me = requireMe();
      const to = await supabaseAdapter.profiles.get(toId);
      check(await sb.from("friendships").insert({ requester_id: me.id, requester_name: me.full_name, receiver_id: toId, receiver_name: to?.full_name || "Joueur", status: "pending" }));
      invalidate("friendships");
    },
    async accept(id) { check(await sb.from("friendships").update({ status: "accepted" }).eq("id", id)); invalidate("friendships"); },
    async remove(id) { check(await sb.from("friendships").delete().eq("id", id)); invalidate("friendships"); },
  },

  /* ---------------- Messages ---------------- */
  messages: {
    async mine() {
      if (!profile) return [];
      const id = profile.id;
      return cached(`messages:mine:${id}`, () => q(sb.from("messages").select("*").or(`sender_id.eq.${id},receiver_id.eq.${id}`).order("created_at", { ascending: false }).limit(1000)));
    },
    /** Nombre de missives non lues : une simple requête de comptage (pastille rouge) */
    async unreadCount() {
      if (!profile) return 0;
      const id = profile.id;
      return cached(`messages:unread:${id}`, async () => {
        const { count, error } = await sb.from("messages").select("id", { count: "exact", head: true }).eq("receiver_id", id).eq("read", false);
        if (error) throw new Error(translate(error.message));
        return count || 0;
      });
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
      const r = check(await sb.from("messages").insert({ sender_id: me.id, sender_name: me.full_name, receiver_id: otherId, receiver_name: other?.full_name || "Joueur", content }).select().single());
      invalidate("messages");
      return r;
    },
    async markRead(otherId) {
      if (!profile) return;
      await sb.from("messages").update({ read: true }).eq("receiver_id", profile.id).eq("sender_id", otherId).eq("read", false);
      invalidate("messages");
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  },
};
