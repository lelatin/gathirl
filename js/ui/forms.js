/* =====================================================================
   Formulaires : création de partie, édition de la fiche, saisie de lieu
   ===================================================================== */
import { $, $$, html, icon, mount, debounce } from "../lib/dom.js";
import { FORMATS, LEVELS, levelPip, toLocalInput } from "../lib/format.js";
import { searchPlaces } from "../lib/geo.js";
import { db } from "../data/index.js";
import { openModal } from "./modal.js";
import { toast } from "./toast.js";

/* ---------------------------------------------------------------------
   Champ avec suggestions de lieux (combobox ARIA, clavier ↑ ↓ Entrée)
   --------------------------------------------------------------------- */
export function attachPlaceCombo(input, { cityOnly = false, onPick } = {}) {
  const wrap = input.closest(".combo");
  const listId = input.id + "-list";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", listId);
  input.setAttribute("autocomplete", "off");

  let results = [];
  let active = -1;
  let ctrl = null;
  let list = null;

  const close = () => { list?.remove(); list = null; active = -1; input.setAttribute("aria-expanded", "false"); };
  const render = (state) => {
    if (!list) {
      list = document.createElement("div");
      list.className = "combo__list";
      list.id = listId;
      list.setAttribute("role", "listbox");
      wrap.append(list);
      input.setAttribute("aria-expanded", "true");
    }
    if (state === "loading") return mount(list, html`<p class="combo__empty">Consultation des cartes…</p>`);
    if (!results.length) return mount(list, html`<p class="combo__empty">Aucun résultat</p>`);
    mount(list, html`${results.map((r, i) => html`
      <button type="button" class="combo__item" role="option" id="${listId}-${i}" aria-selected="${i === active}" data-i="${i}">
        ${icon("pin")}<span>${r.name}<small>${r.sub}</small></span>
      </button>`)}`);
  };

  const pick = (r) => {
    input.value = cityOnly ? r.city || r.name : r.name;
    close();
    onPick?.(r);
  };

  const search = debounce(async () => {
    const q = input.value;
    if (q.trim().length < 2) return close();
    ctrl?.abort();
    ctrl = new AbortController();
    render("loading");
    try {
      results = await searchPlaces(q, cityOnly, ctrl.signal);
      active = -1;
      render();
    } catch (e) {
      if (e.name !== "AbortError") { results = []; render(); }
    }
  }, 280);

  input.addEventListener("input", () => { onPick?.(null); search(); });
  input.addEventListener("keydown", (e) => {
    if (!list || !results.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); active = (active + 1) % results.length; render(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = (active - 1 + results.length) % results.length; render(); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(results[active]); }
    else if (e.key === "Escape") { e.stopPropagation(); close(); }
    if (active >= 0) input.setAttribute("aria-activedescendant", `${listId}-${active}`);
  });
  wrap.addEventListener("click", (e) => {
    const b = e.target.closest(".combo__item");
    if (b) pick(results[+b.dataset.i]);
  });
  input.addEventListener("blur", () => setTimeout(close, 160));
}

/* ---------------------------------------------------------------------
   Organiser une partie
   --------------------------------------------------------------------- */
export function openCreatePartie({ onCreated, instant = false } = {}) {
  const me = db.auth.user();
  if (!me) {
    toast("Connexion requise", "Signez le pacte pour organiser une partie.");
    location.hash = "#/connexion?retour=" + encodeURIComponent("#/?organiser=1");
    return;
  }
  // Par défaut : samedi prochain 14h
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  d.setHours(14, 0, 0, 0);

  const body = html`
    <form class="form" novalidate>
      <label class="field"><span>Titre <b class="req">*</b></span>
        <input class="input" name="title" required maxlength="120" placeholder="Ex. Commander du vendredi soir" autocomplete="off" enterkeyhint="next" />
      </label>

      <div class="field-row field-row--2">
        <label class="field"><span>Format <b class="req">*</b></span>
          <select class="select" name="format">${FORMATS.map((f) => html`<option ${f === "Commander" ? "selected" : ""}>${f}</option>`)}</select>
        </label>
        <fieldset class="field" style="border:0;padding:0">
          <legend>Niveau</legend>
          <div style="display:flex;gap:6px;flex-wrap:wrap" role="radiogroup" aria-label="Niveau">
            ${LEVELS.map((l) => html`<button type="button" class="chip" role="radio" aria-checked="${l === "Casual"}" aria-pressed="${l === "Casual"}" data-level="${l}">${levelPip(l)}${l}</button>`)}
          </div>
        </fieldset>
      </div>

      <div class="field-row field-row--2">
        <label class="field"><span>Date et heure <b class="req">*</b></span>
          <input class="input" type="datetime-local" name="date" required value="${toLocalInput(d)}" min="${toLocalInput(new Date())}" />
        </label>
        <label class="field"><span>Joueurs max</span>
          <input class="input" type="number" name="max_players" min="2" max="20" value="4" inputmode="numeric" />
        </label>
      </div>

      <label class="field"><span>Ville <b class="req">*</b></span>
        <div class="combo"><input class="input" id="cp-city" name="city" required placeholder="Recherchez votre ville…" value="${me.city || ""}" /></div>
      </label>

      <label class="field"><span>Lieu (boutique, bar, chez vous…)</span>
        <div class="combo"><input class="input" id="cp-location" name="location" placeholder="Ex. Le Dé Pipé" /></div>
      </label>

      <label class="field"><span>Description</span>
        <textarea class="textarea" name="description" maxlength="2000" placeholder="Power level, règles maison, ce qu'il faut apporter…"></textarea>
      </label>

      <p class="form-error" role="alert" hidden></p>

      <div class="form-actions">
        <button type="button" class="btn btn--ghost" data-close>Annuler</button>
        <button type="submit" class="btn btn--primary">${icon("sparkle")} Publier la partie</button>
      </div>
    </form>`;

  openModal({
    title: "Organiser une partie",
    instant,
    body,
    onMount(dlg, close) {
      const form = $("form", dlg);
      const err = $(".form-error", form);
      let level = "Casual";
      let place = null;
      let cityCoords = me.city_lat ? { lat: me.city_lat, lng: me.city_lng } : null;

      $$("[data-level]", form).forEach((b) => b.addEventListener("click", () => {
        level = b.dataset.level;
        $$("[data-level]", form).forEach((x) => { const on = x === b; x.setAttribute("aria-pressed", on); x.setAttribute("aria-checked", on); });
      }));

      attachPlaceCombo($("#cp-city", form), { cityOnly: true, onPick: (r) => { cityCoords = r ? { lat: r.lat, lng: r.lng } : null; } });
      attachPlaceCombo($("#cp-location", form), {
        onPick: (r) => {
          place = r;
          if (r?.city && !form.city.value) form.city.value = r.city;
        },
      });

      $("[name=title]", form).focus();

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        err.hidden = true;
        const f = new FormData(form);
        const title = String(f.get("title") || "").trim();
        const date = f.get("date");
        const city = String(f.get("city") || "").trim();
        const missing = [!title && "titre", !date && "date", !city && "ville"].filter(Boolean);
        if (missing.length) {
          err.textContent = `Il manque : ${missing.join(", ")}.`;
          err.hidden = false;
          form.querySelector(`[name=${!title ? "title" : !date ? "date" : "city"}]`)?.focus();
          return;
        }
        if (new Date(date) < new Date()) {
          err.textContent = "La date doit être dans le futur — même les sorciers ne remontent pas le temps.";
          err.hidden = false;
          return;
        }
        const btn = $("[type=submit]", form);
        btn.disabled = true;
        try {
          const coords = place?.lat ? { lat: place.lat, lng: place.lng } : cityCoords;
          const p = await db.parties.create({
            title,
            format: f.get("format"),
            level,
            date: new Date(date).toISOString(),
            city,
            location: String(f.get("location") || "").trim(),
            location_address: place?.address || "",
            location_lat: coords?.lat ?? null,
            location_lng: coords?.lng ?? null,
            max_players: Math.min(20, Math.max(2, parseInt(f.get("max_players"), 10) || 4)),
            description: String(f.get("description") || "").trim(),
          });
          close();
          toast.success("Partie publiée !", "Les aventurier·es peuvent maintenant vous rejoindre.");
          onCreated ? onCreated(p) : (location.hash = `#/partie/${p.id}`);
        } catch (ex) {
          err.textContent = ex.message || "Impossible de créer la partie.";
          err.hidden = false;
          btn.disabled = false;
        }
      });
    },
  });
}

/* ---------------------------------------------------------------------
   Modifier ma fiche de personnage
   --------------------------------------------------------------------- */
export function openEditProfile(user, { onSaved } = {}) {
  const formats = new Set(user.favorite_formats || []);
  const body = html`
    <form class="form" novalidate>
      <label class="field"><span>Nom d'aventurier·e</span>
        <input class="input" name="full_name" maxlength="60" value="${user.full_name || ""}" autocomplete="nickname" />
      </label>

      <fieldset class="field" style="border:0;padding:0">
        <legend>Niveau de compétence</legend>
        <div style="display:flex;gap:6px;flex-wrap:wrap" role="radiogroup" aria-label="Niveau de compétence">
          ${LEVELS.map((l) => html`<button type="button" class="chip" role="radio" aria-checked="${(user.skill_level || "Casual") === l}" aria-pressed="${(user.skill_level || "Casual") === l}" data-level="${l}">${levelPip(l)}${l}</button>`)}
        </div>
      </fieldset>

      <label class="field"><span>Ville</span>
        <div class="combo"><input class="input" id="ep-city" name="city" placeholder="Recherchez votre ville…" value="${user.city || ""}" /></div>
      </label>

      <fieldset class="field" style="border:0;padding:0">
        <legend>Formats préférés</legend>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${FORMATS.map((f) => html`<button type="button" class="chip" aria-pressed="${formats.has(f)}" data-format="${f}">${f}</button>`)}
        </div>
      </fieldset>

      <label class="field"><span>Bio</span>
        <textarea class="textarea" name="bio" rows="4" maxlength="600" placeholder="Présentez-vous en quelques mots, vos decks, vos envies…">${user.bio || ""}</textarea>
      </label>

      <p class="form-error" role="alert" hidden></p>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" data-close>Annuler</button>
        <button type="submit" class="btn btn--gold">${icon("check")} Enregistrer</button>
      </div>
    </form>`;

  openModal({
    title: "Modifier ma fiche",
    body,
    onMount(dlg, close) {
      const form = $("form", dlg);
      let level = user.skill_level || "Casual";
      let coords = user.city_lat ? { lat: user.city_lat, lng: user.city_lng } : null;

      $$("[data-level]", form).forEach((b) => b.addEventListener("click", () => {
        level = b.dataset.level;
        $$("[data-level]", form).forEach((x) => { const on = x === b; x.setAttribute("aria-pressed", on); x.setAttribute("aria-checked", on); });
      }));
      $$("[data-format]", form).forEach((b) => b.addEventListener("click", () => {
        const f = b.dataset.format;
        formats.has(f) ? formats.delete(f) : formats.add(f);
        b.setAttribute("aria-pressed", formats.has(f));
      }));
      attachPlaceCombo($("#ep-city", form), { cityOnly: true, onPick: (r) => { coords = r ? { lat: r.lat, lng: r.lng } : null; } });

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = $("[type=submit]", form);
        btn.disabled = true;
        try {
          const city = form.city.value.trim();
          const saved = await db.profiles.update({
            full_name: form.full_name.value.trim() || user.full_name,
            skill_level: level,
            city,
            city_lat: city ? coords?.lat ?? (city === user.city ? user.city_lat : null) ?? null : null,
            city_lng: city ? coords?.lng ?? (city === user.city ? user.city_lng : null) ?? null : null,
            favorite_formats: [...formats],
            bio: form.bio.value.trim(),
          });
          close();
          toast.success("Fiche mise à jour !", "Vos informations ont été enregistrées.");
          onSaved?.(saved);
        } catch (ex) {
          const err = $(".form-error", form);
          err.textContent = ex.message || "Impossible de mettre à jour le profil.";
          err.hidden = false;
          btn.disabled = false;
        }
      });
    },
  });
}
