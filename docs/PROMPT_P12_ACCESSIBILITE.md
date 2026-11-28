# PROMPT — Lot 16 : dialogues accessibles et notifications non bloquantes

> Prompt rédigé **avant** exécution, exécuté immédiatement.

## Contexte constaté (audit §D, point 12 : « le plus faible »)

- **41 `alert()`** dans les pages. Un `alert()` gèle l'interface, ne peut pas
  être relu après fermeture, n'est pas annoncé par une région live et n'existe
  pas pour un test.
- **Une modale sans sémantique** : aucun `role="dialog"`, aucun `aria-modal`,
  pas de nom accessible, **Échap sans effet**, pas de piège de focus, pas de
  restitution du focus à la fermeture, défilement de la page non figé.
- **Un `confirm()` natif** pour une action destructrice (réinitialisation) : il
  ne dit ni ce qui est effacé, ni ce qui est conservé, et n'offre pas d'issue
  (« exporter d'abord »).
- **Champs** : les indications (`hint`) étaient du texte voisin, jamais
  rattachées au contrôle (`aria-describedby`), et le caractère obligatoire
  n'était signalé qu'en couleur (astérisque rose).

## Objectif

Un retour utilisateur **lu**, **non bloquant** et **relisible** ; des dialogues
qui se comportent comme des dialogues au clavier.

## Spécification

| # | Exigence | Traduction |
|---|---|---|
| 1 | Notification | `src/lib/toast.ts` pur (sans React ni DOM) : empilement, fermeture, expiration, abonnés |
| 2 | Doublons | Un message identique répété **fusionne** avec un compteur au lieu d'empiler |
| 3 | Encombrement | Pile plafonnée à 4 messages |
| 4 | Ton | Déduit du message (refus → danger, confirmation → succès, point à vérifier → avertissement) ; un ton explicite l'emporte |
| 5 | Message absent | Texte de repli « Action impossible », jamais une notification vide |
| 6 | Annonce | Région `aria-live="polite"`, `role="alert"` pour les refus, bouton de fermeture nommé |
| 7 | Dialogue | `role="dialog"`, `aria-modal`, nom accessible (titre ou libellé de repli), Échap ferme |
| 8 | Clavier | Piège de focus cyclique dans les deux sens, focus initial dans le dialogue, restitution du focus au déclencheur |
| 9 | Défilement | Page en arrière-plan figée pendant l'ouverture |
| 10 | Champs | `hint` rattaché par `aria-describedby`, `aria-required` posé, astérisque décoratif |
| 11 | Dangers | La réinitialisation passe par un dialogue qui dit ce qui est perdu et propose l'export |

## Livrables

- `src/lib/toast.ts`, `src/components/Toaster.tsx` (monté une fois dans `App`).
- `src/lib/focusTrap.ts` ; `Modal` et `Field` repris dans `components/ui.tsx`.
- 11 pages : `alert()` → `toast()` (41 appels) ; `confirm()` → dialogue dans Réglages.
- `src/lib/__tests__/notifications.test.ts` — 18 tests.

## Critères d'acceptation

1. Trois fois « Exercice clôturé » → **une** notification, compteur ×3, délai relancé.
2. Huit messages → **quatre** conservés, le plus récent en tête.
3. `toast(undefined)` → « Action impossible », ton danger.
4. Tab sur le dernier élément focusable → premier ; Maj+Tab sur le premier → dernier.
5. `dialogLabel("   ")` → « Dialogue » (jamais de nom vide).
6. Plus aucun `alert()` ni `confirm()` dans `src/`.
