# PROMPT — Lot 27 : parcours d'amorçage en six étapes

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit §D, point 14)

Rien ne disait **par où commencer**. Un cabinet qui ouvre le produit pour la
première fois arrive sur un tableau de bord vide et doit deviner l'ordre réel :
une organisation, puis une entreprise identifiée, puis un exercice ouvert, puis
des écritures, puis des contrôles — une liasse n'ayant de sens qu'après. Les
écrans vides ne disent pas ce qui manque.

## Décision de conception

Le parcours est **déduit de l'état réel du dossier**, jamais d'un compteur local :
il n'existe donc aucune case à cocher permettant de le déclarer terminé sans
l'avoir fait. Chaque étape porte sa raison d'être et son lien — on ne renvoie
jamais vers un écran sans dire quoi y faire.

| # | Étape | Constat lu dans les données |
|---|---|---|
| 1 | Le cabinet | organisation nommée |
| 2 | L'entreprise | NIF renseigné (identifie le contribuable) |
| 3 | L'exercice | exercice ouvert + nombre de périodes |
| 4 | Les écritures | nombre d'écritures du dossier |
| 5 | Les contrôles de balance | Σ débit = Σ crédit, **écart chiffré** sinon |
| 6 | La liasse | session de liasse préparée |

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Vérité | Aucune étape « faite » sans donnée correspondante |
| 2 | Ordre | La première étape manquante est « à faire » ; les suivantes « à venir » |
| 3 | Chiffres | Chaque étape affiche ce que le dossier montre (`NIF 1001234567`, `102 écritures`, `Écart de 100`) |
| 4 | Périmètre | Le parcours se calcule sur le dossier choisi, sinon sur le portefeuille |
| 5 | Sobriété | La carte disparaît quand les six étapes tiennent — une aide qui reste devient du bruit |
| 6 | Non-effaçable | Repliable, jamais fermable : on peut ignorer une étape, pas effacer le manque |
| 7 | Accessibilité | En-tête = bouton `aria-expanded`, progression aussi en texte (`4/6`) |

## Livrables

- `src/lib/onboarding.ts` (`computeOnboarding`, `OnboardingStep`, `OnboardingReport`).
- `src/components/OnboardingCard.tsx` (carte repliable, barre de progression, liens).
- `src/pages/Dashboard.tsx` (montage au-dessus des indicateurs).
- `src/lib/__tests__/onboarding.test.ts` — 7 tests.

## Critères d'acceptation

1. Dossier vide → `0/6`, étape courante = **cabinet**, liasse en « à venir ».
2. Organisation nommée → `1/6`, suivante = entreprise.
3. Entreprise avec NIF → `2/6`, étape suivante = exercice, indice contenant le NIF.
4. Écriture déséquilibrée de 100 → étape **contrôles** courante, indice « … 100 … ».
5. Dossier de démonstration → **6/6**, `next = null`, « Parcours complet ».
6. Dossier inconnu → jamais « complet ».
7. Toutes les étapes : `why` > 30 caractères, `href` sous `/app`, libellé d'action.
