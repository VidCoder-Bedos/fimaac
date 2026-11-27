# DECISIONS — Journal des décisions de conception

> Chaque décision : **Décision · Alternatives écartées · Raison · Date**.
> Maintenu à jour à chaque fin de lot. Permet de comprendre le « pourquoi »
> sans relire tout le code.

---

## D1 — Liaison cabinet ↔ entreprise via `Company.cabinetOrganizationId`

**Décision** : champ direct sur `Company` (`cabinetOrganizationId: ID | null`) plutôt qu'une table de liaison dédiée.

**Alternatives écartées** :
- Table de liaison `CompanyCabinet { companyId, cabinetOrganizationId }` : plus souple (multi-cabinet), mais complexifie les requêtes et le sélecteur de périmètre.
- Réutiliser `Company.organizationId` seul : impossible, car une entreprise auto-inscrite a sa **propre** org comme propriétaire de données.

**Raison** : une entreprise est rattachée à **un seul** cabinet dans le modèle actuel ; un champ suffit, reste lisible, et le sélecteur `companiesForUser` reste un simple `filter`. `organizationId` est conservé tel quel (org propriétaire des données) pour ne pas casser l'isolation existante et les 24 routes.

**Impact futur** : si le multi-cabinet devient nécessaire, ajouter la table de liaison et faire évoluer `companiesForUser` — le reste de l'app ne change pas (elle ne consomme que le sélecteur).

**Date** : session liaison, LOT 1.

---

## D2 — Identifiants « coordonnées » = identifiants de connexion

**Décision** : interpréter la demande « le cabinet génère des coordonnées spécifiques pour chaque entreprise » comme des **identifiants de connexion au portail** (e-mail + mot de passe temporaire), et non comme des coordonnées de contact.

**Alternatives écartées** : coordonnées de contact seules (adresse, téléphone) — insuffisantes : l'entreprise ne pourrait pas se connecter au portail.

**Raison** : c'est ce qui rend le portail client utilisable par l'entreprise, et les coordonnées de contact existent déjà comme champs `Company.address` / `Company.phone` (ajoutés au formulaire au passage).

**Date** : session liaison, LOT 2.

---

## D3 — Mot de passe temporaire affiché une seule fois

**Décision** : le mot de passe généré est renvoyé par l'action à l'appelant (UI), affiché dans une modale avec bouton Copier et avertissement, puis **jamais persisté ni ré-affiché**. Seul le hash est stocké ; `mustChangePassword: true` force le changement à la prochaine connexion.

**Alternatives écartées** : stocker le mot de passe en clair pour permettre le ré-affichage (faille de sécurité) ; envoyer par e-mail (aucun service branché en démo — cf. backend/README.md §7).

**Raison** : invariant de sécurité I5. Le flux « afficher une fois → transmettre → changer à la première connexion » reproduit le comportement des SaaS B2B.

**Date** : session liaison, LOT 2.

---

## D4 — Rattachement auto-accepté à l'inscription entreprise

**Décision** : quand une entreprise choisit un cabinet à l'inscription, le rattachement est **immédiat** (auto-accepté) avec notification au cabinet.

**Alternatives écartées** : flux de validation (statut en attente → accepté/refusé par le cabinet) — plus réaliste mais ajoute un statut, une file de traitement, des écrans de validation et un cas de rejet.

**Raison** : livrer les 4 chantiers demandés sans gonfler le périmètre. Le flux de validation est tracé au backlog.

**Date** : session liaison, LOT 4.

---

## D5 — Bloc « Travail à faire aujourd'hui » supprimé du Dashboard

**Décision** : supprimer le bloc (et `computeWorkload` de l'UI), remplacé par une tuile récapitulative compacte avec bouton vers le Centre des obligations.

**Alternatives écartées** : garder les deux (double maintenance, données contradictoires possibles) ; déplacer le bloc vers le Centre des obligations (il y est déjà, avec filtres et calendrier en plus).

**Raison** : le Centre des obligations agrège exactement les 6 mêmes sources avec des filtres par catégorie/statut, un calendrier et des compteurs — le bloc Dashboard était un doublon moins capable. `computeWorkload` reste exporté dans analytics.ts (API), plus consommé par l'UI.

**Date** : session liaison, LOT 6.

---

## D6 — Écran bloquant de première connexion

**Décision** : `PasswordGate` dans App.tsx — si `user.mustChangePassword`, tout l'arbre de routes est remplacé par l'écran `ForceChangePassword` (indépendant du HashRouter, donc aucun accès à aucune page tant que ce n'est pas fait).

**Alternatives écartées** : bannière non bloquante (l'utilisateur peut l'ignorer) ; redirection vers /portail/parametres (le gate est plus sûr et couvre tous les espaces).

**Raison** : les identifiants générés par le cabinet sont connus du cabinet ; forcer le changement restaure la confidentialité du compte.

**Date** : session liaison, LOT 5.

---

## D7 — Sélecteur de périmètre unique (`src/lib/scope.ts`)

**Décision** : extraire `companiesForUser(db, user)` et remplacer les 9 implémentations dupliquées du filtre `organizationId === user.organizationId`.

**Alternatives écartées** : garder les duplications et juste ajouter le filtre `cabinetOrganizationId` à chaque endroit — 9 endroits à maintenir en parallèle, risque élevé de divergence (et c'est exactement le genre de bug qui a causé M9).

**Raison** : la liaison change la définition du périmètre ; un seul point de vérité garantit que le Dashboard, la recherche, le portail, l'admin et les ateliers voient la même liste.

**Date** : session liaison, LOT 1.
