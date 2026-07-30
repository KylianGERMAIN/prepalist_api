# Changelog

Toutes les évolutions notables de l'API PrepaList sont documentées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et le projet respecte le [Semantic Versioning](https://semver.org/lang/fr/).

## [Non publié]

### Modifié

- **BREAKING — le planning n'est plus identifié par sa date.** `weeks` / `week_slots` deviennent `plans` / `plan_slots` : un seul plan par utilisateur (`UNIQUE (user_id)`), créé à la volée au premier `GET /plan`, dont les créneaux sont rangés par `day_index` au lieu d'une date calendaire. `start_date` subsiste comme simple ancre d'affichage — il libelle les jours et situe le jour courant, mais plus rien ne cherche ni ne crée un plan par date. Les créneaux deviennent symétriques : `day_count` jours × (midi, soir), jour 0 = jour de courses, midi inclus.
- **BREAKING — les routes perdent leur identifiant de semaine.** `GET /weeks/current`, `GET /weeks?startDate=`, `POST /weeks`, `POST /weeks/:id/generate`, `PATCH /weeks/:id/slots/:slotId` et toutes les routes `/weeks/:id/shopping-list/*` sont remplacées par leurs équivalents sous `/plan`, sans `:id` : le plan est une ressource singleton résolue depuis le JWT.
- **BREAKING — perte des données de planification.** La migration supprime et recrée `weeks`, `week_slots` et `shopping_list_items` : les plannings et listes de courses existants sont perdus. `users`, `meals`, `meal_ingredients` et `ingredients` ne sont pas touchés. À passer entre deux cycles de courses, pas au milieu.
- **`shoppingDay` ne redéfinit plus rétroactivement les bornes d'un plan existant.** Il ancre le `start_date` du prochain plan créé, et le réancrage a lieu au vidage (`DELETE /plan/slots`). Changer le réglage n'orpheline donc plus rien — ce qui ferme le défaut où déplacer le jour de courses rendait la semaine en cours inatteignable.

### Ajouté

- **`DELETE /plan/slots`** : vide tous les créneaux, supprime les items dérivés de la liste de courses et réancre `start_date`. Les items ajoutés à la main sont conservés.

### Corrigé

- **Appartenance des items de liste vérifiée en une requête** : la jointure sur `plan.user_id` remplace le chargement complet du plan et de ses relations eager.
- **Index, contraintes d'unicité et clés étrangères déclarés dans les entités** pour les trois tables recréées, afin que `migration:generate` ne propose plus de les renommer.

### Retiré

- **Cron de rappel hebdo** (`@nestjs/schedule`, dimanche 18h) : la livraison n'était qu'une ligne de log, et sa définition de « semaine non planifiée » n'a plus de sens depuis que le plan est créé automatiquement.

## [0.3.1] - 2026-07-29

### Corrigé

- **`/health` ne requête plus la base** : la sonde de readiness (`SELECT 1`) réveillait le compute Neon à chaque ping du keep-alive, épuisant le quota d'heures de calcul du plan gratuit et bloquant les déploiements. `/health` devient un liveness pur (`status`, `uptime`, `timestamp`, `version`), sans accès Postgres. Le champ `database` disparaît de la réponse, l'endpoint ne renvoie plus 503.

## [0.3.0] - 2026-07-03

### Ajouté

- **Jour de courses configurable** : chaque utilisateur choisit le jour qui borne sa semaine de planification (`shoppingDay`, endpoints `GET`/`PATCH /users/me`). La semaine démarre à ce jour au lieu d'un lundi figé, et `GET /weeks?startDate=` retourne la semaine contenant une date donnée.
- **Liste de courses persistée et éditable** : la liste passe d'un calcul dérivé à la volée à une table matérialisée (`shopping_list_items`). Le cochage persiste, on ajoute des items manuels, et les items dérivés des plats ne sont ajoutés que par une synchronisation explicite (`POST /weeks/:id/shopping-list/sync`) qui complète la liste sans écraser ce qu'on a modifié. CRUD par `itemId`.
- **Version de l'API dans `/health`** : la réponse expose la version courante.

## [0.2.1] - 2026-07-02

### Corrigé

- **Build Docker de production** : `pnpm prune --prod` rejouait le script `prepare` (husky) après suppression des devDependencies, cassant le build (`husky: not found`). Ajout de `--ignore-scripts` sur l'étape de prune.

## [0.2.0] - 2026-07-02

### Modifié

- **Repas globaux** : le catalogue de repas est désormais partagé (plus de rattachement à un propriétaire). Lecture ouverte à tous les utilisateurs authentifiés.

### Sécurité

- **RBAC sur les repas** : création, modification et suppression réservées aux administrateurs (`RolesGuard` + `@Roles`). Les utilisateurs standard ont un accès en lecture seule.

## [0.1.0] - 2026-07-01

Première version de l'API PrepaList v2 (NestJS + TypeORM + PostgreSQL).

### Ajouté

- **Authentification** : inscription et connexion, JWT access + refresh (refresh stateless, vérifié par signature).
- **Repas & ingrédients** : CRUD des repas avec lignes d'ingrédients, recherche, favoris, tags, marquage « cuisiné ». Ingrédients dédupliqués (unicité insensible à la casse).
- **Planification hebdomadaire** : semaines avec créneaux midi/soir sur 7 jours, assignation de repas et portions, génération automatique. Ancrage des semaines sur le fuseau Europe/Paris.
- **Liste de courses** : agrégation des ingrédients d'une semaine par unité.
- **Notifications** : rappels (canal de livraison à définir, actuellement journalisé).
- **Documentation** : OpenAPI / Swagger sur `/docs`, schémas de réponse sur tous les endpoints.
- **Sécurité** : helmet, CORS configurable, rate limiting (throttler, dont `/auth/refresh`), validation stricte des DTO.
- **Exploitation** : health check `/health` avec vérification de la base, validation fail-fast des variables d'environnement au démarrage, migrations jouées en production, image Docker multi-stage.
- **Déploiement** : cible Neon (Postgres managé) + Render, déclenché sur tag de version.

[0.3.1]: https://github.com/KylianGERMAIN/prepalist_api/releases/tag/v0.3.1
[0.3.0]: https://github.com/KylianGERMAIN/prepalist_api/releases/tag/v0.3.0
[0.2.1]: https://github.com/KylianGERMAIN/prepalist_api/releases/tag/v0.2.1
[0.2.0]: https://github.com/KylianGERMAIN/prepalist_api/releases/tag/v0.2.0
[0.1.0]: https://github.com/KylianGERMAIN/prepalist_api/releases/tag/v0.1.0
