# 0005 — Liste de courses matérialisée

- **Statut** : acceptée, 2026-07-03. Complétée par l'[ADR 0008](0008-reconciliation-liste-a-chaque-ecriture.md).
- **Source** : PR #17, commit `0ba0b78` feat(shopping-list): persist an editable, materialized list with sync (issue #14).

## Contexte

En phase 3, la liste était calculée à la volée depuis les créneaux
(`0d6e214`). Rien ne pouvait donc y être persisté : ni coche, ni article ajouté à la
main, ni suppression.

## Décision

La liste est une table, `shopping_list_items`, rattachée au plan. Chaque ligne a une
origine : `DERIVED` (calculée depuis les créneaux) ou `MANUAL` (saisie à la main).
Les `DERIVED` sont uniques par `(plan_id, ingredient_id, unit)`, grâce à un index
unique partiel ; les `MANUAL` ne sont pas contraints.

## Conséquences

- Coches, éditions et articles manuels sont persistés.
- La liste peut diverger du plan : il faut une règle pour tenir les `DERIVED` à jour.
  En PR #17, c'était une synchronisation explicite par insertion seule, réécrite en
  PR #43 ; la règle actuelle est celle de l'ADR 0008.
- Les `MANUAL` ne sont jamais déduits des plats : rien ne les supprime à part
  l'utilisateur.
