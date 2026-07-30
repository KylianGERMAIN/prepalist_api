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
- **Phase 2** — plan de repas : `Plan` / `PlanSlot`, un seul plan par utilisateur
  créé à la volée sur `GET /plan` (`dayCount` jours × midi/soir), créneaux rangés
  par `dayIndex` et non par date. `POST /plan/generate` (génération pondérée
  favori/fraîcheur + règle des restes), `PATCH /plan/slots/:slotId`,
  `DELETE /plan/slots` (vide les créneaux et les items dérivés, réancre
  `startDate` sur le jour de courses).
- **Phase 3** — liste de courses : `GET /plan/shopping-list`, table matérialisée
  `shopping_list_items`, synchronisation explicite `POST /plan/shopping-list/sync`
  insert-only, CRUD des items par `itemId`.

Phase 4 (capture IA) écartée volontairement. Phase 5 (rappel hebdo par cron)
retirée : la livraison n'était qu'un log, et « pas encore planifié » n'a plus de
sens depuis que le plan est créé automatiquement.

## Déploiement

Image Docker multi-stage (`Dockerfile`), CI build+push sur `ghcr.io` à chaque tag `vX.Y.Z`
(`.github/workflows/release.yml`). Stack prod (front + api + Caddy, Postgres managé externe)
et procédure complète : voir [`deploy/`](./deploy/README.md). Migrations prod :
`pnpm migration:run:prod` (sur `dist/` compilé). Variables prod : cf. `deploy/.env.prod.example`.
