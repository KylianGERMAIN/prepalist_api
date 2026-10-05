# Changelog

Toutes les évolutions notables de l'API PrepaList sont documentées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et le projet respecte le [Semantic Versioning](https://semver.org/lang/fr/).

## [0.6.0] - 2026-10-05

### À lire avant de déployer

- **Ordre : l'API d'abord, le front v0.6.0 juste après.** Le front v0.5.0 envoie des champs que cette API refuse (favori, cuisson), et le front v0.6.0 lit des champs que l'API v0.5.0 n'a pas. Aucun ordre n'est sans casse : la fenêtre entre les deux tags doit rester courte.
- **Rollback.** Redéployer v0.5.0 ne suffit pas : neuf migrations changent le schéma, dont deux qui retirent des colonnes. Prendre une branche Neon juste avant le déploiement, et la restaurer en cas de retour arrière.
- **Après le déploiement de l'API**, lancer `deploy/sql/assign-aisles.sql` en `psql` pour ranger les ingrédients existants par rayon. Le script se termine par `COMMIT` : le relire avant.
- **Nouvelles variables, toutes facultatives** : `ADMIN_EMAILS`, `SENTRY_DSN`.

### Ajouté

- **Rayons** : chaque ingrédient porte un rayon, et la liste de courses est groupée par rayon dans un ordre exposé par l'API.
- **Description libre** sur les repas.
- **Tags** : liste des tags existants, et normalisation (minuscules, espaces) à l'écriture et sur les tags déjà en base.
- **Repas incomplets** : nombre d'ingrédients exposé, et repas sans ingrédient signalés.
- **Planning** :
  - affecter un repas aussi au créneau suivant (`alsoNext`) ;
  - marquer un créneau « dehors », qui ne compte plus dans la liste de courses ;
  - déplacer ou échanger un repas entre deux créneaux, atomiquement.
- **Liste de courses** : suppression groupée et vidage de la liste.
- **Unité par défaut des ingrédients**, remplie à partir des recettes existantes puis tenue à jour à chaque recette enregistrée.
- **`ADMIN_EMAILS`** : les comptes listés sont promus ADMIN au démarrage.

### Modifié

- **Liste de courses réconciliée à chaque changement du planning**, dans la même transaction, en gardant les coches. Un article issu des plats supprimé à la main ne revient que par « Restaurer » (`POST /plan/shopping-list/sync`).
- **Jeu d'unités fermé** (cassant) : une unité hors de la liste rend 400. `Unité` et `u` existants sont convertis en `pièce`.

### Supprimé

- **Favoris** (cassant) : `isFavorite` et le filtre `favorite` rendent 400, la colonne est supprimée.
- **Suivi « cuisiné »** (cassant) : `POST /meals/:id/cooked` rend 404, `timesCooked` et `lastCookedAt` disparaissent, la génération ne tient plus compte de la fraîcheur.

### Interne

- **Observabilité** : logs JSON par requête (pino), `x-request-id` accepté seulement s'il est un UUID, Sentry pour les 5xx.
- **CI** : contrôle de dérive du schéma, seuil de couverture, contrat OpenAPI versionné dans le dépôt, contrôle du titre de PR.
- **Documentation d'architecture** : modèle de données, diagrammes de séquence, ADR, glossaire.
- **e2e** : un seul serveur en écoute par suite, au lieu d'un serveur par requête.

## [0.5.0] - 2026-09-15

### Corrigé

- **Favori, note et historique de cuisson appartiennent au compte** : ces quatre colonnes étaient portées par `meals`, un catalogue partagé par tous les comptes. Marquer un plat « cuisiné » écrivait donc sur la ligne que tous les autres lisent, et biaisait le score de fraîcheur de leur génération de plan. Elles passent dans `user_meal_state`, clé `(user_id, meal_id)`. L'incrément de `times_cooked` se fait en SQL, deux cuissons concurrentes ne s'écrasent plus.

### Ajouté

- **`PATCH /meals/:id/state`** : favori et note du compte appelant, ouvert à tous les comptes — contrairement à `PATCH /meals/:id`, qui reste réservé à l'admin puisqu'il modifie la recette.

### Modifié

- **`rating` et `isFavorite` sortent du corps de `POST /meals` et `PATCH /meals/:id`** (cassant) : la validation étant stricte, les envoyer rend désormais 400 au lieu d'être ignoré. Ils passent par `PATCH /meals/:id/state`.
- **Migration destructrice** : l'historique de cuisson, les favoris et les notes existants sont fusionnés sur le plus ancien compte ADMIN. `POST /meals/:id/cooked` ayant toujours été ouvert à tout compte authentifié, l'état antérieur n'est pas attribuable à son auteur ; celui des autres comptes est perdu.

- **Profondeur de relation déclarée par site d'appel** : le chargement des relations du plan n'est plus eager. Chaque appel demande ce dont il a besoin, la liste de courses seule chargeant les ingrédients.

### Sécurité

- **`POST /ingredients` réservé à l'admin** (cassant) : la route alimentait le catalogue commun d'ingrédients sans garde de rôle. Les comptes standard reçoivent désormais 403.
- **Swagger coupé en production** : `/docs` et `/docs-json` publiaient toute la surface de l'API sur une route non authentifiée. Ils ne sont plus montés quand `NODE_ENV` vaut `production`.
- **CORS fermé par défaut en production** (cassant) : un `CORS_ORIGINS` vide retombait sur `origin: true`, qui reflète l'origine appelante, combiné à `credentials: true`. Sans `CORS_ORIGINS`, plus aucune origine n'est autorisée. Sans effet sur le front, qui appelle l'API côté serveur.

### Corrigé

- **Arrondi de l'agrégation de la liste de courses** extrait et couvert par des tests.

### Interne

- **Suite e2e sur une vraie base**, branchée dans la CI.
- **Index et noms de contrainte existants déclarés dans les entités**, pour que le schéma généré corresponde à celui de la base.

## [0.4.0] - 2026-08-05

### Modifié

- **Planning unique par utilisateur, plus de recherche par date** (cassant) : le planning n'est plus identifié par sa date de début. Il existe un plan par utilisateur, créé vide au premier accès, dont les créneaux sont ordonnés par index de jour et non plus par date calendaire. La date devient un repère d'affichage : `startDate` nomme les jours et situe le jour courant, mais rien ne recherche un plan par date. Les routes `/weeks` et `/weeks/:id/*` disparaissent au profit de `/plan/*` sans identifiant, le plan étant résolu depuis le JWT. Les créneaux deviennent symétriques (jour 0 = jour de courses, déjeuner inclus), ce qui retire les cas particuliers à l'ajout d'un jour. L'appartenance des items de liste de courses est vérifiée par une jointure unique, sans chargement eager.
- **Migration destructrice** : les plannings et listes de courses existants sont perdus. Les utilisateurs, plats, ingrédients et associations plat-ingrédient sont intacts.
- **`shoppingDay` n'agit plus rétroactivement** : changer son jour de courses ne redéfinit plus les bornes d'un planning existant, il ancre la date de départ du prochain plan.
- **Le vidage du planning ne supprime que les items dérivés** de la liste de courses. Les items ajoutés à la main n'ont jamais été déduits des plats, rien dans le plan ne justifie de les faire expirer.

### Supprimé

- **Rappel hebdomadaire (cron)** : sa livraison n'était qu'une couture loguée, et son test « pas encore planifié » n'a plus de sens depuis que le plan est toujours créé à la volée. `@nestjs/schedule` sort des dépendances.

### Corrigé

- **500 à la modification des ingrédients d'un plat enregistré** : Postgres refusait `UPDATE meal_ingredients SET meal_id = NULL` sur une colonne `NOT NULL`. `orphanedRowAction: 'delete'` était posé sur le `@OneToMany` alors que TypeORM le lit sur la relation inverse — l'option paraissait traitée tout en ne faisant rien. La création et la modification rechargent aussi le plat après écriture, pour ne plus omettre l'ingrédient imbriqué que le `GET` renvoie.
- **500 sur deux premiers accès concurrents** : `GET /plan` et `GET /plan/shopping-list`, rendus par deux composants serveur distincts, pouvaient créer le plan simultanément ; le perdant heurtait la contrainte d'unicité, remontée en 500 faute d'être une exception HTTP. Même défaut sur l'initialisation paresseuse de la liste de courses. La violation d'unicité est désormais absorbée et l'enregistrement gagnant relu.
- **Vidage partiel du planning** : les trois écritures du vidage étaient indépendantes ; un échec laissait les créneaux vides avec les items dérivés survivants, état dont l'initialisation paresseuse ne pouvait pas se remettre puisqu'elle exige une liste vide. Elles tiennent maintenant dans une seule transaction.

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
