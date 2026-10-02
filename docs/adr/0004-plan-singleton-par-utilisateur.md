# 0004 — Plan singleton par utilisateur

- **Statut** : acceptée, 2026-07-30
- **Source** : PR #30, commit `7121641` refactor(plan): singleton plan keyed by user, drop date-based lookup (issue #29).

## Contexte

Le planning était une semaine identifiée par sa date de début (tables `weeks` et
`week_slots`). Cela imposait de l'arithmétique de dates avec fuseau, deux chemins de
lecture presque identiques, et côté front un état « pas de semaine à cette date ».

## Décision

Un seul plan par compte (`UQ_plans_user`), créé vide au premier accès. Ses créneaux
sont rangés par `day_index`, pas par date. `start_date` n'est qu'une ancre
d'affichage, posée sur le dernier jour de courses et déplacée uniquement par
`DELETE /plan/slots` (`src/modules/plan/plan.service.ts:296-321`). Les routes
perdent leur `:id` : le plan se résout depuis le JWT.

## Conséquences

- Migration destructive : plannings et listes existants perdus
  (`1785400000000-ReplaceWeeksWithSingletonPlan.ts`).
- Pas d'historique des semaines passées. Le jour où il faudra archiver, l'index
  unique devra devenir partiel (commentaire de la migration, ligne 305).
- Le premier accès concurrent est géré : la violation d'unicité est rattrapée et le
  plan gagnant relu (`src/modules/plan/plan.service.ts:88-105`).
- La propriété d'un item de liste se vérifie par jointure sur `plan.userId`.
