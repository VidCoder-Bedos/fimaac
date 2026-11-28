#!/usr/bin/env bash
# Installe un hook pre-commit qui refuse les marqueurs de conflit.
# Motif : deux fois, un fichier a été commité avec ses marqueurs puis fusionné.
# `npm install` déclenche ce script (script "prepare") ; il peut aussi être
# lancé à la main : bash scripts/install-hooks.sh
set -euo pipefail
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
hooks="$root/.git/hooks"
[ -d "$hooks" ] || exit 0
cat > "$hooks/pre-commit" <<'HOOK'
#!/usr/bin/env bash
# Refuse un commit contenant des marqueurs de conflit non résolus.
set -e
if ! bash scripts/check-conflicts.sh; then
  echo "Commit refusé : marqueurs de conflit non résolus." >&2
  exit 1
fi
HOOK
chmod +x "$hooks/pre-commit"
echo "✅ Hook pre-commit installé (contrôle des marqueurs de conflit)."
