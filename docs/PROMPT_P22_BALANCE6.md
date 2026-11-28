# PROMPT — Lot 26 : balance 6 colonnes, un seul lecteur et un diagnostic

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit §F, point 22)

`parseBalance6` gardait son **propre** lecteur, distinct de l'import robuste
P0-4 — et il reproduisait exactement les défauts corrigés ailleurs :

1. **disposition supposée en dur** « SD N · SC N · SD N-1 · SC N-1 ». Une balance
   « Débit · Crédit · Solde débiteur · Solde créditeur » — la plus courante —
   voyait donc ses **mouvements** pris pour des soldes et ses soldes pour du
   N-1 : bilan faux, sans un mot ;
2. **lignes jetées en silence** dès que le code ne commençait pas par un chiffre
   (collectifs, en-têtes répétés, lignes parasites) ;
3. un fichier incompris renvoyait une balance **vide** — indistinguable d'un
   dossier sans activité ;
4. aucune restitution : ni colonne reconnue, ni ligne écartée, ni écart.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Un seul lecteur | `balance6.ts` — entrée : une **grille** de texte (aucune dépendance au fichier, donc testable) |
| 2 | Détection par en-têtes | `compte`/`n° compte`, `libellé`/`intitulé`, colonnes de montants |
| 3 | Soldes d'abord | Si une colonne de solde existe (débiteur/créditeur ou « solde »), c'est elle qui fait la balance ; les mouvements ne servent que faute de soldes, et l'écran le dit |
| 4 | Périodes | `N` / `N-1` reconnus (`N-1`, antérieur, précédent) ; absence de N-1 annoncée |
| 5 | Solde signé | Une colonne unique signée bascule débit/crédit selon le signe |
| 6 | Montants | `1 234 567`, `1.234.567`, `12 000,50`, `1.234.567,89`, `(12 000)`, `500,00 D` |
| 7 | Repli annoncé | Sans en-tête : disposition historique supposée, **écrite à l'écran** |
| 8 | Refus explicite | Fichier vide ou illisible → erreur nommée, aucune donnée reprise |
| 9 | Rien ne disparaît | Lignes écartées listées avec motif (code non comptable, aucun montant) |
| 10 | Totaux | Débit/crédit par exercice et écart, plus alerte de déséquilibre |

## Livrables

- `src/lib/balance6.ts` (`parseBalance6Grid`, `parseAmount`, `normalizeHeader`).
- `src/lib/liasseEngine.ts` : `parseBalance6(file)` délègue au lecteur unique et
  expose le diagnostic (`ok`, `layout`, `signals`, `warnings`, `errors`,
  `totals`, `rejected`) — le classeur Excel n'est plus qu'une conversion en grille.
- `src/pages/Liasse.tsx` : notification explicite en cas de refus, réserves
  affichées sinon.
- `src/lib/__tests__/balance6.test.ts` — 11 tests.

## Critères d'acceptation

1. Balance « Débit · Crédit · Solde débiteur · Solde créditeur » : clients
   4111 = **15 167 298 au débit**, et le compte 601 soldé (9 000 000 / 9 000 000)
   ressort à **0 / 0** — les mouvements ne sont pas pris pour des soldes.
2. En-têtes N et N-1 → soldes des deux exercices lus séparément.
3. Colonne « Solde » signée : 520 000 → débit, −774 000 → crédit.
4. Balance de mouvements seulement → lue, mais avertissement explicite.
5. Grille vide → `ok: false`, erreur « Fichier vide ».
6. Grille incompréhensible → `ok: false`, erreur « Aucun compte lu ».
7. Sans en-tête → `layout = "positionnel"`, avertissement « disposition supposée ».
8. Ligne « 41 » sans montant et ligne « ABC » → listées dans `rejected` avec motif.
9. Totaux : 15 167 298 / 15 000 000 → écart **167 298** et alerte de déséquilibre.
