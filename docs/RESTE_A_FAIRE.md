# FIMAAC — Ce qui reste à faire

> Registre tenu à jour à chaque lot livré. Il sert de point de reprise : tout ce
> qui est ici est **non fait**, avec sa raison et son blocage éventuel.
> Dernière mise à jour : 28/11/2026, après les PR #5 à #25.

## Déjà réglé (ne plus y revenir)

| Lot | Objet | PR |
|---|---|---|
| P0-1 | Moteur d'états unique, bilan équilibré (27 440 921 = 27 440 921) | #5 |
| P0-2 | Fiscalité : un seul calcul (IS 201 900, TVA 2 473 332, base 20 190 000) | #6 |
| P0-3 | Paie : barème IRPP progressif + AMU retenue | #7 |
| P0-3b | AMU salariale déductible de l'assiette IRPP (art. 26 CGI) | #10 |
| P0-3c | Taux AMU arbitrés 5 % / 5 % | #12 |
| P0-4 | Import de balance robuste, refus explicite | #8 |
| P0-5 | Garde-fou de quota + signal de démonstration | #9 |
| P1a | Bilan unifié à l'écran + document imprimable (PDF navigateur) | #11 |
| P2a | Contrôles croisés branchés dans le Centre de conformité | #13 |
| P2b | Journal d'audit chaîné (détection d'altération locale) | #14 |
| P1b | Liasse fiscale imprimable (modèle GUDEF) | #16 |
| P3 | Export FEC conforme (18 colonnes, point décimal, contrôles) | #17 |
| P4 | Échéances légales reportées aux jours ouvrés + calendrier affiché | #18 |
| P5 | Ventilation de la TVA par taux (18 / 9 / exonéré) | #19 |
| P6 | Numérotation des pièces sans recyclage + contrôle affiché | #20 |
| P7 | TAFIRE calculé, bouclé et imprimé (liasse, PDF, XLSX) | #21 |
| P8 | Notes annexes calculées, imprimées et exportées | #22 |
| — | Retrait des marqueurs de conflit fusionnés + build bloquant | #23 |
| P9 | Écriture hors exercice : refus explicite, plus de déplacement | #24 |
| P10 | Réintégrations / déductions fiscales persistées et traçables | #25 |

## 1. Bloqué par une décision d'infrastructure (à arbitrer par le porteur)

Ces points ne peuvent pas avancer sans base de données et hébergement d'API.

1. **Persistance réelle** — aujourd'hui tout vit dans le `localStorage`. Le
   `schema.prisma` (≈ 40 entités) est écrit mais jamais utilisé.
   *Décision attendue :* Neon / Supabase / autre Postgres, et fonctions Vercel.
2. **Authentification serveur et RBAC** — 16 permissions et 13 rôles existent,
   mais ne sont appliqués que côté interface (`<Can>`). Un appel direct à une
   action n'est pas contrôlé.
3. **Pièces justificatives persistées** — stockage objet + métadonnées +
   empreinte ; aujourd'hui les fichiers sont en base64 local.
4. **Journal d'audit inviolable côté serveur** — chaînage de hachages, acteur
   réel, adresse IP réelle (aujourd'hui `127.0.0.1` en dur).

## 2. Faisable sans infrastructure (ordre recommandé)

5. ~~**Liasse GUDEF imprimable**~~ — **fait (PR #16)** ;
   ~~**TAFIRE**~~ — **fait (PR #21)** ;
   ~~**notes annexes**~~ — **fait (PR #22)**. Reste : **saisie des 15 notes
   manuelles** (engagements hors bilan, effectifs, ventilation du CA, cessions)
   et **éclatement ligne à ligne** des notes calculées (NOTE_04 et NOTE_16A
   agrègent aujourd'hui leurs lignes sans détail par compte).
6. ~~**Journal d'audit chaîné localement**~~ — **fait (PR #14)**. Reste la
   version serveur : ancrage hors du poste, acteur et IP réels (point 4).
7. ~~**Export FEC conforme**~~ — **fait (PR #17)** : 18 colonnes, point décimal,
   `CompAuxNum` alimenté, numérotation continue par journal, contrôles statués.
   Reste : filtrer par **exercice** (l'export couvre aujourd'hui tout l'historique
   validé), historiser une **date de validation** et une **date de lettrage**
   réelles, et **renseigner les tiers** sur les lignes 40x/41x du seed
   (5 lignes sur 67 aujourd'hui).
8. ~~**Obligations : règles de report**~~ — **fait (PR #18)** : jours fériés
   togolais (fixes + Pâques/Ascension/Pentecôte), report au jour ouvré suivant,
   trimestre T4 au 15 janvier N+1, fenêtre glissante 12/24 mois, moteur branché
   dans un onglet « Calendrier légal ». Reste : **fêtes musulmanes** (Aïd el-Fitr,
   Aïd el-Adha) à paramétrer chaque année, **régimes réel / forfait** et
   prorogations exceptionnelles décidées par l'administration.
9. ~~**TVA à taux multiples**~~ — **fait (PR #19)** : ventilation par taux avec
   résolution code taxe → taux effectif → exonération constatée, contrôles et
   affichage dans la grille. Reste : **ventilation à la ligne** (une facture
   mêlant deux taux est aujourd'hui signalée, pas éclatée) et **autoliquidation**
   sur les achats intracommunautaires.
10. **Cas 441 débiteur** — présenté en diminution des dettes fiscales ; un
    éclatement par sens du solde serait plus juste (sans effet sur l'équilibre).
11. ~~**IS : réintégrations / déductions**~~ — **fait (PR #25)** : collection
    persistée (DB_VERSION 4), saisie tracée, calcul unique de l'IS. Reste :
    **reprendre ces montants dans la déclaration IS générée** et proposer des
    **réintégrations types** (amendes 658, dons, charges non justifiées).

## 3. Qualité produit (audit §D)

12. **Accessibilité AA** — 1 attribut `aria-*`, 0 `role`, 2 `htmlFor` pour des
    centaines de champs ; modales sans piège de focus. Point le plus faible.
13. **Densité des écrans** — jusqu'à 9 onglets ; cible ≤ 5 + sous-navigation.
14. **Parcours d'amorçage** — cabinet → entreprise → exercice → balance →
    contrôles → liasse, en 6 étapes guidées.
15. **Recherche globale / palette ⌘K** — `GlobalSearch` existe, mal exposé.
16. **`alert()` natifs restants** — remplacer par les notifications du store.
17. **Mono-devise / mono-pays** — la promesse « espace OHADA » n'est pas tenue
    au-delà du Togo (country packs à prévoir).

## 4. Qualité technique (audit §F)

18. ~~**Numérotation des pièces**~~ — **fait (PR #20)** : séquence reprise après
    le maximum du journal, unicité vérifiée, extournes exclues, contrôle
    « doublons / trous / illisibles » affiché dans l'onglet Écritures. Reste :
    les **trous d'import** du seed (ex. ACH 0106-0114) à expliquer pièce par
    pièce.
19. ~~**Écriture hors exercice**~~ — **fait (PR #24)** : l'exercice et la période
    qui contiennent la date sont résolus, sinon refus explicite nommant la date
    et les bornes ; période mensuelle absente créée et auditée. Reste : la
    **saisie en lot** (import d'écritures) qui ne passe pas encore par ce
    contrôle.
20. **Moteurs encore dormants** — `financialStatements`, `liasseEngine`
    (partiellement), `obligations.generateObligationInstances`, `notes`.
    Chacun doit être soit branché, soit archivé explicitement.
21. **Modules morts à supprimer** — 4 945 lignes (23,5 % du code) jamais
    exécutées ; à trancher un par un, jamais en bloc.
22. **Balance 6 colonnes** — `parseBalance6` garde son propre lecteur ; à
    aligner sur `balanceImport` (P0-4) avec ses propres tests.

## 5. Points fiscaux et sociaux à confirmer par un professionnel

23. **Barème IRPP** — 8 tranches (0 / 11 / 17 / 23 / 29 / 33 / 37 / 40 %) :
    `verified: false`.
24. **IS** — taux 27 %, minimum de perception 1 % du CA (forfait 20 000 sous
    2 000 000) : `verified: false`.
25. **CNSS** — 4 % / 17,5 %, plafond 300 000 : `verified: false`.
26. **Charges de famille et abattements IRPP** — non implémentés.
27. **Congés payés, primes, heures supplémentaires** — le brut est saisi, non
    composé ; `payrollComponents` existe et n'est pas branché.

## 6. Ce qui n'existe pas du tout

28. API publique et connecteurs (banques, OTR, paie externe).
29. OCR serveur avec revue humaine (l'OCR local existe).
30. IA RAG sourcée — expliquer, jamais calculer.
31. Mode « révision collaborative » (préparation → contrôle → validation).
32. Benchmark sectoriel anonymisé.
33. PDF serveur (facture, liasse) : l'impression navigateur est une solution
    d'attente, pas une chaîne documentaire.
