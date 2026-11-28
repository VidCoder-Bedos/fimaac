# P1 — Bilan unifié dans l'écran + document imprimable (PDF)

> Prompt rédigé puis exécuté dans la même session. Statut : **exécuté et livré**.

## 1. Besoin métier

Deux manques constatés en exploitation :

1. **L'écran « États financiers » n'affichait pas le vrai bilan.** Son onglet
   « Bilan synthétique » utilisait `financialSummary` — une quatrième
   définition des agrégats (créances = 411 seuls, dettes = 401 seuls,
   capitaux = toute la classe 1, y compris les dettes financières). L'actif et
   le passif affichés ne pouvaient donc pas être égaux, alors que le moteur
   unifié produisait, lui, un bilan équilibré. Deux bilans pour un même
   dossier : exactement ce que P0-1 avait supprimé côté moteur.
2. **Aucun document remettable au client.** Un cabinet doit livrer un bilan,
   pas montrer un écran. Le produit ne savait produire aucun PDF.

## 2. Architecture

- `pages/Financials.tsx` : le bilan affiché provient désormais de
  `buildStatements(trialBalance(...))`, la **même source** que la page Liasse.
  L'onglet affiche toutes les composantes, l'écart d'équilibre et le nombre de
  comptes non rattachés.
- `components/PrintSheet.tsx` : portail d'impression. Monte le document dans
  `#fimaac-print`, ajoute `body.printing`, appelle `window.print()`, puis
  nettoie. **Aucune bibliothèque PDF ajoutée** : la boîte d'impression du
  navigateur produit un PDF/A4 propre.
- `components/StatementsPrint.tsx` : document A4 — en-tête société (NIF,
  RCCM, ville), actif poste par poste, passif poste par poste, compte de
  résultat avec HAO, contrôle d'équilibre, Σ débits = Σ crédits, comptes non
  rattachés, date d'édition et mention « document de travail à valider ».
- `index.css` : `@page A4 portrait 14 mm`, `#root` masqué à l'impression.

## 3. Règles de gestion

- Un document imprimé ne contient **que** des montants de `buildStatements` :
  aucun recalcul d'affichage.
- Les composantes négatives (amortissements, dépréciations) sont présentées
  entre parenthèses, convention comptable.
- Si l'actif diffère du passif, le document l'écrit explicitement et se déclare
  « non publiable en l'état » — il ne masque jamais un déséquilibre.

## 4. Non-régression

- `financialSummary` et `computeRatios` **inchangés** : les ratios gardent
  leur sémantique documentée (créances clients 411, dettes fournisseurs 401),
  aucune valeur d'analytics ne bouge en silence.
- Impression sans effet si le stockage ou le DOM est indisponible.
- Aucune dépendance ajoutée (pas de bundle PDF).

## 5. Validation

- `tsc --noEmit` : 0 erreur · `npm run build` : succès (13,03 s).
- `vitest` : **65/65** verts, dont un nouveau contrôle « aucun contrôle
  bloquant sur le dossier de démonstration ».
- Sur le seed : actif = passif = 27 440 921, document imprimable cohérent.

## 6. Points ouverts

- Impression via le navigateur : pas de PDF serveur, donc pas de génération
  automatique en tâche de fond ni d'archivage. Lot P1 ultérieur.
- La liasse GUDEF complète reste générée en XLSX (déjà fonctionnel) ; son
  équivalent imprimable suivra.
