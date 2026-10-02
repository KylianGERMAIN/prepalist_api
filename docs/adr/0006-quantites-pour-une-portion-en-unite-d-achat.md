# 0006 — Quantités pour une portion, en unité d'achat

- **Statut** : acceptée, 2026-10-02
- **Source** : `0d6e214` feat(shopping-list): aggregate weekly shopping list (quantité × portions) et PR #43 `fc4fbfa` feat(units): close the unit set and rewrite derived items on sync (unité d'achat). Confirmée par l'issue #21, fermée en not planned le 2026-10-02 ; aucun commit n'écrit la règle « une portion », elle découle du calcul.

## Contexte

Une recette doit produire une liste de courses utilisable en magasin. Deux questions :
pour combien de personnes sont saisies les quantités, et dans quelle unité.

## Décision

- `meal_ingredients.quantity` est pour une portion. La liste multiplie par les
  portions du créneau : `mi.quantity * slot.servings`
  (`computeDerived`). `meals` n'a pas de colonne de
  portions.
- L'unité est celle de l'achat, pas de la recette : `tranche` de jambon plutôt que
  40 g (`Unit`, `src/common/unit.ts`). Le jeu est fermé, en enum Postgres `unit_enum`.
- Les fractions sont permises (`0,5` oignon) : `quantity` est un `numeric`.

## Conséquences

- Un plat mangé sur deux créneaux, comme les restes, compte deux fois ses
  portions : c'est voulu, compter une seule fois ferait sous-acheter (issue #21).
- Un même ingrédient saisi dans deux unités produit deux lignes, la clé de la liste
  étant `(ingredient_id, unit)` : il n'y a aucune conversion d'unités.
- Ajouter une unité demande une migration écrite à la main (`CLAUDE.md`).
