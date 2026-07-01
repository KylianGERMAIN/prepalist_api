# CLAUDE.md — PrepaList API

Conventions condensées pour les sessions Claude Code sur ce dépôt. Source de
vérité du cadrage : `../instruction.md`.

## Stack

NestJS 11 + TypeScript strict · PostgreSQL via TypeORM (`synchronize: false`) ·
JWT access + refresh (`@nestjs/jwt` + `passport-jwt`) · Swagger · Throttler ·
helmet · class-validator / class-transformer. Jest pour les specs.

## Écarts assumés vs `instruction.md` (validés avec l'auteur)

- **Polyrepo, pas monorepo** (§2). L'API vit dans son propre dépôt
  (`prepalist_api`), pas dans `apps/api`. `packages/shared` n'existe pas — le
  front consommera les types via le client OpenAPI généré depuis Swagger.
- **Git Flow allégé, pas GitHub Flow** (§7). `main` = releases taguées
  uniquement, `develop` = intégration, `feat/*` partent de `develop`. Pas de
  `release/*`/`hotfix/*` tant qu'il n'y a pas de versions parallèles.
- **Refresh token stateless** : vérifié par signature JWT, non stocké en base.
  À faire évoluer (rotation + révocation) si besoin de sécurité accru.
- `gardenmate_api` n'étant pas accessible, la structure est du Nest idiomatique
  calqué sur §2, pas un portage littéral du « patron GardenMate ».

## Structure

```
src/
  config/data-source.ts     # options TypeORM partagées app + CLI migrations
  common/                   # dto paginated, guards, decorators, filter, middleware, interceptor
  modules/
    health/ users/ token/ auth/
  migrations/
  main.ts  app.module.ts
```

## Règles de code

- TypeScript `strict: true`. ESLint + Prettier font foi.
- Un module par domaine (`controller` / `service` / `dto` / `entities`).
- DTO validés `class-validator`. Erreurs via exceptions Nest.
- **JSDoc en français** sur les méthodes publiques.
- Nommage : fichiers `kebab-case`, classes `PascalCase`, colonnes DB
  `snake_case` (via `name:`), enums `UPPER_SNAKE`.
- Toute modif de schéma = une migration générée et commitée dans le même PR.
  Ne jamais éditer une migration déjà mergée.

## Git

- Conventional Commits : `type(scope): sujet impératif`
  (`feat`, `fix`, `chore`, `refactor`, `test`, `docs`, `build`, `ci`).
- Une PR par tâche vers `develop`, squash merge.
- SemVer, tag par phase sur `main` (`v0.1.0`…). Pas de `v1.0.0` sans feu vert.
- Secrets : `.env.example` commité, `.env` gitignored. Aucune clé dans le code.

## Commandes

```bash
docker compose up -d        # Postgres local
pnpm install
pnpm migration:run          # applique les migrations
pnpm start:dev              # API + Swagger sur /docs
pnpm lint && pnpm test      # qualité
```
