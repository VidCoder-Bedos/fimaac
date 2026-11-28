# FIMAAC — Ce qui reste à faire

> Registre tenu à jour à chaque lot livré. Il sert de point de reprise : tout ce
> qui est ici est **non fait**, avec sa raison et son blocage éventuel.
<<<<<<< HEAD
> Dernière mise à jour : 28/11/2026, après les PR #5 à #14.
=======
> Dernière mise à jour : 28/11/2026, après les PR #5 à #13.
>>>>>>> origin/main

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
<<<<<<< HEAD
| P2b | Journal d'audit chaîné (détection d'altération locale) | #14 |
=======
>>>>>>> origin/main

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

5. **Liasse GUDEF imprimable** — le XLSX fonctionne ; l'équivalent PDF/A4
   manque (le bilan est déjà imprimable depuis la PR #11).
<<<<<<< HEAD
6. ~~**Journal d'audit chaîné localement**~~ — **fait (PR #14)**. Reste la
   version serveur : ancrage hors du poste, acteur et IP réels (point 4).
=======
6. **Journal d'audit chaîné localement** — détection d'altération du
   `localStorage` par chaînage de hachages, vérifiable à la demande.
>>>>>>> origin/main
7. **Export FEC conforme** — 15 colonnes seulement, `DateRglt` toujours vide,
   pas de colonne devise : utilisable en interne, pas pour un contrôle.
8. **Obligations : règles de report** — jour férié, week-end, prorogation,
   périodicité trimestrielle réelle, régimes réel / forfait. La génération
   actuelle produit 50 instances « en retard » parce qu'elle est rétroactive.
9. **TVA à taux multiples** — exonéré, 9 %, 18 % : un seul taux normal
   aujourd'hui. Impacte la déclaration et la grille.
10. **Cas 441 débiteur** — présenté en diminution des dettes fiscales ; un
    éclatement par sens du solde serait plus juste (sans effet sur l'équilibre).
11. **IS : réintégrations / déductions** — le moteur les accepte, l'écran ne
    les expose pas encore.

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

18. **Numérotation des pièces** — `count + 1` par journal : doublons possibles
    après suppression ou import.
19. **Écriture hors exercice** — rattachée silencieusement à `periods[0]`.
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
