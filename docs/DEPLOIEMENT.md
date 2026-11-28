# Déploiement — FIMAAC

> État constaté le 2026-11-28 : le site est **déjà en ligne** sur Vercel, en production,
> et **relié au dépôt GitHub** `VidCoder-Bedos/fimaac`.

| Élément | Valeur |
|---|---|
| URL de production | https://fimaac-9f4v.vercel.app |
| Projet Vercel | `vidcoder-bedos/fimaac` |
| Branche de production | `main` |
| Dernier commit déployé | `1c828db` — statut Vercel « Deployment has completed » |
| Type d'application | SPA 100 % statique (React + Vite), **sans backend** |
| Sortie de build | `dist/index.html` unique (~2,1 Mo, ~615 ko gzip) |
| Variables d'environnement | **aucune** (pas de clé API, l'IA est locale) |

## 1. Ce que fait réellement un déploiement

L'application n'a **aucun appel réseau applicatif** : pas de `fetch`, pas de `/api`,
pas de base distante. Tout l'état (cabinets, écritures, pièces, utilisateurs) est stocké
dans le `localStorage` du navigateur, sous la clé `fimaac_db_v1`. Le backend décrit dans
`backend/` (Docker + Postgres + Prisma) **n'est pas déployé** : c'est un plan de migration
futur, sans aucun impact sur le site en ligne.

Conséquence directe : « redéployer » ne fait que **remplacer les fichiers statiques**
HTML/CSS/JS servis par Vercel. Aucune donnée comptable n'est transférée, migrée ou perdue
côté serveur — les données restent dans le navigateur de chaque utilisateur.

Le build est un **fichier unique** grâce à `vite-plugin-singlefile` : le JS et le CSS sont
inlinés dans `dist/index.html`. Les routes utilisent un `HashRouter` (`/#/app`, `/#/login`…),
donc **aucune règle de rewrite n'est nécessaire** sur Vercel.

## 2. Procédure normale : publier une modification

C'est le chemin à privilégier, car l'intégration GitHub ↔ Vercel est active : **tout push
sur `main` déclenche un build et un déploiement de production automatiques**.

```bash
# 1. Vérifier que le build passe en local
npm ci
npm run build            # doit produire dist/index.html

# 2. Commit sur une branche de travail
git checkout -b ma-modif
git add -A
git commit -m "fix: ..."
git push origin ma-modif
```

3. Ouvrir une Pull Request `ma-modif` → `main`.
   Le push de la branche crée au passage un **Preview Deployment** Vercel (URL du type
   `fimaac-xxxx-vidcoder-bedos.vercel.app`) : on peut tester la version avant de publier.
4. Fusionner la Pull Request (`Merge pull request`).
5. Vercel construit et publie automatiquement en ~1 à 2 minutes.
6. Vérifier :

```bash
gh api repos/VidCoder-Bedos/fimaac/commits/main/status \
  --jq '.statuses[] | "\(.context) → \(.state) — \(.description)"'
# attendu : Vercel → success — Deployment has completed
```

Le commit déployé est aussi visible dans Vercel → *Deployments*, et le statut apparaît
sur le commit dans GitHub (petite coche verte à côté du SHA).

## 3. Redéployer sans changer le code

Cas d'usage : changer un domaine, tester un réglage, republier la même version.

- **Vercel → Deployments → ligne du déploiement → menu `⋯` → Redeploy.**
  Utile aussi si un ancien déploiement a été supprimé.
- Ne pas confondre avec un nouveau build : « Redeploy » réutilise le même commit.

## 4. Déploiement manuel (secours, sans passer par Git)

À n'utiliser que si l'intégration Git est cassée. Cela **désynchronise** Vercel du dépôt :
les pushes suivants ne déclencheront plus rien tant que le lien n'est pas rétabli.

```bash
npm ci
npm run build
npx vercel --prod        # ou : npx vercel login && npx vercel --prod
```

Alternative sans CLI : Vercel → *Add New… → Project → Deploy* depuis un dossier glissé,
en envoyant le contenu de `dist/` (l'index.html unique suffit : c'est tout le site).
Attention à ne pas créer un **second projet** : cela donnerait une nouvelle URL et donc
un nouveau `localStorage`, donc des utilisateurs « vides ».

## 5. Réglages Vercel attendus (à ne pas casser)

| Réglage | Valeur |
|---|---|
| Framework Preset | Vite (détecté automatiquement) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm ci` (ou `npm install`) |
| Root Directory | la racine du dépôt (pas `src/`) |
| Node.js Version | 22.x |
| Production Branch | `main` |

Aucun `vercel.json` n'est nécessaire ; le dépôt n'en contient pas volontairement.

## 6. Points de vigilance

1. **Données locales.** Tout est dans le navigateur. Changer de domaine, de projet Vercel
   ou vider le cache fait apparaître une base vide. Avant toute bascule de domaine :
   *Paramètres → Données → Export JSON*, puis réimport après la bascule.
2. **Pas de `.gitignore` jusqu'ici** : `node_modules/` (219 Mo) et `dist/` pouvaient être
   commités par erreur. C'est corrigé — ne jamais les versionner.
3. `fimaac-1.3.zip` (1,6 Mo) est suivi par Git : c'est une archive de sauvegarde des
   sources. Elle n'a aucun effet sur le déploiement, mais elle alourdit le dépôt.
4. Le build ne fait **pas** de vérification de types (`vite build` seulement). Pour un
   contrôle strict : `npx tsc --noEmit`.
5. Un build cassé sur Vercel ne casse pas le site : la dernière version valide reste en
   ligne, le nouveau déploiement est marqué *Error*.

## 7. En cas de problème

| Symptôme | Cause probable | Action |
|---|---|---|
| Vercel reste « Queued » / ne se déclenche pas | intégration Git déconnectée | Vercel → Settings → Git → reconnecter `VidCoder-Bedos/fimaac` |
| Build *Error* `Cannot find module` | `package-lock.json` désynchronisé | `npm install` en local, commiter le lock |
| Build *Error* `vite: not found` | devDependencies non installées | vérifier que `NODE_ENV` n'est pas `production` à l'install |
| Page blanche, 404 sur une route | URLs non hashées utilisées | garder `HashRouter` (déjà en place) |
| Site à jour mais données « perdues » | autre domaine / autre navigateur | réimporter l'export JSON des paramètres |
