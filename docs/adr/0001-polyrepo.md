# 0001 — Polyrepo

- **Statut** : acceptée, 2026-06-30
- **Source** : commit `283ceca` feat(api): bootstrap phase 0 socle (section « Écarts assumés » de `CLAUDE.md`). Pas de PR : commit initial de la phase 0.

## Contexte

Le cadrage (`../instruction.md`, §2) prévoyait un monorepo avec `apps/api` et un
paquet `packages/shared` pour les types communs. Le front v1 vivait déjà dans son
propre dépôt, `prepalist_front`, refondu sur place en v2. `CLAUDE.md` consigne
l'écart sans autre motif.

## Décision

L'API vit seule dans `prepalist_api`. Pas de `packages/shared` : le front tire ses
types du contrat OpenAPI exporté par l'API.

## Conséquences

- Deux dépôts, deux CI, deux déploiements, chacun déclenché par son propre tag.
- Le contrat entre les deux est `openapi.json`, commité et vérifié par la CI
  (étape « OpenAPI contract is up to date », `.github/workflows/ci.yml`). Une PR qui
  change un contrôleur ou un DTO doit le régénérer.
- Une fonctionnalité qui touche les deux côtés donne deux PR, liées par leurs issues
  (`prepalist_front#28` dans un sujet de commit API, par exemple).
