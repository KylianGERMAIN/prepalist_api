# 0007 — `/health` en liveness, sans base

- **Statut** : acceptée, 2026-07-29 (publiée en v0.3.1). Remplace la sonde base ajoutée par la PR #1.
- **Source** : commit `afeed64` fix(health): drop the database probe from the health check, release `a89b326` chore(release): v0.3.1. Sonde d'origine : PR #1, commit `3788348` chore(api): v1 hardening.

## Contexte

`/health` exécutait un `SELECT 1` et répondait 503 si la base tombait. C'est aussi
la route qu'un keep-alive externe pingue pour éviter la mise en veille de Render
Free. Chaque ping réveillait la compute Neon, dont l'autosuspend ne se déclenchait
plus : le quota compute du tier Free a été épuisé, ce qui a bloqué les déploiements.

## Décision

`/health` est une liveness pure : ni `DataSource`, ni I/O. Elle renvoie `status`,
`uptime`, `timestamp` et `version` (`src/modules/health/health.controller.ts:22-31`).

## Conséquences

- Une base indisponible ne fait pas passer le health check Render au rouge.
- Aucune requête base ne doit être ajoutée sur une route pinguée.
- Une readiness, si un orchestrateur en a besoin un jour, ira sur une route à part.
