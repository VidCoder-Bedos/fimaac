# P2 — Journal d'audit chaîné (détection d'altération)

> Prompt rédigé puis exécuté dans la même session. Statut : **exécuté et livré**.

## 1. Besoin métier

Le produit annonçait un « journal d'audit inviolable ». C'était une promesse
sans mécanisme : les traces vivent dans le `localStorage`, n'importe qui peut
éditer le JSON, et rien ne le signalait. En local, l'inviolabilité est
**impossible** ; la **détection de l'altération**, elle, est atteignable — et
c'est la seule promesse honnête.

## 2. Mécanisme

`src/lib/auditChain.ts` :

```
hash(n) = SHA-256( hash(n-1) | seq | id | date | acteur | action | entité | avant | après | ip )
hash(0) = SHA-256( GENESIS | … )
```

- Chaque entrée porte `seq`, `prevHash`, `hash`.
- `verifyAuditChain(logs)` remonte du plus ancien au plus récent et détecte :
  **contenu modifié**, **entrée insérée**, **entrée supprimée**, **entrées
  déplacées**, avec la position exacte de la première rupture.
- SHA-256 implémenté en TypeScript pur (synchrone, sans `crypto.subtle`) pour
  rester utilisable dans une mutation de store synchrone. **Vérifié contre les
  vecteurs officiels** (`""` et `"abc"`) dans les tests.

## 3. Intégration

- `actions.ts :: audit()` — chaque trace est scellée à la suite de la
  précédente ; aucun autre point d'écriture à modifier.
- Page **Journal d'audit** (administration) : bouton « Vérifier l'intégrité »,
  résultat en clair (chaîne intacte + nombre d'entrées vérifiées, ou rupture
  avec sa position et sa raison), et note expliquant la portée réelle.

## 4. Honnêteté de la promesse

Le bandeau de l'écran l'écrit noir sur blanc : ce contrôle **détecte**
l'altération, il ne l'**empêche** pas. Un attaquant qui recalcule toute la
chaîne n'est pas détecté tant qu'il n'existe pas d'ancrage serveur. C'est
exactement le lot P1 « journal inviolable côté serveur », qui reste ouvert.

## 5. Compatibilité

- `AuditLog.seq` / `prevHash` / `hash` sont **optionnels** : les traces
  antérieures au scellement sont comptées comme « non scellées », jamais
  accusées.
- Aucune autre signature modifiée ; deux écritures directes de `auditLogs`
  (tarifs de plateforme) restent non scellées et sont signalées comme telles.

## 6. Validation

- `tsc --noEmit` : 0 erreur · `npm run build` : succès (11,66 s).
- `vitest` : **83/83** verts, dont 12 nouveaux : vecteurs SHA-256 officiels,
  UTF-8, déterminisme, scellement, chaîne intacte, contenu modifié (rupture
  localisée à l'entrée 3), suppression, déplacement, traces antérieures,
  journal vide, et **scellement réel par une action applicative**
  (`runPayroll`).
