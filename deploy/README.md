# Déploiement PrepaList (serveur / VPS)

Topologie : **Caddy** (TLS) → **front** (Next) → **api** (NestJS, interne) → **Postgres managé** (externe).
Le back n'est pas exposé publiquement. Les images sont construites et poussées sur `ghcr.io` par la CI à chaque tag `vX.Y.Z`.

## 1. Prérequis (une fois)

- Un **VPS** avec Docker + Docker Compose.
- Un **domaine** (enregistrement DNS A/AAAA → IP du VPS).
- Une base **Postgres managée** (Neon / Supabase / RDS...) avec ses identifiants.
- Les **images GHCR** rendues publiques, ou un `docker login ghcr.io` sur le VPS (token avec `read:packages`).

## 2. Publier les images

Pousser un tag de version sur chaque repo (déclenche la CI `release`) :

```bash
# dans prepalist_api et prepalist_front
git tag v0.1.0 && git push origin v0.1.0
```

Produit `ghcr.io/kyliangermain/prepalist-api:0.1.0` et `...-front:0.1.0`.

## 3. Sur le serveur

Copier le contenu de ce dossier `deploy/` puis :

```bash
cp .env.example .env             # renseigner DOMAIN + TAG (ex. 0.1.0)
cp .env.prod.example .env.prod   # renseigner DB_* (managé, DB_SSL=true) + secrets JWT
docker compose -f docker-compose.prod.yml pull
```

## 4. Migrations (one-shot, à chaque déploiement qui en contient)

```bash
docker compose -f docker-compose.prod.yml run --rm api pnpm migration:run:prod
```

(S'exécute sur les migrations compilées dans l'image, contre la base managée.)

## 5. Démarrer

```bash
docker compose -f docker-compose.prod.yml up -d
```

Caddy obtient le certificat TLS automatiquement. Vérifier :

```bash
curl -fsS https://$DOMAIN            # le front répond
docker compose -f docker-compose.prod.yml exec api wget -qO- http://localhost:3000/health   # {"database":"up"}
```

## Mise à jour

Pousser un nouveau tag → `docker compose pull` → migrations si besoin → `up -d`.
