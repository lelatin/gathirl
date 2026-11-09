# Gathirl — le grimoire des rencontres

Trouvez votre prochaine partie de **Magic: The Gathering** près de chez vous : rejoignez une table, organisez la vôtre, échangez des missives avec les autres joueurs.

Ce dépôt est la **réécriture complète** de l'app Base44 (`gathirl.base44.app`) en **HTML, CSS et JavaScript natifs**, sans framework ni étape de compilation. Chaque fichier se modifie à la main et le site se publie tel quel sur **GitHub Pages**.

---

## Fonctionnalités (parité avec la version Base44, et plus)

| Fonction | Base44 | Ici |
| --- | --- | --- |
| Fil des parties à venir (format, niveau, ville, lieu, joueurs, inscrits) | ✅ | ✅ couvertures de modules d'aventure JDR années 80 |
| Organiser une partie (titre, format, niveau, date, ville, lieu avec recherche d'adresse, joueurs max, description) | ✅ | ✅ |
| Rejoindre une partie (complet / déjà inscrit) | ✅ | ✅ + **se désister**, **annuler** (hôte) |
| Section « Près de chez vous » (10 km) | ✅ | Remplacée par le filtre « À moins de 10 km » du tableau des quêtes |
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
  - Chaque partie est une **couverture de module d'aventure JDR des années 80** (d'après le tableau Pinterest « 1er de couverture JDR » : comics pulp, boîtes de JDR, livres-jeux) : parchemin clair à peine teinté par le format, encre sombre (lisibilité), filet et cartouche de code aux couleurs du format assourdies, cartouche de code (« C4 »), mention « Module d'aventure », titre à l'encre sombre, « par » l'organisateur·rice, ruban « Une partie dont VOUS êtes le héros ! » sur l'illustration encadrée, « Pour 4 aventuriers… », case des places et tampon « Complet ».
  - Sous le héros, **4 cartouches** dans la direction artistique du site : panneau d'encre, liseré au dégradé du mot « Magic », illustration imprimée, titre gothique crème, icône, libellé mono et touche clavier ; chaque cartouche prend une teinte du dégradé « Magic » (orange braise, or, rouge, violet). Disposition horizontale compacte sur téléphone.
  - Le profil est une **fiche de personnage** avec cases de caractéristiques.
  - Les places d'une partie sont des **jetons autour de la table**.
  - En-tête façon **terminal** (horloge, statut en ligne, raccourcis numérotés) et léger **grain + lignes de balayage CRT**.
  - D'après le tableau Pinterest *gathirl inspiration* (couvertures de poche 70s-80s, sérigraphie, palettes réduites) :
    - **trame d'impression** et grain sur toutes les illustrations (classe `.print`) ;
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

### Audit n°2 (skills remove-animations, animation-performance, break-ui)

| Avant | Après | Pourquoi |
| --- | --- | --- |
| Cartes ré-animées (cascade) à chaque clic de filtre | Cascade uniquement au premier affichage | Action fréquente : l'animation se lit comme un délai |
| Cascade 45 ms/élément, 420 ms | 30 ms/élément, 260 ms, 240 ms max au total | Budget de cascade ≤ 300 ms |
| Messagerie : toute la liste se ré-anime à chaque nouveau message | Uniquement au premier affichage | Mise à jour fréquente |
| Bulle de message : glissement 220 ms | Fondu 150 ms | Réduction sur surface fréquente |
| Section « Choisissez votre voie » révélée au défilement (500 ms) | Supprimé | Retient le contenu, aucune fonction |
| Modale « Organiser » animée même ouverte avec **N** | Instantanée au clavier | Jamais d'animation sur une action clavier |
| Survol des cartes : `box-shadow` animé (repeint à chaque image) | Calque d'ombre animé en `opacity` uniquement | Propriétés GPU seulement |
| Boutons : `box-shadow` animé à l'appui | Seul `transform` s'anime | Idem |
| Reflet *foil* : variable CSS écrite sur la carte à chaque mouvement de souris | Écrite sur un calque sans enfant, 1 fois par image max | Une variable sur un parent recalcule tous ses descendants |
| Zoom au survol des illustrations (500–600 ms) | Supprimé | Décoration, au-delà du budget |
| `will-change` permanent sur l'Oracle | Supprimé | À n'ajouter qu'en cas de saccade mesurée |
| « 1 parties à venir », « 1 villes » | Pluriels via `Intl.PluralRules` | break-ui |
| Initiale d'un nom commençant par un emoji = caractère cassé | Découpage par graphème (`Intl.Segmenter`) | break-ui |
| Titre de 120 caractères sur l'affiche = 6 lignes géantes | 3 lignes max ; lieu 2 lignes max, valeur complète au survol | break-ui |
| Textes tronqués illisibles | Attribut `title` sur chaque texte tronqué | break-ui |

Gardé volontairement : appui des boutons (retour immédiat), toasts (évitent un changement brutal), tiroir mobile et modale (entrée/sortie occasionnelle), lancer du d20 (moment rare de plaisir), reflet foil (décoratif, souris uniquement, désactivé si mouvement réduit).
### Audit n°3 : design, espaces de sécurité, responsive (320 → 1920 px)

| Avant | Après | Pourquoi |
| --- | --- | --- |
| Écarts entre sections : 192 / 88 / 136 px | Un seul rythme `--section-y` : 96 px (desktop), 72 px (1024), 54 px (768), 48 px (mobile) | Rythme vertical régulier |
| Marge du héros + marge de section qui s'additionnent | Le héros n'a plus de marge basse, la section suivante porte le rythme | Pas de double espacement |
| Marges latérales : bord gauche de l'encoche seulement | `--gutter-l` / `--gutter-r` avec `env(safe-area-inset-left/right)` | iPhone en paysage : contenu jamais sous l'encoche |
| Cartouches d'action en 4 colonnes dès 1024 px (212 px, titres coupés) | 4 colonnes à partir de 1180 px, sinon 2, puis 1 | Chaque cartouche garde ≥ 260 px |
| Héros empilé jusqu'à 900 px | 2 colonnes dès 720 px (tablette) | Mieux utiliser la largeur |
| Boutons du héros de largeurs inégales sur téléphone | Action principale en pleine largeur | Cible principale évidente au pouce |
| Filtres 34 px, petits boutons 36 px, retour 19 px, inscrits 32 px | 44 px minimum sur écran tactile (`pointer: coarse`) | Recommandation Apple / WCAG 2.5.8 |
| Textes de 8,5 à 10,5 px | Plancher à 10–11 px (étiquettes), 12 px pied de page | Lisibilité |

**Accessibilité** : lien d'évitement, focus visible doré, `<dialog>` natif (focus piégé, Échap), combobox ARIA au clavier (↑ ↓ Entrée), `aria-current` sur la navigation, `aria-live` pour les toasts et messages, textes alternatifs.

**Performance** : aucune dépendance en mode démo, Supabase chargé seulement s'il est configuré, illustrations WebP ~50 Ko en `loading="lazy"`, image principale préchargée, effet CRT statique (aucun calcul continu).

**Sécurité** : toute donnée affichée passe par le gabarit `html\`\`` qui échappe le HTML (pas d'injection), règles RLS côté base, inscription aux parties via une fonction SQL atomique (pas de sur-réservation).

---

## À vérifier sur un vrai téléphone

Les réglages mobiles (survol collé, flash au tap, zoom des champs, encoche, clavier virtuel) ne se reproduisent pas dans l'émulateur du navigateur : testez sur un vrai appareil avant la mise en production.

---

*Site de fan non officiel, non affilié à Wizards of the Coast. Magic: The Gathering est une marque de Wizards of the Coast LLC.*
