# FIMAAC — Ce qui reste à faire

> Registre tenu à jour à chaque lot livré. Il sert de point de reprise : tout ce
> qui est ici est **non fait**, avec sa raison et son blocage éventuel.
> Dernière mise à jour : 28/11/2026, après les PR #5 à #43.

## Déjà réglé (ne plus y revenir)

| Lot | Objet | PR |
|---|---|---|
| P0-1 | Moteur d'états unique, bilan équilibré (27 960 921 = 27 960 921 après P15) | #5 |
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
| P11 | Base fiscale avec classe 8, déclarations TVA ventilée et IS générées | #26 |
| P12 | Dialogues accessibles (focus, Échap, rôle) et notifications non bloquantes | #27 |
| P13 | FEC par exercice, périmètre et nom de dépôt affichés | #28 |
| P14 | Tiers manquants : détection, propositions, affectation tracée | #29 |
| P15 | Sens du solde au bilan : 441 débiteur à l'actif, total 27 960 921 | #30 |
| P16 | Notes 04 et 16A éclatées par compte (détail vérifiable) | #31 |
| P17 | Saisie des notes manuelles persistée, datée et auditée | #32 |
| P18 | Jours fériés exceptionnels déclarés : les échéances se décalent | #33 |
| P19 | Palette de commandes ⌘K : navigation, actions, données | #34 |
| P20 | Réintégrations proposées depuis les comptes non déductibles | #35 |
| P21 | Régime déclaré (réel/forfait/exonéré) et taux par catégorie | #36 |
| P22 | Balance 6 colonnes : un seul lecteur, diagnostic complet | #37 |
| P23 | Parcours d'amorçage en 6 étapes, déduit de l'état réel | #38 |
| P24 | Écrans vides : nommer le prérequis manquant | #39 |
| P25 | Moteurs dormants : quatre modules archivés, garde-fou de test | #40 |
| P26 | Exports sans usage : mesure, politique, moteur factorisé requalifié en oracle | #41 |
| P27 | `actions.ts` : doublons supprimés, exports internes refermés, clé du dossier unifiée | #42 |
| P28 | Ouverture d'exercice : implémentation unique, période à la vraie fin de mois, bouton N+1 | #43 |

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
   et ~~éclatement ligne à ligne~~ — **fait (PR #31)** pour NOTE_04 et NOTE_16A :
   chaque ligne porte ses comptes, la somme des détails valant la ligne.
   ~~Saisie des 15 notes manuelles~~ — **mécanisme livré (PR #32)** : les notes
   sont saisissables, persistées par société × exercice × note, datées et
   auditées ; une ligne non saisie reste vide. Reste : **les saisir sur le dossier
   de démonstration**, ce qui demande les pièces du client (statuts, bail,
   registre du personnel) — données qu'on n'invente pas.
6. ~~**Journal d'audit chaîné localement**~~ — **fait (PR #14)**. Reste la
   version serveur : ancrage hors du poste, acteur et IP réels (point 4).
7. ~~**Export FEC conforme**~~ — **fait (PR #17)** : 18 colonnes, point décimal,
   `CompAuxNum` alimenté, numérotation continue par journal, contrôles statués.
   ~~Reste : filtrer par **exercice**~~ — **fait (PR #28)** : périmètre
   d'exercice bornes incluses, nombre d'écritures écartées affiché, nom de
   dépôt suffixé. Reste : historiser une **date de validation** et une **date
   de lettrage** réelles, et ~~renseigner les tiers~~ — **outil livré (PR #29)** :
   l'écran « Tiers manquants » liste les **62 lignes sur 67**, propose les tiers
   du bon collectif et affecte par compte ou ligne à ligne, avec audit. Reste :
   **affecter effectivement** le dossier de démonstration (c'est une décision de
   dossier, pas une donnée à inventer).
8. ~~**Obligations : règles de report**~~ — **fait (PR #18)** : jours fériés
   togolais (fixes + Pâques/Ascension/Pentecôte), report au jour ouvré suivant,
   trimestre T4 au 15 janvier N+1, fenêtre glissante 12/24 mois, moteur branché
   dans un onglet « Calendrier légal ». ~~Fêtes musulmanes~~ — **fait (PR #33)** :
   les jours fériés exceptionnels et prorogations se **déclarent** (date, libellé,
   référence), décalent réellement les échéances et sont audités ; le seed n'en
   invente aucun. Reste : **régimes réel / forfait** (assujettissement) et
   ~~Régimes réel/forfait et taux différenciés~~ — **fait (PR #36)** : la règle
   porte désormais sa portée (`regimes`, `categories`) ; un régime exonéré ne
   calcule plus rien et ses déclarations sont refusées, un régime sans règle
   propre n'emprunte plus celle d'un autre, et la catégorie d'entreprise se
   déclare (auditée). Reste : **versionner les règles réelles** par régime dans
   le Regulatory Engine (c'est une source OTR, pas une donnée à inventer).
9. ~~**TVA à taux multiples**~~ — **fait (PR #19)** : ventilation par taux avec
   résolution code taxe → taux effectif → exonération constatée, contrôles et
   affichage dans la grille. Reste : **ventilation à la ligne** (une facture
   mêlant deux taux est aujourd'hui signalée, pas éclatée) et **autoliquidation**
   sur les achats intracommunautaires.
10. ~~**Cas 441 débiteur**~~ — **fait (PR #30)** : le sens du solde décide du
    côté du bilan (nouveau poste « Créances sociales et fiscales »), dans le
    moteur de liasse **et** dans le moteur factorisé. Le total du bilan passe de
    27 440 921 à **27 960 921** des deux côtés : 520 000 FCFA d'actif qui
    n'existaient nulle part sont désormais visibles.
11. ~~**IS : réintégrations / déductions**~~ — **fait (PR #25)** : collection
    persistée (DB_VERSION 4), saisie tracée, calcul unique de l'IS. Reste :
    ~~**reprendre ces montants dans la déclaration IS générée**~~ — **fait
    (PR #26)** : `generateIsDeclaration` produit l'IS de l'exercice (résultat
    fiscal, IS au taux, minimum de perception, impôt dû, échéance 31/03 reportée).
    ~~Réintégrations types~~ — **fait (PR #35)** : les comptes 647, 6582/6583/835
    et 6581 sont proposés avec leur montant et leur raison ; la reprise est
    tracée (`suggestionId`) et n'est jamais automatique. Reste : le **crédit
    d'impôt reporté** et les **charges non justifiées** (aucun compte dédié).

## 3. Qualité produit (audit §D)

12. **Accessibilité AA — en cours (PR #27)** : modales avec `role="dialog"`,
    `aria-modal`, nom accessible, Échap, **piège de focus** et restitution du
    focus ; champs reliés à leur indication (`aria-describedby`), astérisque
    décoratif ; notifications dans une région `aria-live`. Reste : **navigation
    clavier des tableaux** (tri, sélection de ligne), **contraste** à auditer,
    et `htmlFor` explicite pour les contrôles hors `Field`.
13. **Densité des écrans** — jusqu'à 9 onglets ; cible ≤ 5 + sous-navigation.
14. ~~**Parcours d'amorçage**~~ — **fait (PR #38)** : six étapes **déduites de
    l'état réel** (organisation, NIF, exercice ouvert, écritures, équilibre de la
    balance, liasse), chacune avec sa raison et son lien ; la carte disparaît
    d'elle-même à 6/6 et n'est jamais effaçable. ~~Écrans vides~~ — **fait
    (PR #39)** : chaque écran déclare ses prérequis (les mêmes six étapes), nomme
    la première qui manque avec son chiffre et son lien, et n'affiche **aucun**
    conseil quand tout est rempli. Reste : étendre le branchement aux écrans
    encore muets (états, paie, banque, notes).
15. ~~**Recherche globale / palette ⌘K**~~ — **fait (PR #34)** : ⌘K / Ctrl+K
    annoncé par un bouton, navigation et actions avant les données, parcours aux
    flèches avec Entrée, rôles ARIA. Reste : **commandes contextuelles** (agir sur
    l'écran courant, ex. valider l'écriture sélectionnée) et historique des
    dernières commandes.
16. ~~**`alert()` natifs restants**~~ — **fait (PR #27)** : 41 `alert()` et le
    dernier `confirm()` remplacés par des notifications non bloquantes et un
    dialogue de confirmation explicite. Reste : **empiler les erreurs de
    formulaire au niveau du champ** (aujourd'hui une notification globale).
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
20. ~~**Moteurs dormants**~~ — **fait (PR #40)** : inventaire refait sur
    l'import réel. `obligations.generateObligationInstances`, `notes` et
    `liasseEngine` sont **branchés** (Obligations, liasse, ateliers) ; quatre
    modules ne l'étaient par personne — `declarationEngine` (440 l.),
    `financialStatements` (369 l.), `liasseFiller` (267 l.), `formulaRegistry`
    (244 l.) — et sont désormais **archivés** dans `src/lib/archive/` avec leur
    en-tête, la notice des remplaçants, et un test qui échoue si l'un d'eux
    revient dans le chemin d'exécution. Reste : `modules morts` (point 21).
21. **Modules morts** — **en cours (PR #41)** : mesure rejouable
    (`npm run audit:dead`) → **386 exports sur 932** sans usage applicatif, dont
    52 appelés uniquement par des tests. Politique écrite dans
    `docs/AUDIT_EXPORTS_MORTS.md` (archivé / oracle / conservé-documenté / à
    trancher). Le moteur factorisé (970 l.), présenté comme co-source de vérité,
    n'était importé que par les tests : il devient **oracle de
    contre-vérification**, protégé par test. ~~Actions non branchées~~ — **première
    passe (PR #42)** : 4 doublons supprimés (`addCompany`, `addClientRequest`,
    `createServiceRequest`, `setServiceRequestStatus`), 4 exports internes
    refermés, et la clé `fimaac_company` unifiée dans `companyScope.ts` (elle était
    recopiée dans trois fichiers ; le dossier actif ne survit plus à une
    déconnexion). Reste : 6 actions à trancher (`ensureFiscalYear`,
    ~~`ensureFiscalYear`~~ — **branché (PR #43)** : c'était une seconde
    implémentation de la création d'exercice, jamais appelée, et **rien**
    n'ouvrait l'exercice suivant (les périodes de la copie finissaient au 28).
    Désormais une seule fonction, une période à la vraie fin de mois, un bouton
    « Ouvrir l'exercice N » dans l'onglet Clôture. Reste : 5 actions à trancher
    (`setDocCategory`, `setDocStatus`, `setDocumentRequestStatus`,
    `runAllSubscriptions`, `togglePlanActive`), puis `analytics`, `production`,
    `etatsMapping`.
22. ~~**Balance 6 colonnes**~~ — **fait (PR #37)** : `parseBalance6` passe par
    `balance6.ts`, entrée = grille de texte (testable sans fichier). Les **soldes**
    sont préférés aux mouvements (une balance « Débit · Crédit · SD · SC » était
    lue de travers), N et N-1 sont reconnus, le repli positionnel est annoncé, les
    lignes écartées sont listées avec leur motif et un fichier illisible est
    refusé explicitement. Reste : brancher le même lecteur sur l'import de
    balance des **écritures** (`balanceImport`) pour n'avoir qu'un seul code.

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
