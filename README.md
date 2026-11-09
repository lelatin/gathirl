# Gathirl — le grimoire des rencontres

Trouvez votre prochaine partie de **Magic: The Gathering** près de chez vous : rejoignez une table, organisez la vôtre, échangez des missives avec les autres joueurs.

Ce dépôt est la **réécriture complète** de l'app Base44 (`gathirl.base44.app`) en **HTML, CSS et JavaScript natifs**, sans framework ni étape de compilation. Chaque fichier se modifie à la main et le site se publie tel quel sur **GitHub Pages**.

---

## Fonctionnalités (parité avec la version Base44, et plus)

| Fonction | Base44 | Ici |
| --- | --- | --- |
| Fil des parties à venir (format, niveau, ville, lieu, joueurs, inscrits) | ✅ | ✅ cartes façon carte à collectionner |
| Organiser une partie (titre, format, niveau, date, ville, lieu avec recherche d'adresse, joueurs max, description) | ✅ | ✅ |
| Rejoindre une partie (complet / déjà inscrit) | ✅ | ✅ + **se désister**, **annuler** (hôte) |
| Section « Près de chez vous » (10 km) | ✅ | ✅ + filtre de distance |
| Profil : niveau, ville, formats préférés, bio, stats, historique | ✅ | ✅ « fiche de personnage » façon D&D |
| Amis : demande, accepter, refuser, liste | ✅ | ✅ « compagnons d'armes » |
| Messagerie privée temps réel, non-lus | ✅ | ✅ « missives » |
| Connexion email / mot de passe, Google | ✅ | ✅ via Supabase |
| Filtres par format et niveau | ❌ | ✅ |
| Le **d20** qui choisit une partie au hasard | ❌ | ✅ |
| Raccourcis clavier `1`–`4` (navigation) et `N` (organiser) | ❌ | ✅ |
| Mode démo hors-ligne avec joueurs d'exemple | ❌ | ✅ |

---

## Structure

```
index.html              ← page unique (en-tête, sprite d'icônes, barre mobile)
css/
  base.css              ← jetons de design (couleurs, typo, courbes), reset, socle mobile, effet CRT
  components.css        ← boutons, puces, cartes MTG, formulaires, modales, toasts, barre d'onglets
  pages.css             ← Taverne, Quête, Fiche, Missives, Pacte (connexion)
js/
  config.js             ← ⚙️ À MODIFIER : clés Supabase, rayon "près de chez vous", Google
  app.js                ← routeur (#/…), en-tête, raccourcis clavier
  data/
    index.js            ← choisit le moteur : démo (local) ou Supabase
    local.js            ← moteur démo : localStorage + données d'exemple
    supabase.js         ← moteur production : Supabase (Postgres, Auth, Realtime)
  lib/                  ← gabarits HTML sécurisés, formats de date, géolocalisation
  ui/                   ← carte de partie, modale, toasts, formulaires
  views/                ← une vue par page
supabase/schema.sql     ← tables + règles de sécurité + temps réel (à exécuter une fois)
assets/img/             ← illustrations en WebP (récupérées de la version Base44, ~50 Ko chacune)
```

### Pages (routeur par `#`, compatible GitHub Pages sans configuration)

| URL | Page |
| --- | --- |
| `#/` | La Taverne (accueil) |
| `#/parties` | Tableau des quêtes |
| `#/partie/:id` | Détail d'une partie |
| `#/profil` · `#/profil/:id` | Fiche de personnage |
| `#/messages` · `#/messages/:id` | Missives |
| `#/connexion` · `#/inscription` | Le Pacte |

---

## Lancer en local

Les modules JavaScript exigent un petit serveur (ouvrir `index.html` en double-cliquant ne suffit pas). Au choix :

- **VS Code** : extension *Live Server* → clic droit sur `index.html` → *Open with Live Server*
- **Node** : `npx serve .`
- **Python** : `python -m http.server 5173`

Puis ouvrez `http://localhost:5173`.

---

## Les deux moteurs de données

### 1. Mode démo (par défaut)
Si `SUPABASE_URL` est vide dans `js/config.js`, tout est stocké **dans le navigateur du visiteur** (localStorage), avec 5 joueurs et 6 parties d'exemple. Les joueurs d'exemple répondent même aux messages. Parfait pour montrer le site, mais **les données ne sont pas partagées entre visiteurs**.

### 2. Production avec Supabase (remplace Base44)
[Supabase](https://supabase.com) est gratuit pour un projet de cette taille et fournit exactement ce que Base44 offrait : comptes, base de données, temps réel.

1. Créez un compte puis un projet sur supabase.com (région : *West EU (Paris)*).
2. **SQL Editor → New query** : collez tout le contenu de `supabase/schema.sql` → **Run**.
3. **Project Settings → API** : copiez *Project URL* et la clé *anon public*.
4. Collez-les dans `js/config.js` :
   ```js
   SUPABASE_URL: "https://xxxx.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGciOi...",
   ```
   > La clé *anon* est **publique par conception** : la sécurité repose sur les règles RLS du schéma (chacun ne modifie que ses données, ne lit que ses messages).
5. **Authentication → URL Configuration** : mettez l'URL de votre site GitHub Pages dans *Site URL* et *Redirect URLs*.
6. *(Optionnel)* **Authentication → Providers → Google** pour la connexion Google, puis `GOOGLE_AUTH: true` dans `config.js`.

---

## Publier sur GitHub Pages

1. Créez un dépôt `gathirl` sur GitHub.
2. Envoyez ces fichiers :
   - **Sans ligne de commande** : sur la page du dépôt, *Add file → Upload files*, glissez tout le contenu du dossier (sauf `.claude/`) → *Commit*. Ou utilisez **GitHub Desktop**.
   - **Avec git** :
     ```bash
     git init && git add . && git commit -m "Gathirl : réécriture HTML/CSS/JS"
     git branch -M main
     git remote add origin https://github.com/<votre-pseudo>/gathirl.git
     git push -u origin main
     ```
3. Dépôt → **Settings → Pages** → *Source : Deploy from a branch* → `main` / `/ (root)` → *Save*.
4. Le site est en ligne après ~1 minute sur `https://<votre-pseudo>.github.io/gathirl/`.

Le fichier `.nojekyll` évite que GitHub retraite les fichiers.

---

## Direction artistique

**Dark fantasy 80s · heroic fantasy 70s · grimoire · cartes à collectionner · fiche de jeu de rôle · écran cathodique.**

- **Palette** : encre violacée (`--ink-*`), parchemin (`--parch`), rouge néon façon « monde à l'envers » (`--blood`), or (`--gold`), et les **5 couleurs de mana** pour coder formats et niveaux.
- **Typographies** : *Grenze Gotisch* (titres, gothique lisible de pochette d'album), *Spectral* (texte, serif de livre), *Space Mono* (interface, esprit terminal).
- **Signatures** :
  - Titre « Magic » en **chrome coucher de soleil** années 80 ; soleil rayé et sol en grille synthwave derrière le héros.
  - Chaque partie est une **carte à collectionner** : cadre coloré selon le format, **coût de mana = niveau** (1 vert = Débutant, 2 bleus = Casual, 3 rouges = Compétitif), boîte F/E = joueurs/places, reflet *foil* qui suit la souris.
  - L'accueil se lit comme un **livre dont vous êtes le héros** (« Choisissez votre voie, § 1 à 4 »).
  - Le profil est une **fiche de personnage** avec cases de caractéristiques.
  - Les places d'une partie sont des **jetons autour de la table**.
  - En-tête façon **terminal** (horloge, statut en ligne, raccourcis numérotés) et léger **grain + lignes de balayage CRT**.
  - D'après le tableau Pinterest *gathirl inspiration* (couvertures de poche 70s-80s, sérigraphie, palettes réduites) :
    - **trame d'impression** et grain sur toutes les illustrations (classe `.print`) ;
    - **« L'arcane de la semaine »** : affiche façon tarot / roman de poche, image en **bichromie vermillon** dans une **arche gothique**, numéro romain ;
    - **interlude « Chapitre II »** : ciel nocturne étoilé avec nébuleuse pourpre et lune, et un **triptyque de fenêtres gothiques** (clé de voûte, croisée de vitrail) contenant des scènes peintes — I. Trouvez votre table, II. Lancez les dés, III. Écrivez votre légende. Carrousel au doigt sur mobile.
  - Palette étendue : `--vermilion`, `--teal`, `--moon`, `--cream`.

Tous les jetons sont dans `css/base.css` (`:root`) : changez une couleur à un seul endroit.

---

## Bonnes pratiques appliquées (skills d'Emil Kowalski)

| Règle | Où |
| --- | --- |
| Jamais `ease-in` ; courbes personnalisées `--ease-out`, `--ease-in-out`, `--ease-drawer` | `base.css` |
| Animations UI < 300 ms, uniquement `transform` / `opacity` | partout |
| Jamais `transition: all` | partout |
| Bouton qui s'enfonce au `:active` (retour immédiat) | `.btn`, `.chip`, `.tabbar` |
| Survols protégés par `@media (hover: hover) and (pointer: fine)` (pas de survol collé au tap) | partout |
| Entrées via `@starting-style` (modale, toasts, listes) ; jamais depuis `scale(0)` | `components.css` |
| Modales centrées sur desktop, **tiroir** sur mobile ; sortie plus rapide que l'entrée | `.modal` |
| Toasts façon Sonner : transitions interruptibles, pause au survol et onglet caché | `ui/toast.js` |
| Apparition en cascade (45 ms entre éléments), jamais bloquante | `.stagger` |
| Raccourcis clavier **sans animation** | `app.js` |
| `prefers-reduced-motion` : on garde les fondus, on retire les déplacements | `base.css` |
| `-webkit-tap-highlight-color: transparent`, `touch-action: manipulation` | `base.css` |
| Champs à 16 px (pas de zoom iOS), `inputmode`, `enterkeyhint`, `autocomplete` | formulaires |
| `viewport-fit=cover` + `env(safe-area-inset-*)` (encoche, barre du bas) | `index.html`, `.tabbar`, `.hud` |
| `100svh` pour le héros, `100dvh` pour la messagerie | `base.css`, `pages.css` |
| `user-select: none` sur les contrôles uniquement (jamais sur le texte) | `base.css` |
| `overscroll-behavior: contain` sur les zones qui défilent (fil, suggestions, modale) | `pages.css` |
| Chiffres tabulaires, pluriels via `Intl.PluralRules`, dates absolues après une semaine | `lib/format.js` |
| Avatars qui ne s'écrasent jamais (`flex-shrink: 0`), textes longs tronqués proprement | `.sigil`, cartes |

**Accessibilité** : lien d'évitement, focus visible doré, `<dialog>` natif (focus piégé, Échap), combobox ARIA au clavier (↑ ↓ Entrée), `aria-current` sur la navigation, `aria-live` pour les toasts et messages, textes alternatifs.

**Performance** : aucune dépendance en mode démo, Supabase chargé seulement s'il est configuré, illustrations WebP ~50 Ko en `loading="lazy"`, image principale préchargée, effet CRT statique (aucun calcul continu).

**Sécurité** : toute donnée affichée passe par le gabarit `html\`\`` qui échappe le HTML (pas d'injection), règles RLS côté base, inscription aux parties via une fonction SQL atomique (pas de sur-réservation).

---

## À vérifier sur un vrai téléphone

Les réglages mobiles (survol collé, flash au tap, zoom des champs, encoche, clavier virtuel) ne se reproduisent pas dans l'émulateur du navigateur : testez sur un vrai appareil avant la mise en production.

---

*Site de fan non officiel, non affilié à Wizards of the Coast. Magic: The Gathering est une marque de Wizards of the Coast LLC.*
