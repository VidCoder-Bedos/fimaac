# Règle de travail permanente — FIMAAC

> Instruction du propriétaire du produit, 28/11/2026. **Ne se rediscute pas.**

1. **Chaque demande est d'abord écrite sous forme de prompt** dans `docs/PROMPT_*.md` : besoin métier, périmètre, spécifications, non-régression, cas particuliers, critères d'acceptation chiffrés, tests.
2. **L'agent exécute ensuite lui-même le prompt**, sans attendre d'autorisation supplémentaire : code, tests, build, déploiement.
3. **Le travail est découpé en étapes** ; chaque étape est annoncée puis livrée, avec un compte rendu : ce qui est fait, la preuve (test/chiffre), et ce qui reste.
4. **Aucune étape n'est déclarée terminée sans preuve d'exécution** (test vert, valeur mesurée, `npm run build` OK, statut Vercel `success`).
5. Les prompts restent **stockés dans le dépôt** même après exécution : ils constituent l'historique des décisions et le cahier de recette.
6. En cas de blocage ou d'ambiguïté métier non tranchable par le code, l'agent s'arrête sur ce point précis, l'explique, et continue le reste.

## Séquence de référence (lot P0 — fiabilisation)

| # | Prompt | Statut |
|---|---|---|
| P0-1 | `docs/PROMPT_P0_MOTEUR_ETATS.md` — moteur d'états financiers | voir compte rendu |
| P0-2 | fiscalité : une seule vérité (TVA/IS) | à venir |
| P0-3 | paie conforme (IRPP progressif + AMU) | à venir |
| P0-4 | import de balance robuste | à venir |
| P0-5 | garde-fou quota + signal démonstration | à venir |

## Definition of Done commune

- `npx tsc --noEmit` : aucune nouvelle erreur
- `npm run build` : OK
- `npm test` : tous les tests verts
- écart de bilan = 0 sur les deux jeux de données
- registre `docs/REFERENTIEL_FIMAAC.md` §5 mis à jour (D-xx → corrigé + commit)
- déploiement vérifié : `gh api …/commits/main/status` → `Vercel | success`
