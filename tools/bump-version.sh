#!/usr/bin/env bash
# =====================================================================
# Gathirl — force le rechargement des scripts et styles après une mise en ligne.
# GitHub Pages laisse les navigateurs garder chaque fichier 10 minutes : sans
# numéro de version, un navigateur peut mélanger une nouvelle page et d'anciens
# scripts (ex. : une nouvelle route inconnue → « Vous vous êtes égaré·e »).
# Ce script ajoute / remplace « ?v=AAAAMMJJHHMM » sur toutes les URL locales
# .js et .css (imports des modules + index.html). À lancer avant chaque commit :
#   bash tools/bump-version.sh
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
V=$(date +%Y%m%d%H%M)
files=$(ls index.html; find js -name '*.js' -not -path 'js/vendor/*')
for f in $files; do
  # chemins relatifs uniquement : "./…", "../…", "js/…", "css/…" (jamais les URL externes)
  sed -E -i "s#([\"'])((\./|\.\./|js/|css/)[^\"'?]+\.(js|css))(\?v=[0-9]+)?([\"'])#\1\2?v=$V\6#g" "$f"
done
# Lu sans cache par js/app.js : un téléphone qui a gardé l'ancienne page se recharge tout seul
printf '{ "v": "%s" }\n' "$V" > version.json
echo "version $V"
