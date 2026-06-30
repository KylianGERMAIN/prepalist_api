# feat(api): bootstrap phase 0 — socle

## Résumé

Met en place le socle de l'API PrepaList v2 : NestJS 11 + TypeScript strict,
PostgreSQL via TypeORM (`synchronize: false`), authentification JWT
(access + refresh), et l'outillage qualité. Login fonctionnel de bout en bout.

## Contexte

Première brique de la refonte v2 (cf. `instruction.md` §9, Phase 0). Aucune
réutilisation du code v1. Le périmètre s'arrête au socle : pas encore de meals,
weeks, shopping-list ni IA.

## Changements

**Bootstrap & config**
- NestJS 11, TS `strict`, `nest-cli`, ESLint (flat) + Prettier
- `ConfigModule` global, `ThrottlerModule`, `helmet`, `ValidationPipe` globale
  (`whitelist` + `forbidNonWhitelisted` + `transform`)
- `TypeOrmModule.forRootAsync` partageant `config/data-source.ts` avec la CLI de
  migrations ; `synchronize: false`
- `docker-compose.yml` (Postgres 16 + healthcheck), `.env.example`

**common/**
- `paginated.dto` (query + enveloppe), guards `jwt-auth` (global) et `roles`,
  decorators `@Public()` / `@Roles()` / `@CurrentUser()`
- middleware `request-id` + `logging` interceptor, `AllExceptionsFilter`

**Modules**
- `health` : `GET /health` public
- `users` : entity `User` (uuid, email unique, `password_hash`, role enum,
  `created_at`), service
- `token` : émission/vérif JWT access + refresh
- `auth` : `register` / `login` / `refresh`, hash bcrypt, stratégie passport-jwt

**Migration**
- `InitUsers` : extension `uuid-ossp`, enum `users_role_enum`, table `users`

**Doc & tests**
- Swagger sur `/docs`, `CLAUDE.md` (conventions + écarts), `README.md`
- 9 specs de service (auth, users)

## Test plan

- `pnpm build` ✅ · `pnpm lint` ✅ · `pnpm test` ✅ (9/9)
- `docker compose up -d` + `pnpm migration:run` ✅
- Flow live vérifié : `/health` 200 · register/login/refresh → tokens · login
  mauvais mdp 401 · register doublon 409 · validation mdp court 400 · `/docs` 200

## Points d'attention

- **Écarts assumés vs `instruction.md`** (documentés dans `CLAUDE.md`) :
  polyrepo au lieu de monorepo (§2), Git Flow allégé au lieu de GitHub Flow (§7),
  refresh token **stateless** (signature JWT, non stocké) — rotation/révocation à
  ajouter si besoin de sécurité accru.
- Le guard JWT global n'est pas exercé en live faute de route protégée en
  Phase 0 ; il le sera en Phase 1 (`meals`).
- Tag `v0.1.0` à poser après la Phase 1 (le tag couvre Phases 0+1, cf. §9).
