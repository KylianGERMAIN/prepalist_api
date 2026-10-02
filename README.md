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
pnpm start:dev                # http://localhost:3000  ·  Swagger sur /docs (hors prod)
```

## Scripts

| Commande | Effet |
| --- | --- |
| `pnpm start:dev` | API en watch |
| `pnpm build` | compilation TS → `dist/` |
| `pnpm lint` | ESLint + Prettier (fix) |
| `pnpm test` | specs Jest, sans base |
| `pnpm test:e2e` | tests d'intégration sur la base `prepalist_test`, créée et migrée automatiquement (Postgres doit tourner ; `DB_PORT=<port>` si 5432 est pris) |
| `pnpm migration:generate src/migrations/<Nom>` | génère une migration depuis les entities |
| `pnpm migration:run` / `pnpm migration:revert` | applique / annule |

## Comptes administrateurs

Le CRUD du catalogue (`meals`, `ingredients`) est réservé au rôle `ADMIN` ;
`/auth/register` crée toujours un `USER`, même pour un email listé : l'inscription
ne prouve pas que l'email appartient à celui qui le saisit. Pour promouvoir un
compte sans SQL, **dans cet ordre** :

1. s'inscrire, et vérifier qu'on se connecte bien avec ce compte ;
2. ajouter son email à `ADMIN_EMAILS` (séparés par des virgules, casse ignorée) ;
3. redémarrer l'API (sur Render : *Manual Deploy*) — les comptes `USER` listés
   sont promus au démarrage.

Le rôle vit dans le JWT : la promotion d'un compte déjà connecté prend effet au
prochain refresh (15 min max) ou login. Retirer un email de la liste ne
rétrograde pas le compte : repasser `role = 'USER'` en base.

## État

- **Phase 0** — socle : config, health, users, auth (register / login / refresh JWT), CI.
- **Phase 1** — meals + ingredients : entities `Meal` / `Ingredient` / `MealIngredient`,
  CRUD `meals` (filtres tag/name/incomplete, note par compte, `ingredientCount`),
  catalogue `ingredients` (recherche ILike).
- **Phase 2** — plan de repas : `Plan` / `PlanSlot`, un seul plan par utilisateur
  créé à la volée sur `GET /plan` (`dayCount` jours × midi/soir), créneaux rangés
  par `dayIndex` et non par date. `POST /plan/generate` (génération pondérée
  par la note + règle des restes), `PATCH /plan/slots/:slotId` (`alsoNext`
  recopie le créneau sur le suivant),
  `DELETE /plan/slots` (vide les créneaux et les items dérivés, réancre
  `startDate` sur le jour de courses).
- **Phase 3** — liste de courses : `GET /plan/shopping-list`, table matérialisée
  `shopping_list_items`, items dérivés réconciliés à chaque écriture sur le plan
  (coches conservées), `POST /plan/shopping-list/sync` pour ramener les dérivés
  supprimés à la main, CRUD des items par `itemId`, suppression multiple et vidage.

Phase 4 (capture IA) écartée volontairement. Phase 5 (rappel hebdo par cron)
retirée : la livraison n'était qu'un log, et « pas encore planifié » n'a plus de
sens depuis que le plan est créé automatiquement.

## Déploiement

Image Docker multi-stage (`Dockerfile`), CI build+push sur `ghcr.io` à chaque tag `vX.Y.Z`
(`.github/workflows/release.yml`). Stack prod (front + api + Caddy, Postgres managé externe)
et procédure complète : voir [`deploy/`](./deploy/README.md). Migrations prod :
`pnpm migration:run:prod` (sur `dist/` compilé). Variables prod : cf. `deploy/.env.prod.example`.
