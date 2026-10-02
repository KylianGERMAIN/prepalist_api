# 0002 — Git Flow allégé

- **Statut** : acceptée, 2026-06-30
- **Source** : commit `283ceca` feat(api): bootstrap phase 0 socle (section « Écarts assumés » de `CLAUDE.md`). Le squash merge et le numéro d'issue en suffixe sont précisés par la PR #5, commit `836438d` docs: require commit messages in English.

## Contexte

Le cadrage (§7) prévoyait GitHub Flow : tout part de `main` et y revient. Le projet
voulait au contraire séparer ce qui est intégré de ce qui est livré, puisque le
déploiement est déclenché par un tag.

## Décision

- `main` ne reçoit que des releases taguées (`vX.Y.Z`, SemVer).
- `develop` est la branche d'intégration ; les branches de travail en partent.
- Une PR par tâche vers `develop`, en squash merge, titre en Conventional Commits
  terminé par le numéro d'issue : `feat(scope): subject (#12)`.
- Pas de `release/*` ni de `hotfix/*` tant qu'il n'y a pas de versions parallèles.

## Conséquences

- Le titre de PR devient le sujet du commit squashé : le workflow `pr-title.yml`
  le valide.
- La branche par défaut du dépôt est `main` : un `Closes #x` dans une PR mergée sur
  `develop` ne ferme pas l'issue, il faut la fermer à la main.
- Les premières phases ont été mergées en `--no-ff` (commits `Merge ... into
  develop` de l'historique) ; le squash merge s'applique depuis.
