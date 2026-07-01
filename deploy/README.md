# Déploiement PrepaList — Neon + Render + Vercel

Topologie : **Neon** (Postgres managé) ← **Render** (API NestJS, image Docker, publique) ← **Vercel** (front Next, appelle l'API en server-side).

Déclenchement : **on ne déploie que sur bump de version.** `npm version` bump `package.json` **et** crée un tag `vX.Y.Z`. Le push du tag déclenche le workflow `deploy` de chaque repo, qui déploie Render (Deploy Hook) et Vercel (CLI). Les auto-deploys natifs des deux plateformes restent **désactivés** → on travaille librement sur `main` sans rien déployer.

```
main : commit … commit … commit        (rien ne se déploie)
              │
        npm version minor  ──►  tag v0.2.0  ──►  push --follow-tags
                                                        │
                          ┌─────────────────────────────┴───────────────┐
                     GHA deploy (api)                              GHA deploy (front)
                     curl Render Deploy Hook                       curl Vercel Deploy Hook
                          │                                              │
              Render: build Docker → Pre-Deploy migrations → up    Vercel: build → prod
```

---

## 1. Neon (base de données)

1. Créer un projet Neon → une base Postgres.
2. Récupérer les identifiants de connexion (Dashboard → Connection Details). En déduire les variables :

| Neon | Variable API |
|------|--------------|
| host (`...neon.tech`) | `DB_HOST` |
| port (`5432`) | `DB_PORT` |
| user | `DB_USERNAME` |
| password | `DB_PASSWORD` |
| database | `DB_NAME` |
| — | `DB_SSL=true` (Neon impose TLS) |

Rien d'autre : les tables sont créées par les migrations TypeORM (jouées par Render, cf. §2). `synchronize:false`, le schéma n'évolue que par migrations.

---

## 2. Render (API)

**New → Web Service**, connecter le repo `prepalist_api`.

- **Runtime** : `Docker` (utilise le `Dockerfile` du repo).
- **Branch** : `main`.
- **Auto-Deploy** : **No** (Settings → Build & Deploy). On déploie uniquement via le Deploy Hook sur tag.
- **Pre-Deploy Command** : `pnpm migration:run:prod` — joue les migrations compilées (`dist/`) contre Neon avant de basculer sur la nouvelle version.
- **Health Check Path** : `/health` (teste la DB, renvoie 503 si down).
- **Environment** : renseigner les variables de `deploy/.env.prod.example` (les `DB_*` de Neon, `DB_SSL=true`, `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — générer via `openssl rand -base64 48`). `PORT` est injecté par Render, ne pas le fixer. `CORS_ORIGINS` peut rester vide (le front tape l'API en server-side, pas de CORS navigateur).

Puis **Settings → Deploy Hook** : copier l'URL → la mettre dans le repo `prepalist_api` :
`Settings → Secrets and variables → Actions → New secret` : `RENDER_DEPLOY_HOOK`.

Noter l'**URL publique** du service Render (`https://prepalist-api-xxxx.onrender.com`) : c'est l'`API_URL` du front.

---

## 3. Vercel (front)

1. Importer le repo `prepalist_front` (Production Branch = `main`).
2. **Environment Variables** : `API_URL` = l'URL publique Render de l'API (production).
3. L'auto-deploy sur push Git est déjà coupé par `vercel.json` (`git.deploymentEnabled:false`, commité dans le repo) → seul le Deploy Hook déploie.
4. **Settings → Git → Deploy Hooks** : créer un hook sur la branche `main`, copier l'URL → repo `prepalist_front` : `Settings → Secrets and variables → Actions → New secret` : `VERCEL_DEPLOY_HOOK`.

Le front est buildé nativement par Vercel (l'option `output: "standalone"` de `next.config.ts` est ignorée par Vercel, sans effet).

---

## 4. Releaser

Sur chaque repo à déployer, depuis `main` à jour :

```bash
npm version patch          # ou minor / major : bump package.json + commit + tag vX.Y.Z
git push --follow-tags     # pousse le commit ET le tag → déclenche le workflow deploy
```

Vérifier :

```bash
curl -fsS https://<render-url>/health        # {"database":"up"}
# puis login dans le navigateur sur l'URL Vercel → les cookies httpOnly sont posés
```

Rollback : re-déployer une version antérieure via le dashboard Render/Vercel (historique des déploiements), ou re-taguer un ancien commit.
