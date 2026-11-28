# P1 — Liasse fiscale imprimable (modèle GUDEF)

> Prompt rédigé puis exécuté dans la même session. Statut : **exécuté et livré**.

## 1. Besoin métier

Le classeur XLSX de la liasse existait. Il manquait le document qu'un cabinet
**remet et fait viser** : une liasse paginée, avec la page de garde
d'identification fiscale, le bilan, le compte de résultat et les contrôles de
cohérence. Sans cela, la chaîne s'arrêtait à un tableur.

## 2. Livré

`components/LiassePrint.tsx` — document A4 :

1. **Page de garde** : République togolaise / OTR, exercice, modèle GUDEF,
   raison sociale, nom commercial, forme juridique, NIF, RCCM, siège, régime
   fiscal et assujettissement TVA, devise.
2. **Bilan actif** et **bilan passif**, poste par poste, totaux compris.
3. **Compte de résultat**, activités ordinaires et HAO séparées.
4. **Contrôles de cohérence** : titre, feuille, attendu, constaté, écart,
   statut (Conforme / Avertissement / BLOQUANT), avec le détail rédigé.
5. **Mentions** : équilibre actif = passif, Σ débits = Σ crédits, comptes non
   rattachés, date d'édition et réserve de validation humaine.

Bouton « Imprimer la liasse / PDF » sur la page Liasse (désactivé sans
balance N). Impression via `PrintSheet` (portail + `window.print`, CSS `@page`
déjà livré en P1a).

## 3. Règles

- Montants issus de `buildStatements` et contrôles issus de `runChecks` :
  aucun recalcul d'affichage, aucune valeur inventée.
- Une liasse déséquilibrée s'écrit « NON déposable en l'état » — le document
  refuse de se présenter comme publiable.
- Une seule source de vérité partagée entre l'écran, l'impression et le XLSX.

## 4. Non-régression

- `StatementsPrint` : le composant de ligne est exporté (`PrintLine`) et
  réutilisé, sans modification de comportement.
- L'export XLSX (`exportLiasseXlsx`) reste inchangé.
- Aucune dépendance ajoutée.

## 5. Validation

- `tsc --noEmit` : 0 erreur · `npm run build` : succès (11,39 s).
- `vitest` : **84/84** verts, dont un test de contrat : les contrôles exposent
  bien `title`, `sheet`, `expected`, `actual`, `diff`, `status` — exactement
  les colonnes du document imprimé — et contiennent l'équilibre `ap` et le
  garde-fou `unmapped`.

## 6. Points ouverts

- La liasse GUDEF complète comporte aussi la **TAFIRE** et les **notes
  annexes** ; le module `notes.ts` existe et n'est pas branché sur ce document.
- Pas de numérotation de pages ni de pagination automatique au-delà d'une page
  par section (le CSS `break-inside-avoid` évite les coupures de bloc).
