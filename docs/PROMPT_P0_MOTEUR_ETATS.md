# PROMPT P0 — Unification et fiabilisation du moteur d'états financiers

> **Type** : prompt de développement prêt à exécuter (12 blocs).
> **Référence** : `docs/AUDIT_DECISION_MOTEUR_ETATS.md` (décision) + `docs/REFERENTIEL_FIMAAC.md` §5 (registre D-01 → D-06).
> **Objectif produit** : qu'un bilan FIMAAC soit juste au franc près et ne puisse plus se déséquilibrer silencieusement.

---

## 1. Rôle attendu

Tu es ingénieur full-stack senior, spécialisé en systèmes comptables SYSCOHADA. Tu travailles sur une base React 19 + TypeScript stricte, sans backend. Tu modifies **le cœur de calcul** d'un produit utilisé par des cabinets d'expertise comptable : une régression ici est plus grave qu'une fonctionnalité manquante.

Règles absolues :
- **Aucune invention de règle comptable** : si une règle n'est pas déterminable depuis le plan comptable embarqué (`src/lib/chart.ts`) ou la documentation, tu t'arrêtes et tu poses la question.
- **Aucune suppression de fonctionnalité** existante.
- **Une seule source de vérité par calcul.**
- Tu livres des tests qui échouent avant correction et passent après.

---

## 2. Besoin métier

Aujourd'hui, FIMAAC produit des états financiers qui **ne s'équilibrent pas** : sur le jeu de démonstration (102 écritures parfaitement équilibrées, Σ débit = Σ crédit = 80 951 571), le bilan issu de `lib/liasse` affiche **28 140 921 d'actif pour 28 032 921 de passif** (écart 108 000), et celui de `lib/engine` affiche **25 820 053 contre 15 233 349** (écart 10 586 704).

Un cabinet ne peut pas remettre un bilan faux à son client ni à l'administration. L'objectif est donc double : **corriger**, et **rendre l'erreur impossible** (un compte non mappé doit produire un contrôle bloquant, jamais un silence).

---

## 3. Périmètre exact

| Fichier | Rôle actuel | Action |
|---|---|---|
| `src/lib/etatsMapping.ts` | inexistant | **CRÉER** — table de mapping unique préfixe → poste |
| `src/lib/liasse.ts` (`buildStatements` l.128, `runChecks` l.157) | moteur de référence | réécrire sur le mapping, ajouter classe 8 + contrôle « non mappés » |
| `src/lib/engine/soldes.ts` (`aggregate` l.40) | agrégation par **solde net** | ajouter `aggregateGross` / `aggregateNet`, conserver `aggregate` en délégation |
| `src/lib/engine/agregateurs.ts` (54 règles) | règles factorisées | corriger 6 règles fautives (§6) |
| `src/lib/engine/etats.ts` (`buildBilan` l.9) | assemblage du bilan | exposer `dettesFiscalesSociales`, garantir `totalPassif` = somme des composantes |
| `src/lib/engine/types.ts` (`BilanResult` l.78) | contrat de sortie | ajouter les champs manquants (rétro-compatible : champs obligatoires) |
| `src/pages/Liasse.tsx` (l.125-126) | affichage actif/passif | ajouter la ligne « Autres dettes » (aujourd'hui invisible alors qu'elle entre dans le total) |
| `src/lib/__tests__/*.test.ts` | inexistant | **CRÉER** — 7 tests |
| `package.json` | `build`, `dev`, `preview` | ajouter `"test": "vitest run"` + `vitest` en `devDependencies` |

**Hors périmètre** : présentation officielle du bilan par références SYSCOHADA (AD, AG, AE…), `lib/financialStatements.ts`, fiscalité (D-07), paie (D-08/D-09), import (D-12/D-13). Ces sujets feront l'objet de prompts distincts.

---

## 4. État de l'existant (preuves — ne pas contester, c'est mesuré)

### 4.1 Sur une balance de contrôle de 14 comptes (équilibrée à 21 200 000)

| Valeur | Attendu | `engine` aujourd'hui | `liasse` aujourd'hui |
|---|---|---|---|
| Immobilisations brutes | 5 000 000 | **3 000 000** | 5 000 000 |
| Immobilisations nettes | 4 000 000 | **2 000 000** | 4 000 000 |
| Créances (411 + 4452) | 3 200 000 | **3 000 000** | 3 200 000 |
| Total actif | 13 200 000 | **11 000 000** | 13 200 000 |
| Résultat au passif | 3 000 000 | **0** | 3 000 000 |
| Autres dettes (TVA + social) | 900 000 | **0** | 900 000 |
| Total passif | 13 200 000 | **9 700 000** | 13 200 000 |
| Écart actif − passif | 0 | **1 300 000** | 0 |

### 4.2 Sur les 102 écritures de démonstration

| | `engine` | `liasse` |
|---|---|---|
| Produits (classe 7) | 20 190 000 | 20 190 000 |
| Charges (classe 6) | 20 777 805 | 20 777 805 |
| Résultat | −587 805 | −587 805 |
| Actif | 25 820 053 | 28 140 921 |
| Passif | 15 233 349 | 28 032 921 |
| Écart | 10 586 704 | **108 000** |

### 4.3 Causes exactes identifiées

1. `RULE_IMMO_BRUT` = `aggregate(["2"], "debit") − aggregate(["28","29"], "credit")`. Or `aggregate` renvoie un **solde net** (`debit − credit`), donc les comptes 2841 sont déjà comptés en négatif : l'amortissement est **retiré deux fois**. Contrôle : 5 000 000 − 1 000 000 (net inclus) − 1 000 000 (règle) = 3 000 000.
2. `RULE_RESULTAT_PASSIF` lit les comptes **120/121** (résultat *comptabilisé*) : sur un exercice en cours, ils n'existent pas → `resultat = 0` alors que le compte de résultat calcule 3 000 000.
3. `buildBilan` n'affecte à `autresDettes` que `RULE_AUTRES_DETTES` (464/465/469/48). La règle `RULE_DETTES_FISCALES_SOCIALES` (43/44) **existe mais n'est jamais appelée** par le bilan : 900 000 disparaissent de l'affichage, alors qu'ils sont comptés dans `RULE_TOTAL_PASSIF` → `totalPassif` ≠ somme des composantes exposées (9 700 000 vs 9 300 000 = 400 000).
4. `aggregate(prefixes, "credit")` **compense débits et crédits** dans un même préfixe : `44` donne 500 000 (4431) − 200 000 (4452) = 300 000, ce qui fait disparaître la TVA récupérable de l'actif. Un poste brut ne doit jamais être calculé avec un solde net.
5. `liasse.buildStatements` ignore les **comptes de classe 8** : les deux comptes du seed (`812` débit 342 000, `822` crédit 450 000, net −108 000) sont silencieusement écartés → écart de bilan de 108 000, exactement leur solde.

---

## 5. Architecture cible

### 5.1 `src/lib/etatsMapping.ts` (nouveau, source unique)

```ts
export type Poste =
  | "immoBrut" | "amort" | "stocks" | "creancesClients" | "creancesEtat" | "autresCreances"
  | "tresorerie" | "tresoreriePassif" | "capitaux" | "dettesFin" | "dettesFourn"
  | "dettesFiscalesSociales" | "autresDettes" | "charges" | "produits" | "chargesHAO" | "produitsHAO";

export interface MappingRule {
  poste: Poste;
  prefixes: string[];       // test : code === p || code.startsWith(p)
  exclude?: string[];       // ex. immoBrut exclut 28/29/39/49
  side: "actif" | "passif" | "resultat";
  /** "gross" = somme brute du sens indiqué ; "net" = solde ; "bySign" = splité selon le signe */
  mode: "gross" | "net" | "bySign";
  ref?: string;             // référence SYSCOHADA si connue (facultatif à cette étape)
}

export const MAPPING: MappingRule[] = [ /* table unique, voir §6 */ ];
export const POSTES: Record<Poste, string>;   // libellés FR affichables
export function classify(code: string): MappingRule | null;  // premier match, excludes respectées
export function unmappedCodes(rows: { code: string; debit: number; credit: number }[]): string[];
```

**Règles de conception** :
- `classify` applique le **premier match** de `MAPPING`, dans l'ordre ; l'ordre est significatif et doit être commenté.
- `exclude` est vérifié avant les préfixes (ex. `immoBrut` : `prefixes: ["2"]`, `exclude: ["28","29","39","49"]`).
- `unmappedCodes` retourne tout code dont le solde (`debit − credit`) est **non nul** et qui n'a reçu aucune affectation. C'est le garde-fou anti-silence.

### 5.2 `src/lib/engine/soldes.ts`

```ts
/** Somme brute du sens demandé (ignore le sens opposé) — pour les postes bruts. */
export function aggregateGross(ctx, prefixes: string[], period: Period, side: "debit" | "credit"): number;

/** Solde net (comportement actuel, conservé à l'identique). */
export function aggregateNet(ctx, prefixes, period, sign): number;

/** Rétro-compatibilité : conservation de la signature et du comportement actuels. */
export const aggregate = aggregateNet;
```
`aggregateGross` doit alimenter `ctx.trace` avec `ruleId: "AGGG:<prefixes>"` pour conserver la traçabilité.

### 5.3 `liasse.buildStatements`

Réimplémenté **exclusivement** sur `MAPPING` + `unmappedCodes`, sans changer la forme du retour `LiasseStatements` (contrat consommé par `pages/Liasse.tsx` l.27 et `exportLiasseXlsx` l.195). Deux champs **ajoutés** (facultatifs dans le type, obligatoires dans l'objet retourné) :
```ts
nonMappes: { code: string; label: string; solde: number }[];
```
et `result` complété de `chargesHAO` / `produitsHAO`.

---

## 6. Spécifications par règle (avant → après)

| Règle | Aujourd'hui | Cible |
|---|---|---|
| `RULE_IMMO_BRUT` | `agg(["2"],"debit") − agg(["28","29"],"credit")` | `aggregateGross(["2"], exclude 28/29/39/49, "debit")` |
| `RULE_AMORT` | inchangée | `aggregateGross(["28","29"], "credit")` |
| `RULE_IMMO_NET` | brut − amort | inchangée |
| `RULE_CREANCES_CLIENTS` | 411…418 net | `aggregateGross(["411"…"418","409"], "debit")` |
| **nouveau** `RULE_CREANCES_ETAT` | — | `aggregateGross(["445","4492"], "debit")` |
| `RULE_AUTRES_CREANCES` | `["46"]` débit net | `aggregateGross(["46"], "debit")` |
| `RULE_RESULTAT_PASSIF` | 120/121 uniquement | si `agg(["12","13"])` ≠ 0 → ce montant ; **sinon** `RULE_RESULTAT_NET(ctx, p)` (résultat calculé, jamais 0 par défaut) |
| `RULE_DETTES_FISCALES_SOCIALES` | calculée, jamais exposée | **exposée** dans `BilanResult.dettesFiscalesSociales`, calculée en `aggregateGross(["42","43","44"], "credit")` |
| `RULE_AUTRES_DETTES` | 464/465/469/48 | inchangée + `RULE_DETTES_FISCALES_SOCIALES` séparée |
| `RULE_TOTAL_PASSIF` | formule autonome | **somme exacte** des composantes exposées : capitaux + résultat + dettesFin + dettesFourn + dettesFiscalesSociales + autresDettes + tresoPassif + ecartConvPassif |
| `RULE_TOTAL_ACTIF` | somme partielle | **somme exacte** des composantes exposées, y compris `creancesEtat` |
| **nouveaux** `RULE_CHARGES_HAO` / `RULE_PRODUITS_HAO` | — | classe 8 : débits → charges HAO, crédits → produits HAO, via `bySign` |
| `RULE_TOTAL_CHARGES` / `RULE_TOTAL_PRODUITS` / `RULE_RESULTAT_NET` | classes 6 et 7 | inclure les classes 8 (HAO) |

**Table `MAPPING` de référence (ordre significatif)** — à compléter au besoin mais **jamais dupliquée ailleurs** :

```
1  16                 → dettesFin            (net, passif)
2  1 (excl. 16)       → capitaux             (net, passif)
3  2 (excl. 28,29,39,49) → immoBrut          (gross débit, actif)
4  28,29              → amort                (gross crédit, actif)
5  3  (excl. 39)      → stocks               (net, actif)
6  41,409             → creancesClients      (gross débit, actif)
7  445,4492           → creancesEtat         (gross débit, actif)
8  46,47 (excl. 476,477) → autresCreances    (gross débit, actif)
9  40                 → dettesFourn          (gross crédit, passif)
10 42,43,44 (excl. 445,4492) → dettesFiscalesSociales (gross crédit, passif)
11 48,464,465,469     → autresDettes         (gross crédit, passif)
12 5 (solde > 0)      → tresorerie           (bySign, actif)
13 5 (solde < 0)      → tresoreriePassif     (bySign, passif)
14 6  (excl. 68)      → charges              (net, résultat)
15 7  (excl. 78)      → produits             (net, résultat)
16 8  (solde > 0)     → chargesHAO           (bySign, résultat)
17 8  (solde < 0)     → produitsHAO          (bySign, résultat)
```
> Les exclusions `68`/`78` correspondent aux dotations/reprises : si le plan embarqué ne les distingue pas, conserve `6` et `7` globalement et documente le choix en commentaire. **Vérifie chaque préfixe dans `src/lib/chart.ts` avant de l'écrire** ; en cas de doute, n'invente pas, signale-le.

---

## 7. Non-régression — comportements à préserver à l'identique

1. Signatures publiques : `buildStatements(rows: BalanceRow[]): LiasseStatements`, `runChecks(st): CoherenceCheck[]`, `runEngine(balanceN, balanceN1, accounts, fiscOpts)`.
2. `CoherenceCheck` conserve `id`, `title`, `sheet`, `expected`, `actual`, `diff`, `status: "ok" | "warning" | "blocking"`, `detail`. Les 7 identifiants existants (`dc`, `ap`, `res`, `amort`, `treso`, `capital`, `prod`) doivent rester présents : `pages/Liasse.tsx` l.151-153 compte par `status`.
3. `exportLiasseXlsx` continue de fonctionner avec la même structure.
4. `lib/engine` reste **pur** (aucun accès au store).
5. Aucune écriture dans le store depuis un moteur : tout passe par `actions.ts`.
6. Les 15 autres règles du compte de résultat et le TFT ne changent pas de valeur sur le jeu de démonstration (hors HAO).

---

## 8. Cas particuliers à traiter explicitement

| Cas | Comportement attendu |
|---|---|
| Exercice **déficitaire** | résultat négatif porté au passif en négatif ; `actif = passif` ; jamais de `Math.max(0, …)` |
| **TVA créditrice** (445 > 443) | l'actif garde la créance d'État, le passif ne la compense pas |
| **Compte de classe 8** | mappé (HAO), jamais ignoré |
| **Compte non mappé** à solde non nul | contrôle `unmapped` en `blocking` + liste visible ; le bilan affiche l'écart au lieu de le masquer |
| **Solde inversé** (411 créditeur, 401 débiteur) | le signe est respecté : un client créditeur bascule en dettes, pas en créance négative |
| **N-1 absent** | aucun crash, aucune valeur déduite : N-1 à 0 et `variations` à 0 |
| **Balance vide** | tous les postes à 0, contrôles en `ok`, pas de division par zéro |

---

## 9. Critères d'acceptation (bloquants)

### Test A — balance de contrôle (14 comptes, équilibrée à 21 200 000)

| Valeur | Attendu |
|---|---|
| `immoBrut` | 5 000 000 |
| `amort` | 1 000 000 |
| `immoNet` | 4 000 000 |
| `stocks` | 2 000 000 |
| `creances` | 3 200 000 |
| `tresorerie` | 4 000 000 |
| `actifTotal` | **13 200 000** |
| `capitaux` | 7 300 000 |
| `resultat` (bilan) | 3 000 000 |
| `dettesFourn` | 2 000 000 |
| `dettesFiscalesSociales` | 900 000 |
| `passifTotal` | **13 200 000** |
| `écart` | **0** |

`lib/liasse` satisfait déjà ce test : c'est le témoin de non-régression. `lib/engine` doit le satisfaire **après correction** (aujourd'hui : 7 valeurs fausses).

### Test B — jeu de démonstration (102 écritures)

| Valeur | Attendu après correction |
|---|---|
| Σ débit = Σ crédit | 80 951 571 |
| `actifTotal` | **28 140 921** |
| `passifTotal` | **28 140 921** |
| écart | **0** (aujourd'hui 108 000) |
| `produits` (7 + 8 créditeurs) | 20 640 000 |
| `charges` (6 + 8 débiteurs) | 21 119 805 |
| `resultat` | **−479 805** (aujourd'hui −587 805) |
| `nonMappes` | **vide** |

### Test C — garde-fou
Une balance contenant `901` (solde 50 000) doit produire : contrôle `unmapped` en `blocking`, écart de bilan **visible et égal à 50 000**, aucune exception.

### Test D — build
`npm run build` passe ; `npm test` : 7/7 ; aucun `any` ajouté ; `npx tsc --noEmit` sans nouvelle erreur.

---

## 10. Livrables et séquence de commits

| # | Commit | Contenu |
|---|---|---|
| 1 | `test(etats): balance de contrôle + cas limites` | `vitest` + 7 tests **échouants** (rouge assumé) |
| 2 | `feat(etats): table de mapping unique` | `src/lib/etatsMapping.ts` + `liasse` réécrit dessus + classe 8 → tests A, B, C verts pour `liasse` |
| 3 | `fix(engine): agrégats bruts et passif complet` | `aggregateGross`, 6 règles corrigées, `BilanResult` complété → test A vert pour `engine` |
| 4 | `fix(ui): exposer « Autres dettes » dans la liasse` | `pages/Liasse.tsx` l.125-126 |
| 5 | `docs: registre des défauts et décision` | `REFERENTIEL_FIMAAC.md` : D-01→D-06 passent en « corrigé (commit …) », §4.3 mis à jour |

**Definition of Done** : les 4 tests passent, l'écart de bilan est nul sur les deux jeux de données, un compte non mappé ne peut plus passer inaperçu, `/liasse` affiche toutes les composantes de son total.

---

## 11. Squelette de test attendu

```ts
// src/lib/__tests__/etats.test.ts
import { describe, it, expect } from "vitest";
import { buildStatements } from "../liasse";
import { runEngine } from "../engine";
import { CHART_OF_ACCOUNTS } from "../chart";

const CONTROLE = [ /* les 14 lignes du Test A, valeurs exactes */ ];

describe("états financiers — balance de contrôle", () => {
  it("liasse équilibre et valorise correctement", () => {
    const st = buildStatements(CONTROLE);
    expect(st.bilan.immoBrut).toBe(5_000_000);
    expect(st.bilan.creances).toBe(3_200_000);
    expect(st.bilan.actifTotal).toBe(13_200_000);
    expect(st.bilan.passifTotal).toBe(13_200_000);
    expect(st.bilan.resultat).toBe(3_000_000);
    expect(st.bilan.dettesFiscalesSociales).toBe(900_000); // après étape 2
  });
  it("engine équilibre et valorise correctement", () => { /* idem via runEngine */ });
  it("aucune anomalie de cohérence", () => {
    const st = buildStatements(CONTROLE);
    expect(st.bilan.actifTotal - st.bilan.passifTotal).toBe(0);
  });
  it("compte non mappé → contrôle bloquant", () => { /* + 901 solde 50 000 */ });
  it("exercice déficitaire → résultat négatif au passif, équilibre préservé", () => {});
  it("TVA créditrice → créance d'État conservée à l'actif", () => {});
  it("référence : 102 écritures du seed → écart 0 et nonMappes vide", () => {});
});
```

---

## 12. Ce que tu ne fais pas dans ce prompt

- Tu ne touches pas à `lib/financialStatements.ts` (cible de présentation, chantier ultérieur).
- Tu ne modifies aucune règle fiscale (TVA/IS) ni la paie.
- Tu ne changes pas `DB_VERSION` (aucune collection nouvelle).
- Tu n'introduis pas de dépendance autre que `vitest`.
- Tu ne reformates pas les fichiers hors périmètre.
- Si un préfixe comptable n'est pas vérifiable dans `chart.ts`, tu **ne l'inventes pas** : tu l'écris en commentaire `// À VÉRIFIER` et tu le signales dans le compte rendu.
