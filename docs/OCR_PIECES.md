# Lecture des pièces justificatives & pièces jointes des écritures

## ✅ Ce qui a été livré
| Fonctionnalité | État |
|---|---|
| Lecture des données des pièces (n°, date, client, fournisseur, désignation, HT, TVA, taux, TTC, devise) | ✅ |
| Pièces jointes des écritures (visualisation + téléchargement) | ✅ |
| Signalement des zones illisibles — **rien n'est inventé** | ✅ |
| Modification des écritures (avec validation comptable) | ✅ |

---

## 1. Lecture des pièces justificatives

### ⚠️ Changement fondamental : plus de valeur inventée
L'ancien `runOcr` **générait des valeurs aléatoires** (montant tiré au hasard,
« Fournisseur détecté (extrait) », n° aléatoire). C'était une invention pure —
exactement ce qui était interdit. Il a été réécrit de fond en comble.

### Ce qui est réellement lisible dans un navigateur
| Format | Moteur | Lecture |
|---|---|---|
| `.csv` / `.txt` | motifs regex | ✅ complète |
| `.xlsx` / `.xls` | ExcelJS + motifs | ✅ (tronqué à 300 lignes/feuille) |
| `.pdf` avec couche texte | extraction des flux `Tj`/`TJ` | ✅ si non compressé |
| `.pdf` scanné / `FlateDecode` | — | ❌ **10 zones illisibles** |
| image (`jpg`, `png`…) | — | ❌ **10 zones illisibles** |
| autre binaire | — | ❌ **10 zones illisibles** |

**Les images scannées ne sont pas lisibles sans service OCR externe.** On ne les
devine pas : tous les champs passent en `unreadable` et l'interface invite à la
complétion manuelle ou au branchement d'un service (job `document.ocr`,
`backend/README.md` §7).

### Champs extraits
| Clé | Libellé |
|---|---|
| `numero` | N° de pièce / facture |
| `date` | Date de la pièce |
| `fournisseur` | Fournisseur (émetteur) |
| `client` | Client (destinataire) |
| `designation` | Article / désignation |
| `ht` | Montant HT |
| `tva` | TVA (montant) |
| `taux_tva` | Taux de TVA |
| `ttc` | Montant TTC |
| `devise` | Devise |

### Statut de lisibilité par champ
| Statut | Signification |
|---|---|
| `read` | valeur lue avec un motif clair (confidence 55-90) |
| `manual` | complété par un humain (confidence 100) |
| `unreadable` | zone présente mais non lisible |
| `missing` | aucune zone correspondante dans le document |

**Règle absolue : un champ non déterminé vaut `null`, jamais 0** — même
convention que §24 du moteur de production.

### Corrections de regex découvertes au test
1. **Les captures de texte avalaient les sauts de ligne** (`\s` inclut `\n`) —
   `fournisseur: "SARL MatInfo\nClient"`. Corrigé : les classes de caractères
   de texte libre n'incluent plus les fins de ligne.
2. **Le pattern TVA attrapait le taux au lieu du montant** — `TVA 18% : 90 000`
   donnait `tva: "18"`. Corrigé : un motif dédié `TVA <taux>% : <montant>` à
   confiance 85, plus une lookahead négative `(?!\s*%)` sur le motif générique.
3. **Les montants exigeaient ≥ 3 caractères** — un montant à 1 ou 2 chiffres
   était ignoré. Corrigé.

### Complétion manuelle
`setExtractionField(docId, key, value)` : le champ passe en `manual` (confidence
100), l'événement `OCR_FIELD_MANUAL` est consigné dans l'audit trail. Le champ
`fields` reste plat (compatible `postFromDocument` qui lit `ht`/`tva`/`fournisseur`).

---

## 2. Pièces jointes des écritures

### Modèle de données
- `JournalEntry.attachmentDocIds: ID[]` — **nouveau champ obligatoire**
- `DocumentItem.linkedEntryId: ID | null` — déjà présent
- Les deux sont synchronisés par `linkDocumentToEntry` / `unlinkDocumentFromEntry`

### Registre mémoire des fichiers
Les objets `File` ne sont pas sérialisables en `localStorage` : le store ne garde
que les métadonnées. `src/lib/documentStore.ts` conserve les `File` en mémoire
**le temps de la session**. Après un rechargement de page, l'aperçu est
indisponible — l'interface le signale explicitement (jamais de contenu déduit).

### Composants
| Composant | Rôle |
|---|---|
| `DocumentViewer` | aperçu `<img>` / `<iframe>` (PDF) / fallback + **bouton Télécharger** + données extraites |
| `EntryAttachments` | gestion des pièces d'une écriture : liste, rattachement d'une pièce existante, ajout d'un nouveau fichier |
| `AttachmentCount` | indicateur compact dans les lignes de tableaux |

### Interface (onglet Écritures)
- **Colonne « Pièces »** dans le tableau avec compteur cliquable
- **Bouton trombone** sur chaque ligne → modale de gestion
- Panneau détaillé (dépliage) : puces cliquables par pièce, avec statut lu/illisible
- Chaque pièce → visionneuse + téléchargement

---

## 3. Modification des écritures

`updateEntry(entryId, data)` — validations avant mutation :

| Contrôle | Réfus si |
|---|---|
| Équilibre | Σ débit ≠ Σ crédit (règle absolue) |
| Montant | Σ débit = 0 |
| Comptes | introuvables dans le plan, ou non imputables (`postable === false`) |
| Période | clôturée (workflow Sage) |

Chaque modification produit un audit trail `UPDATE_ENTRY` avec le diff
`before → after` (date, journal, référence, libellé, statut, lignes).

**Note comptable** : pour une écriture déjà publiée, la contrepassation reste
la voie recommandée (écriture d'annulation). La modification directe est tracée
mais ne remplace pas cette procédure — un bandeau le rappelle dans l'éditeur.

`EntryEditor` est un composant réutilisable (`entry?: JournalEntry`) : création
**et** modification, avec pré-chargement des lignes existantes.

---

## Vérifications d'exécution

### Extraction — honnêteté
```
image scannée  : image | lisible: false | illisibles: 10/10
                 aucune valeur inventée : ✅

CSV            : lus: 10 | illisibles: 0
  numero      FAC-2026-0142
  date        15/02/2026
  fournisseur SARL MatInfo          ← plus de saut de ligne
  client      Société Alpha SARL
  designation Ordinateur portable
  ht          500000
  tva         90000                 ← plus le taux 18
  taux_tva    18
  ttc         590000
  devise      XOF
sauts de ligne dans les valeurs : ✅ aucun

XLSX corrompu : lisible: false | illisibles: 10   ← pas d'invention
```

### Pièces jointes
```
entry.attachmentDocIds : ✅ [1 élément]
doc.linkedEntryId      : ✅
cohérence bidirectionnelle : ✅
après unlink           : ✅ vide
```

### Modification d'écriture
```
équilibrée       : ✅ montant 708000 · réf FAC-2026-0142-R · audit UPDATE_ENTRY
déséquilibrée    : ✅ refusée — Écriture déséquilibrée : écart de 50000 FCFA.
période clôturée : ✅ refusée — la modification est bloquée pour ce mois.
compte de titre  : ✅ refusée — Le compte 60 (...) n'est pas imputable.
```

### Régressions
```
Σ Débit = Σ Crédit : ✅
tsc --noEmit : 0 erreur · build 2 069 kB (585 kB gzip) · 84 fichiers
```
