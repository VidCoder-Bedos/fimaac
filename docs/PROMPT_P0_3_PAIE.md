# P0-3 — Paie conforme : barème IRPP progressif et AMU

> Prompt rédigé puis exécuté dans la même session (règle « l'agent écrit le
> prompt, puis l'exécute lui-même »). Statut : **exécuté et livré**.

## 1. Besoin métier

Un cabinet qui remet des bulletins faux engage sa responsabilité, pas celle du
logiciel. Or FIMAAC retenait un **forfait de 5 %** au titre de l'IRPP alors que
huit tranches progressives étaient déjà chargées en base, et **n'appliquait
jamais l'AMU** — pourtant présente dans `payrollConfig` *et* dans
`socialRules`, donc visible à l'écran.

Sur les deux salariés de démonstration, l'écart mesuré après correction est de
**57 420 FCFA par mois** de retenues non collectées :

| Salarié | Brut | Retenues avant | Retenues après | Écart |
|---|---|---|---|---|
| Kossi AGBO | 450 000 | 34 500 | 75 660 | +41 160 |
| Awa LAWSON | 350 000 | 29 500 | 57 660 | +28 160 |

(chiffres à AMU 5 % : l'AMU nouvellement retenue est de 15 000 FCFA par
salarié, et l'IRPP baisse car sa base est diminuée de cette cotisation —
48 660 pour 450 000 de brut, 31 660 pour 350 000.)

(avant = CNSS 12 000 + forfait 5 % ; après = CNSS 12 000 + AMU 6 000 + IRPP
51 210 / 34 210.)

À l'échelle d'un portefeuille, c'est un risque de redressement, doublé d'un
bulletin non présentable au salarié.

## 2. Module concerné

`lib/actions.ts :: runPayroll` · `lib/regulatory-engine.ts :: calculateIRPP`
(déjà juste, jamais appelé) · `pages/Operations.tsx` (tableau des bulletins et
paramétrage des taux) · `lib/types.ts :: Payslip`.

## 3. Existant constaté

- `runPayroll` recalculait tout sur place : `cnssEmployee`, `cnssEmployer`,
  puis `withholding = brut × 5 %`. Aucun appel à `calculateIRPP`.
- `calculatePaycheck` (regulatory-engine) faisait déjà CNSS + AMU + IRPP
  progressif — **code mort**.
- `payrollConfig.irppBrackets` vide ; les 8 tranches existent dans
  `db.taxBrackets`, versionnées `reg-togo-2026`.
- Écriture de paie correctement ventilée, mais sans l'AMU.

## 4. Architecture retenue

`src/lib/paie.ts` — module pur, sans store ni React :

```
paieParamsFromConfig(cfg, db.taxBrackets)   → PaieParams
      (barème de la configuration prioritaire, sinon barème versionné,
       sinon repli forfaitaire explicite)
calculerBulletin(brut, params)              → BulletinCalcul
      CNSS plafonnée · AMU plafonnée · assiette IRPP · IRPP progressif
      net · coût employeur · détail des tranches · alertes
totaliserBulletins(bulletins)               → masse salariale
ecrituresPaie(totaux)                       → écriture équilibrée par construction
```

`runPayroll` ne calcule plus rien : il collecte les employés, appelle le
module, persiste les bulletins et génère l'écriture.

## 5. Non-régression

- Signature de `runPayroll` conservée, enrichie d'un champ `alertes`.
- `Payslip` : **champs ajoutés en optionnel** (`amuEmployee`, `amuEmployer`,
  `irpp`, `modeIRPP`, `assietteIRPP`, `totalRetenues`, `coutEmployeur`) —
  les bulletins historiques restent lisibles, l'écran affiche
  `iri ?? withholding` et `amuEmployee ?? 0`.
- Aucun taux modifié : CNSS 4/17,5 plafond 300 000, AMU 2/4 plafond 300 000,
  barème 8 tranches — tout vient de la base, tout reste `verified: false`.
- L'assiette IRPP reste **brut − CNSS**, exactement comme
  `calculatePaycheck` : aucune règle fiscale n'a été réinventée.

## 6. Règles de gestion

- **CNSS** et **AMU** sont deux cotisations indépendantes, chacune plafonnée à
  sa propre assiette (300 000 dans le paramétrage actuel).
- **Assiette IRPP** = brut − CNSS salariale. La déductibilité de l'AMU de
  cette assiette est une **question ouverte** (voir §11), volontairement non
  tranchée par le code.
- **IRPP** = barème progressif annuel ramené au mois, comme
  `calculateIRPP` le fait déjà. Aucun abattement ni charge de famille.
- **Net** = brut − (CNSS + AMU + IRPP). **Coût employeur** = brut + patronal.
- **Écriture** : 6611 brut · 6641 patronal (CNSS + AMU) · 4472 IRPP ·
  4311 CNSS (salarié + patronal) · **4331 AMU** (salarié + patronal) ·
  422 net. Débit = crédit par construction.

## 7. Cas particuliers

| Cas | Traitement |
|---|---|
| Aucun barème disponible | repli forfaitaire **signalé** dans `alertes` et à l'écran |
| Plafond non renseigné | cotisation sur le brut entier + alerte |
| Brut sous les deux plafonds | assiette = brut, pas de plafonnement |
| Brut 0 | bulletin à 0, aucune ligne d'écriture vide |
| Barème partiel (ex. 4 tranches) | calcul sur les tranches disponibles, sans extrapolation |
| Bulletins antérieurs sans AMU | affichage à 0, aucune migration destructive |

## 8. Critères de validation

- `npx tsc --noEmit` : 0 erreur.
- `npx vitest run` : **36/36** verts.
- Sur le seed : CNSS 24 000 · AMU 12 000 · IRPP 85 420 · retenues 121 420 ·
  écriture équilibrée.
- Calculs vérifiables à la main : 450 000 → IRPP 51 210 (231 000 + 383 520
  annuels / 12), 350 000 → 34 210.

## 9. Contrôles livrés

`src/lib/__tests__/paie.test.ts` — 12 tests : plafonnement CNSS/AMU, retenue
AMU effective, barème à 8 tranches, comparaison au forfait, détail des
tranches, repli forfaitaire signalé, cohérence net/coût employeur, équilibre
de l'écriture, exécution réelle de `runPayroll`, barème versionné utilisé.

## 10. Interactions

La paie alimente trois consommateurs, tous cohérents par construction :
l'écriture comptable (4311 / 4331 / 4472 / 422), les contrôles croisés
« CNSS ↔ Paie » et « Paie ↔ Compta », et la déclaration TSB (qui utilisait
déjà `calculateIRPP`). Le total des retenues devient la référence unique de
ces trois lectures.

## 11. Points ouverts (assumés)

- **AMU dans l'assiette IRPP — TRANCHÉ le 28/11/2026.** Décision du porteur :
  la cotisation salariale AMU est déductible de l'assiette de l'IRPP sur
  traitements et salaires, en application de **l'article 26 du CGI togolais**
  (« sont déduits du revenu brut imposable […] les retenues pour constitution
  de pensions ou de retraites relevant d'un régime obligatoire de prévoyance
  […] et les cotisations salariales aux assurances sociales et assurances
  maladies obligatoires »). Seule la part salariale est déductible ; la part
  patronale reste une charge de l'employeur.
  Le code applique désormais : `assiette IRPP = brut − CNSS salariale − AMU
  salariale`, et un test vérifie que la part patronale ne modifie jamais
  l'assiette du salarié tout en contrôlant qu'une AMU salariale plus élevée
  réduit bien l'IRPP retenu.
  **Taux arbitrés le 28/11/2026 : AMU 5 % salarié / 5 % employeur.** Le
  paramétrage du dossier, le jeu de règles sociales et les tests sont alignés
  (auparavant 2 %/4 %, jamais appliqués puisque l'AMU n'était pas retenue).
- **Charges de famille / abattements** : absents du barème chargé.
- **Congés payés, primes, heures supplémentaires** : le brut est saisi, non
  composé. `payrollComponents` existe et n'est pas encore branché.
- **Taux `verified: false`** : la publication reste un acte humain.

## 12. Cohérence globale

P0-3 applique aux ressources humaines exactement la méthode de P0-1 et P0-2 :
**une seule implémentation, des adaptateurs, des tests qui comparent les
chemins**. Les trois lots forment désormais un socle où un même dossier ne
peut plus produire deux chiffres différents — bilan, impôt, bulletin.
