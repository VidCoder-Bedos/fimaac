# P0-5 — Garde-fou de stockage et signal de démonstration

> Prompt rédigé puis exécuté dans la même session. Statut : **exécuté et livré**.

## 1. Besoin métier

Les données de FIMAAC vivent dans le `localStorage` du navigateur. Deux
problèmes se cumulaient :

1. **L'utilisateur ne le savait pas.** Rien n'indiquait que son dossier
   n'était ni sur un serveur, ni sauvegardé, ni partagé. Un rechargement, un
   nettoyage de navigateur ou un changement de poste efface tout.
2. **L'échec d'écriture était avalé.** `persist()` faisait `try { ... } catch {}`.
   Au-delà du quota, l'application continuait d'afficher des écritures qui
   n'étaient plus écrites nulle part : l'utilisateur travaillait dans le vide,
   et le découvrait au rechargement.

## 2. Modules concernés

`lib/store.ts` (persistance) · `components/AppLayout.tsx` (shell) ·
nouveaux `lib/storage.ts` et `components/StorageNotice.tsx`.

## 3. Correctif technique

- `persist()` capture désormais l'erreur et l'expose : `persistError`
  (« quota de stockage du navigateur dépassé » ou message réel).
- `storageSnapshot()` rend l'occupation réelle (octets sérialisés) et l'état de
  la dernière écriture réussie (`lastPersistedAt`).
- `lib/storage.ts` : `measureUsage`, `measureSerialized`, `byteLength`,
  `humanBytes`, `backupFileName`, `storageMessage`.
- Budget de référence : **5 Mio** (limite la plus basse couramment rencontrée),
  seuils **80 %** (alerte) et **95 %** (critique). Hypothèse assumée et
  documentée : mieux vaut alerter trop tôt que trop tard.

## 4. Interface

Bandeau permanent sous la barre supérieure : état, occupation chiffrée, jauge,
bouton **« Exporter la sauvegarde »** (JSON horodaté), heure de dernière
sauvegarde. Le bandeau se referme seulement quand tout va bien : un incident de
sauvegarde reste affiché, en rouge, sans bouton de fermeture.

## 5. Non-régression

- Aucune signature publique modifiée ; `exportDB()` / `importDB()` inchangés.
- Le bandeau disparaît si le stockage est indisponible (SSR, mode privé) :
  `storageSnapshot()` est appelé dans un `try`.
- Recalcul de la jauge sur mutation du store uniquement, pas à chaque rendu :
  la sérialisation de la base ne coûte rien en boucle de rendu.

## 6. Critères de validation

- `tsc --noEmit` : 0 erreur · `npm run build` : succès (12,55 s).
- `vitest` : **63/63** verts, dont 13 nouveaux tests.
- Sur le jeu de démonstration : occupation mesurée < budget, niveau `ok`,
  `persistError` nul, export complet du dossier (mêmes nombres de dossiers et
  d'écritures après relecture JSON).

## 7. Points ouverts

- La persistance reste locale : ce lot **rend le risque visible**, il ne
  l'élimine pas. La suppression du risque est le lot P1 (backend + Prisma).
- Pas encore de sauvegarde automatique planifiée ni de rotation d'archives.
