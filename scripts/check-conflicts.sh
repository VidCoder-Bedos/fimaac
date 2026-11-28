#!/usr/bin/env bash
# Refuse un commit contenant des marqueurs de conflit non résolus.
# Ajouté après une erreur réelle : un fichier de documentation a été commité
# avec ses marqueurs, puis fusionné.
set -euo pipefail
hits=$(grep -rn --binary-files=without-match -E '^(<<<<<<< |=======$|>>>>>>> )' \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
  --include='*.md' --include='*.json' --include='*.css' --include='*.html' \
  . 2>/dev/null | grep -v node_modules | grep -v '^./dist' || true)
if [ -n "$hits" ]; then
  echo "❌ Marqueurs de conflit détectés :" >&2
  echo "$hits" >&2
  exit 1
fi
echo "✅ Aucun marqueur de conflit."
