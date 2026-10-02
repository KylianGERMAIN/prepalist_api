# 0008 — Réconciliation de la liste à chaque écriture

- **Statut** : acceptée, 2026-10-02. Complète l'[ADR 0005](0005-liste-de-courses-materialisee.md) sans la remplacer.
- **Source** : PR #61, commit `aabeb18` feat(shopping-list): reconcile derived items on every plan change, keep checks (issue #47).

## Contexte

Avec une synchronisation explicite, la liste restait fausse tant que l'utilisateur ne
la relançait pas, et la réécriture complète de la PR #43 perdait coches et
suppressions à chaque synchronisation.

## Décision

- Toute écriture sur les créneaux, ou sur les ingrédients d'une recette planifiée,
  réconcilie les `DERIVED` du plan dans la même transaction, sous verrou de ligne sur
  le plan (`lockPlan`, puis `reconcileDerived`, `src/modules/shopping-list/derived-items.ts`).
- La réconciliation est un diff par clé `(ingredient_id, unit)` (`diffDerived`) :
  les clés sorties du plan sont supprimées, les quantités mises à jour, les nouvelles
  insérées. Une coche survit, sauf si la quantité d'un item coché augmente.
- Un `DERIVED` supprimé à la main devient une tombstone `dismissed` : masqué, gardé
  pour que la réconciliation ne le recrée pas.
- `POST /plan/shopping-list/sync` réconcilie avec `restoreDismissed` et ramène les
  tombstones encore présentes dans le plan.

## Conséquences

- `GET /plan/shopping-list` est une lecture pure ; elle expose `dismissedCount`.
- Un nouveau chemin d'écriture sur les créneaux qui oublie `lockPlan` et
  `reconcileDerived` désynchronise la liste.
- Les tombstones occupent leur clé dans l'index unique partiel : changer l'unité d'un
  item supprime d'abord la tombstone de la clé visée
  (`ShoppingListService.updateItem`).
- Plusieurs plans verrouillés dans une même transaction le sont dans l'ordre de leur
  `id`, pour éviter les deadlocks (`planIdsUsingMeal`).
