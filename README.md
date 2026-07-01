# PrepaList API

Backend NestJS de l'application meal-prep PrepaList v2. Cf. `../instruction.md`
pour le cadrage produit et `CLAUDE.md` pour les conventions.

## Prérequis

- Node 20+ et pnpm
- Docker (pour Postgres local)

## Démarrage

```bash
cp .env.example .env          # ajuster les secrets JWT
docker compose up -d          # Postgres 16 sur :5432
pnpm install
pnpm migration:run            # crée le schéma
pnpm start:dev                # http://localhost:3000  ·  Swagger sur /docs
```

## Scripts

| Commande | Effet |
| --- | --- |
| `pnpm start:dev` | API en watch |
| `pnpm build` | compilation TS → `dist/` |
| `pnpm lint` | ESLint + Prettier (fix) |
| `pnpm test` | specs Jest |
| `pnpm migration:generate src/migrations/<Nom>` | génère une migration depuis les entities |
| `pnpm migration:run` / `pnpm migration:revert` | applique / annule |

## État

- **Phase 0** — socle : config, health, users, auth (register / login / refresh JWT), CI.
- **Phase 1** — meals + ingredients : entities `Meal` / `Ingredient` / `MealIngredient`,
  CRUD `meals` (scopé user, filtres favorite/tag/name, `POST /:id/cooked`),
  catalogue `ingredients` (recherche ILike).
- **Phase 2** — semaine : `Week` / `WeekSlot`, `POST /weeks` (14 créneaux),
  `GET /weeks/current`, `POST /weeks/:id/generate` (génération pondérée
  favori/fraîcheur + règle des restes), `PATCH /weeks/:id/slots/:slotId`.
- **Phase 3** — liste de courses : `GET /weeks/:id/shopping-list`, agrégation
  dérivée (quantité × portions, groupée par ingrédient + unité). Pas de table.
- **Phase 5** — rappel hebdo : cron (`@nestjs/schedule`, dimanche 18h) qui
  rappelle aux utilisateurs sans semaine planifiée de composer la semaine à venir.
  Livraison par log pour l'instant (canal email/push à brancher).

Phase 4 (capture IA) écartée volontairement.

## Déploiement

Image Docker multi-stage (`Dockerfile`), CI build+push sur `ghcr.io` à chaque tag `vX.Y.Z`
(`.github/workflows/release.yml`). Stack prod (front + api + Caddy, Postgres managé externe)
et procédure complète : voir [`deploy/`](./deploy/README.md). Migrations prod :
`pnpm migration:run:prod` (sur `dist/` compilé). Variables prod : cf. `deploy/.env.prod.example`.
