/* =====================================================================
   LE PACTE — connexion & inscription
   ===================================================================== */
import { $, html, icon, mount } from "../lib/dom.js?v=202611120042";
import { db } from "../data/index.js?v=202611120042";
import { CONFIG } from "../config.js?v=202611120042";
import { toast } from "../ui/toast.js?v=202611120042";

function safeReturn(q) {
  const r = q.get("retour") || "#/";
  return r.startsWith("#/") ? r : "#/";
}

export async function render(el, ctx) {
  const isSignup = ctx.path === "/inscription";
  const back = safeReturn(ctx.query);
  const demo = db.mode === "demo";

  if (db.auth.user()) { location.replace(back); return; }

  mount(el, html`
    <div class="wrap pact">
      <div class="panel panel--corners pact__card">
        <h1>${isSignup ? "Signer le pacte" : "Franchir la porte"}</h1>
        <p>${isSignup ? "Créez votre compte pour rejoindre et organiser des parties." : "Connectez-vous pour rejoindre vos tables."}</p>

        ${demo ? html`<p class="demo-note">✦ MODE DÉMO : votre compte est stocké uniquement dans ce navigateur. ${!isSignup ? "Pas encore de compte ? Inscrivez-vous en 10 secondes." : ""}</p>` : ""}

        ${!demo && CONFIG.GOOGLE_AUTH ? html`
          <button type="button" class="btn btn--block" data-google>${icon("google")} Continuer avec Google</button>
          <p class="pact__sep">ou</p>` : ""}

        <form class="form" novalidate>
          ${isSignup ? html`<label class="field"><span>Nom d'aventurier·e</span><input class="input" name="full_name" autocomplete="nickname" maxlength="60" placeholder="Ex. Morgane la Rouge" required /></label>` : ""}
          <label class="field"><span>Email</span><input class="input" type="email" name="email" autocomplete="email" inputmode="email" autocapitalize="none" placeholder="vous@exemple.com" required /></label>
          <label class="field"><span>Mot de passe</span><input class="input" type="password" name="password" autocomplete="${isSignup ? "new-password" : "current-password"}" minlength="6" placeholder="••••••••" required /></label>
          <p class="form-error" role="alert" hidden></p>
          <button type="submit" class="btn btn--primary btn--block">${isSignup ? "Créer mon compte" : "Se connecter"}</button>
          ${!isSignup && !demo ? html`<button type="button" class="link" style="justify-self:center;font-size:15px" data-forgot>Mot de passe oublié ?</button>` : ""}
        </form>

        <p class="pact__foot">
          ${isSignup
            ? html`Déjà un compte ? <a class="link" href="#/connexion${back !== "#/" ? "?retour=" + encodeURIComponent(back) : ""}">Se connecter</a>`
            : html`Pas encore de compte ? <a class="link" href="#/inscription${back !== "#/" ? "?retour=" + encodeURIComponent(back) : ""}">S'inscrire</a>`}
        </p>
      </div>
    </div>`);

  const form = $("form", el);
  const err = $(".form-error", form);
  const fail = (m) => { err.textContent = m; err.hidden = false; };
  (form.full_name || form.email).focus();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.hidden = true;
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Cet email ne ressemble pas à une adresse valide.");
    if (password.length < 6) return fail("Le mot de passe doit contenir au moins 6 caractères.");
    const btn = $("[type=submit]", form);
    btn.disabled = true;
    try {
      if (isSignup) {
        const { needsConfirmation } = await db.auth.signUp({ email, password, full_name: form.full_name.value });
        if (needsConfirmation) {
          toast("Vérifiez vos emails", "Un lien de confirmation vous a été envoyé.");
          btn.disabled = false;
          return;
        }
        toast.success("Bienvenue dans la guilde !", "Complétez votre fiche pour que les joueurs vous trouvent.");
        location.hash = back === "#/" ? "#/profil" : back;
      } else {
        await db.auth.signIn({ email, password });
        toast.success("Bon retour !", "La taverne vous attendait.");
        location.hash = back;
      }
    } catch (ex) {
      fail(ex.message);
      btn.disabled = false;
    }
  });

  $("[data-google]", el)?.addEventListener("click", () => db.auth.signInWithGoogle().catch((ex) => fail(ex.message)));
  $("[data-forgot]", el)?.addEventListener("click", async () => {
    const email = form.email.value.trim();
    if (!email) { form.email.focus(); return fail("Saisissez d'abord votre email."); }
    try { await db.auth.resetPassword(email); toast("Lien envoyé", "Si un compte existe, vous recevrez un email."); }
    catch (ex) { fail(ex.message); }
  });
}
