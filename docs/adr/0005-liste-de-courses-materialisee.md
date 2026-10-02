# 0005 — Liste de courses matérialisée

- **Statut** : acceptée, 2026-07-03, mécanisme de réconciliation révisé le 2026-10-02
- **Source** : PR #17, commit `0ba0b78` feat(shopping-list): persist an editable, materialized list with sync (issue #14). Réconciliation actuelle : PR #61, commit `aabeb18` feat(shopping-list): reconcile derived items on every plan change, keep checks (issue #47).

## Contexte

En phase 3, la liste était calculée à la volée depuis les créneaux
(`0d6e214`). Rien ne pouvait donc y être persisté : ni coche, ni article ajouté à la
main, ni suppression.

## Décision

La liste est une table, `shopping_list_items`. Chaque ligne a une origine :
`DERIVED` (calculée depuis les créneaux) ou `MANUAL` (saisie). Les `DERIVED` sont
réconciliés dans la transaction de chaque écriture sur le plan ou sur une recette,
sous verrou de ligne sur le plan, par diff sur la clé `(ingredient_id, unit)`
(`src/modules/shopping-list/derived-items.ts`). Un `DERIVED` supprimé à la main
devient une tombstone `dismissed` ; seul `POST /plan/shopping-list/sync` le ramène.

## Conséquences

- Les coches survivent à une modification du plan, sauf quand la quantité d'un item
  coché augmente.
- `GET /plan/shopping-list` est une lecture pure.
- Toute écriture sur les créneaux doit prendre `lockPlan` puis appeler
  `reconcileDerived` : un chemin qui l'oublie désynchronise la liste.
- Les tombstones occupent leur clé dans l'index unique partiel : changer l'unité d'un
  item doit d'abord supprimer la tombstone de la clé visée
  (`src/modules/shopping-list/shopping-list.service.ts:142-152`).
- Entre `0ba0b78` et `aabeb18`, la synchronisation était explicite (insertion seule,
  puis réécriture complète en PR #43) ; la réconciliation continue la remplace.
