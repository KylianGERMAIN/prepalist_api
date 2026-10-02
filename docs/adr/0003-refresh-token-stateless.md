# 0003 — Refresh token stateless

- **Statut** : acceptée, 2026-06-30
- **Source** : commit `283ceca` feat(api): bootstrap phase 0 socle (`TokenService`, section « Écarts assumés » de `CLAUDE.md`). Complétée par `82e7f61` fix(api): address phase-0 review findings (401 et non 404 quand le compte a disparu) et par la PR #1, commit `3788348` chore(api): v1 hardening (throttle 5/min sur `/auth/refresh`).

## Contexte

L'API émet un access token court et un refresh token long. Stocker le refresh en
base permet la rotation et la révocation, au prix d'une table et d'une écriture à
chaque refresh. Le socle de la phase 0 a retenu la version la plus simple, en notant
dans `CLAUDE.md` qu'elle serait à faire évoluer si le besoin de sécurité augmente.

## Décision

Le refresh token est un JWT signé avec `JWT_REFRESH_SECRET`, distinct du secret
d'access, valable 7 jours par défaut. Il n'est pas stocké : `POST /auth/refresh`
vérifie sa signature et son expiration, relit le compte, puis émet une nouvelle
paire (`src/modules/auth/auth.service.ts:32-47`).

## Conséquences

- Aucune révocation possible : un refresh token volé reste valable jusqu'à son
  expiration. Changer `JWT_REFRESH_SECRET` invalide tous les refresh d'un coup.
- Pas de rotation réelle : l'ancien refresh reste valable après usage.
- La déconnexion se limite à effacer les cookies côté front.
- Le compte étant relu au refresh, un changement de rôle ou une suppression prend
  effet au refresh suivant, 15 min au plus.
- À remplacer par une ADR de rotation et révocation si le besoin de sécurité augmente.
