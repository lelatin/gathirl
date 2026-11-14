/* =====================================================================
   Adaptateur MODE DÉMO — tout est stocké dans ce navigateur.
   Même API que l'adaptateur Supabase : les vues ne voient pas la
   différence. Idéal pour tester le site sur GitHub Pages sans backend.
   ===================================================================== */

const KEY = "gathirl:demo:v1";
const listeners = new Set();
let mem = null; // copie mémoire (si localStorage est indisponible)

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const now = () => new Date().toISOString();

/* ---------------- Stockage ---------------- */
function load() {
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(KEY);
    mem = raw ? JSON.parse(raw) : seed();
    // Première visite : on enregistre tout de suite les données d'exemple, sinon
    // elles seraient régénérées (nouveaux identifiants, illustrations) à chaque chargement
    if (!raw) { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch {} }
    // Migration : plus de tiret long dans les titres enregistrés
    mem.parties?.forEach((p) => { if (p.title?.includes(" — ")) p.title = p.title.replaceAll(" — ", " · "); });
  } catch {
    mem = seed();
  }
  return mem;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* navigation privée : on reste en mémoire */ }
  emit();
}
function emit() { listeners.forEach((fn) => { try { fn(); } catch {} }); }

// Synchronisation entre onglets
window.addEventListener("storage", (e) => {
  if (e.key === KEY) { mem = null; emit(); }
});

async function digest(text) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("gathirl:" + text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return "plain:" + text;
  }
}

/* ---------------- Données d'exemple ---------------- */
function seed() {
  const day = 86400000;
  const at = (d, h, m = 0) => {
    const x = new Date(Date.now() + d * day);
    x.setHours(h, m, 0, 0);
    return x.toISOString();
  };
  const users = [
    { id: "u-morgane", full_name: "Morgane L.", email: "morgane@demo.gathirl", city: "Paris", city_lat: 48.8566, city_lng: 2.3522, skill_level: "Compétitif", favorite_formats: ["Modern", "Legacy"], bio: "Joueuse de Burn depuis Kaladesh. Je cherche des sparring-partners avant les RCQ." },
    { id: "u-yanis", full_name: "Yanis B.", email: "yanis@demo.gathirl", city: "Lyon", city_lat: 45.764, city_lng: 4.8357, skill_level: "Casual", favorite_formats: ["Commander", "Cube"], bio: "Mon deck préféré : Atraxa superfriends. Toujours partant pour une table à 4 et des chips." },
    { id: "u-clem", full_name: "Clémence R.", email: "clem@demo.gathirl", city: "Bordeaux", city_lat: 44.8378, city_lng: -0.5792, skill_level: "Débutant", favorite_formats: ["Draft", "Sealed"], bio: "J'ai découvert Magic il y a trois mois et je veux tout apprendre !" },
    { id: "u-tom", full_name: "Tom D.", email: "tom@demo.gathirl", city: "Lille", city_lat: 50.6292, city_lng: 3.0573, skill_level: "Casual", favorite_formats: ["Pauper", "Commander"], bio: "Pauper is the best format. Change my mind." },
    { id: "u-ines", full_name: "Inès K.", email: "ines@demo.gathirl", city: "Nantes", city_lat: 47.2184, city_lng: -1.5536, skill_level: "Compétitif", favorite_formats: ["Pioneer", "Standard"], bio: "Organisatrice de la ligue du jeudi. Les tables sont ouvertes à tous." },
  ];
  const P = (o) => ({ id: uid(), status: "ouvert", created_at: now(), location_address: "", description: "", ...o });
  const parties = [
    P({ title: "Commander du vendredi soir", format: "Commander", level: "Casual", date: at(2, 20), city: "Lyon", location: "Le Dé Pipé", location_lat: 45.7597, location_lng: 4.8422, max_players: 4, current_players: 3, host_id: "u-yanis", host_name: "Yanis B.", description: "Tables à 4, power level 6-7. Pas de combo infini au tour 3 s'il vous plaît 🙏\nBoissons sur place." }),
    P({ title: "Draft Bloomburrow · 8 joueurs", format: "Draft", level: "Débutant", date: at(4, 14), city: "Bordeaux", location: "Ludothèque des Chartrons", location_lat: 44.8530, location_lng: -0.5700, max_players: 8, current_players: 5, host_id: "u-clem", host_name: "Clémence R.", description: "Draft pour débutant·es, on explique les règles du draft avant de commencer. Boosters à prévoir (ou à acheter sur place)." }),
    P({ title: "Préparation RCQ Modern", format: "Modern", level: "Compétitif", date: at(5, 19, 30), city: "Paris", location: "Taverne du Gobelin", location_lat: 48.8625, location_lng: 2.3601, max_players: 6, current_players: 2, host_id: "u-morgane", host_name: "Morgane L.", description: "Testing sérieux en BO3. Apportez vos sideboards et votre meilleure mauvaise foi." }),
    P({ title: "Pauper & pizzas", format: "Pauper", level: "Casual", date: at(7, 19), city: "Lille", location: "Chez Tom (Vieux-Lille)", location_lat: 50.6400, location_lng: 3.0630, max_players: 4, current_players: 4, status: "complet", host_id: "u-tom", host_name: "Tom D.", description: "Complet cette semaine, mais revenez la prochaine !" }),
    P({ title: "Ligue Pioneer du jeudi", format: "Pioneer", level: "Compétitif", date: at(9, 19), city: "Nantes", location: "L'Antre du Dragon", location_lat: 47.2130, location_lng: -1.5560, max_players: 12, current_players: 7, host_id: "u-ines", host_name: "Inès K.", description: "Format suisse, 4 rondes. Lots pour le top 4." }),
    P({ title: "Cube vintage maison", format: "Cube", level: "Casual", date: at(12, 15), city: "Lyon", location: "Café Ludique La Pioche", location_lat: 45.7700, location_lng: 4.8300, max_players: 8, current_players: 3, host_id: "u-yanis", host_name: "Yanis B.", description: "Mon cube de 540 cartes, power inclus (proxies). Draft à 8." }),
  ];
  const participations = [];
  for (const p of parties) {
    participations.push({ id: uid(), partie_id: p.id, user_id: p.host_id, user_name: p.host_name, status: "inscrit", created_at: now() });
    const extras = users.filter((u) => u.id !== p.host_id).slice(0, Math.max(0, p.current_players - 1));
    for (const u of extras) participations.push({ id: uid(), partie_id: p.id, user_id: u.id, user_name: u.full_name, status: "inscrit", created_at: now() });
    // compléter avec des joueurs "fantômes" si besoin
    const missing = p.current_players - 1 - extras.length;
    for (let i = 0; i < missing; i++) participations.push({ id: uid(), partie_id: p.id, user_id: "ghost-" + i, user_name: "Joueur·se invité·e", status: "inscrit", created_at: now() });
  }
  return { users, credentials: {}, parties, participations, friendships: [], messages: [], session: null };
}

/* ---------------- Aides ---------------- */
const db = () => load();
const me = () => db().users.find((u) => u.id === db().session) || null;
function requireMe() {
  const u = me();
  if (!u) throw new Error("Vous devez être connecté·e.");
  return u;
}
const publicUser = (u) => (u ? { ...u } : null);

/* ===================================================================== */
export const localAdapter = {
  mode: "demo",

  async init() { load(); },

  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  /* ---------------- Authentification ---------------- */
  auth: {
    user: () => publicUser(me()),

    async signIn({ email, password }) {
      const d = db();
      const u = d.users.find((x) => x.email?.toLowerCase() === email.trim().toLowerCase());
      if (!u || d.credentials[u.id] !== (await digest(password))) throw new Error("Email ou mot de passe incorrect.");
      d.session = u.id; save();
      return publicUser(u);
    },

    async signUp({ email, password, full_name }) {
      const d = db();
      if (d.users.some((x) => x.email?.toLowerCase() === email.trim().toLowerCase())) throw new Error("Un compte existe déjà avec cet email.");
      const u = { id: uid(), email: email.trim(), full_name: full_name?.trim() || email.split("@")[0], city: "", city_lat: null, city_lng: null, skill_level: "Casual", favorite_formats: [], bio: "", avatar_url: null, created_at: now() };
      d.users.push(u);
      d.credentials[u.id] = await digest(password);
      d.session = u.id; save();
      return { user: publicUser(u), needsConfirmation: false };
    },

    async signInWithGoogle() { throw new Error("Indisponible en mode démo."); },
    async providers() { return []; },
    async signInWithProvider() { throw new Error("Indisponible en mode démo."); },
    async resetPassword() { throw new Error("Indisponible en mode démo."); },

    async signOut() { db().session = null; save(); },

    /** Démo : retire le joueur et tout ce qui s'y rattache (comme la cascade de Supabase) */
    async deleteAccount() {
      const me = requireMe(), d = db();
      const mine = new Set(d.parties.filter((p) => p.host_id === me.id).map((p) => p.id));
      for (const pa of d.participations) {
        if (pa.user_id !== me.id || mine.has(pa.partie_id)) continue;
        const p = d.parties.find((x) => x.id === pa.partie_id);
        if (p) { p.current_players = Math.max(0, p.current_players - 1); if (p.status === "complet") p.status = "ouvert"; }
      }
      d.parties = d.parties.filter((p) => !mine.has(p.id));
      d.participations = d.participations.filter((pa) => pa.user_id !== me.id && !mine.has(pa.partie_id));
      d.friendships = d.friendships.filter((f) => f.requester_id !== me.id && f.receiver_id !== me.id);
      d.messages = d.messages.filter((m) => m.sender_id !== me.id && m.receiver_id !== me.id);
      d.users = d.users.filter((u) => u.id !== me.id);
      delete d.credentials[me.id];
      d.session = null;
      save();
    },
  },

  /* ---------------- Profils ---------------- */
  profiles: {
    async get(id) { return publicUser(db().users.find((u) => u.id === id)); },
    async many(ids) { const s = new Set(ids); return db().users.filter((u) => s.has(u.id)).map(publicUser); },
    /** Les joueurs inscrits (annuaire « Joueurs près de chez vous ») */
    async list({ limit = 24 } = {}) { return db().users.slice(0, limit).map(publicUser); },
    /** Recherche de comptes par nom ou par ville (page Social) */
    async search(q, { limit = 30 } = {}) {
      const n = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
      const t = n(q).trim();
      if (!t) return [];
      return db().users.filter((u) => n(u.full_name).includes(t) || n(u.city).includes(t)).slice(0, limit).map(publicUser);
    },
    async update(patch) {
      const u = requireMe();
      Object.assign(u, patch, { id: u.id, email: u.email });
      // répercuter le nom dénormalisé
      if (patch.full_name) {
        const d = db();
        d.parties.forEach((p) => { if (p.host_id === u.id) p.host_name = u.full_name; });
        d.participations.forEach((p) => { if (p.user_id === u.id) p.user_name = u.full_name; });
      }
      save();
      return publicUser(u);
    },
  },

  /* ---------------- Parties ---------------- */
  parties: {
    async listUpcoming() {
      const t = Date.now();
      return db().parties
        .filter((p) => new Date(p.date).getTime() >= t - 3 * 3600000 && !["annulé", "terminé"].includes(p.status))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    },
    async get(id) { return db().parties.find((p) => p.id === id) || null; },
    async byIds(ids) { const s = new Set(ids); return db().parties.filter((p) => s.has(p.id)); },
    async forHost(uid_) { return db().parties.filter((p) => p.host_id === uid_); },
    async create(data) {
      const u = requireMe();
      const p = {
        id: uid(), created_at: now(), status: "ouvert", current_players: 1,
        host_id: u.id, host_name: u.full_name || u.email,
        ...data,
      };
      const d = db();
      d.parties.push(p);
      d.participations.push({ id: uid(), partie_id: p.id, user_id: u.id, user_name: p.host_name, status: "inscrit", created_at: now() });
      save();
      return p;
    },
    async cancel(id) {
      const u = requireMe();
      const p = db().parties.find((x) => x.id === id);
      if (!p || p.host_id !== u.id) throw new Error("Action non autorisée.");
      p.status = "annulé"; save();
      return p;
    },
  },

  /* ---------------- Participations ---------------- */
  participations: {
    async all() { return [...db().participations]; },
    async forPartie(id) { return db().participations.filter((p) => p.partie_id === id); },
    async forUser(uid_) { return db().participations.filter((p) => p.user_id === uid_); },
    async join(partieId) {
      const u = requireMe();
      const d = db();
      const p = d.parties.find((x) => x.id === partieId);
      if (!p) throw new Error("Partie introuvable.");
      if (d.participations.some((x) => x.partie_id === partieId && x.user_id === u.id)) { const e = new Error("Vous participez déjà à cette partie."); e.code = "already"; throw e; }
      if (p.current_players >= p.max_players) { const e = new Error("Désolé, cette partie n'a plus de place."); e.code = "full"; throw e; }
      d.participations.push({ id: uid(), partie_id: p.id, user_id: u.id, user_name: u.full_name || u.email, status: "inscrit", created_at: now() });
      p.current_players += 1;
      p.status = p.current_players >= p.max_players ? "complet" : "ouvert";
      save();
      return { ...p };
    },
    async leave(partieId) {
      const u = requireMe();
      const d = db();
      const p = d.parties.find((x) => x.id === partieId);
      if (!p) throw new Error("Partie introuvable.");
      if (p.host_id === u.id) throw new Error("L'organisateur·rice ne peut pas quitter sa propre partie.");
      const before = d.participations.length;
      d.participations = d.participations.filter((x) => !(x.partie_id === partieId && x.user_id === u.id));
      if (d.participations.length < before) {
        p.current_players = Math.max(1, p.current_players - 1);
        p.status = "ouvert";
      }
      save();
      return { ...p };
    },
  },

  /* ---------------- Amitiés ---------------- */
  friendships: {
    async forUser(id) { return db().friendships.filter((f) => f.requester_id === id || f.receiver_id === id); },
    async request(toId) {
      const u = requireMe();
      const d = db();
      if (d.friendships.some((f) => (f.requester_id === u.id && f.receiver_id === toId) || (f.requester_id === toId && f.receiver_id === u.id))) return;
      const to = d.users.find((x) => x.id === toId);
      d.friendships.push({ id: uid(), requester_id: u.id, requester_name: u.full_name, receiver_id: toId, receiver_name: to?.full_name || "Joueur", status: "pending", created_at: now() });
      save();
    },
    async accept(id) {
      const u = requireMe();
      const f = db().friendships.find((x) => x.id === id && x.receiver_id === u.id);
      if (f) { f.status = "accepted"; save(); }
    },
    async remove(id) {
      const u = requireMe();
      const d = db();
      d.friendships = d.friendships.filter((f) => !(f.id === id && (f.requester_id === u.id || f.receiver_id === u.id)));
      save();
    },
  },

  /* ---------------- Messages ---------------- */
  messages: {
    async mine() {
      const u = me();
      if (!u) return [];
      return db().messages.filter((m) => m.sender_id === u.id || m.receiver_id === u.id);
    },
    async thread(otherId) {
      const u = requireMe();
      return db().messages
        .filter((m) => (m.sender_id === u.id && m.receiver_id === otherId) || (m.sender_id === otherId && m.receiver_id === u.id))
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    },
    async send(otherId, content) {
      const u = requireMe();
      const d = db();
      const other = d.users.find((x) => x.id === otherId);
      const m = { id: uid(), sender_id: u.id, sender_name: u.full_name, receiver_id: otherId, receiver_name: other?.full_name || "Joueur", content, read: false, created_at: now() };
      d.messages.push(m);
      save();
      // Démo : les joueurs d'exemple répondent pour montrer la messagerie en action
      if (other && otherId.startsWith("u-")) {
        const lines = [
          "Avec plaisir ! Tu joues quel deck ?",
          "Carrément, je ramène mes dés et mes tokens.",
          "Ça marche, rendez-vous à la table. Que la pioche te soit favorable !",
          "Top ! On se retrouve sur place 🔥",
        ];
        setTimeout(() => {
          db().messages.push({ id: uid(), sender_id: otherId, sender_name: other.full_name, receiver_id: u.id, receiver_name: u.full_name, content: lines[Math.floor(Math.random() * lines.length)], read: false, created_at: now() });
          save();
        }, 1600);
      }
      return m;
    },
    async markRead(otherId) {
      const u = me();
      if (!u) return;
      let changed = false;
      db().messages.forEach((m) => { if (m.sender_id === otherId && m.receiver_id === u.id && !m.read) { m.read = true; changed = true; } });
      if (changed) save();
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  },

  /* Remettre la démo à zéro */
  reset() { try { localStorage.removeItem(KEY); } catch {} mem = null; load(); save(); },
};
