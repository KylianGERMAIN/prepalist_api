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

Phases suivantes (shopping-list, ai, notifications) cf. `instruction.md` §9.
