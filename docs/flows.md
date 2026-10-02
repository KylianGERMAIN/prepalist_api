# Flux

## Auth

Access token 15 min, refresh token 7 jours, signés avec deux secrets distincts
(`src/modules/token/token.service.ts`, `TokenService.issueTokens`). Le refresh n'est pas stocké en base
([ADR 0003](adr/0003-refresh-token-stateless.md)). Côté front, la durée de vie des
cookies suit celle des JWT : le proxy considère qu'un cookie access présent est
valide (`prepalist_front/src/lib/cookies.ts`, `ACCESS_MAX_AGE` et `REFRESH_MAX_AGE`).

### Login

```mermaid
sequenceDiagram
    autonumber
    actor U as Navigateur
    participant F as Front Next (Vercel)
    participant A as API Nest (Render)
    participant DB as Neon

    U->>F: POST /api/auth/login (email, mot de passe)
    F->>A: POST /auth/login
    Note over A: @Public, throttle 5 req/min
    A->>DB: SELECT users WHERE email = email normalisé
    A->>A: bcrypt.compare(password, password_hash), si le compte existe
    alt compte trouvé et mot de passe correct
        A->>A: issueTokens, payload sub, email, role
        A-->>F: 200 accessToken + refreshToken
        F-->>U: cookies httpOnly pl_access (15 min) et pl_refresh (7 j)
    else compte inconnu ou mot de passe faux
        A-->>F: 401 Identifiants invalides
        F-->>U: 401 et message
    end
```

### Refresh

Déclenché par `proxy.ts` quand le cookie access a expiré mais que le refresh est
encore là.

```mermaid
sequenceDiagram
    autonumber
    actor U as Navigateur
    participant P as proxy.ts (Vercel)
    participant A as API Nest (Render)
    participant DB as Neon

    U->>P: GET page protégée, sans pl_access
    P->>A: POST /auth/refresh (refreshToken)
    A->>A: verifyRefresh, signature et exp avec JWT_REFRESH_SECRET
    alt signature invalide ou token expiré
        A-->>P: 401 Refresh token invalide ou expiré
        P-->>U: redirection /login
    else token valide
        A->>DB: SELECT users WHERE id = sub
        alt compte existant
            A-->>P: 200 nouvelle paire
            P-->>U: page demandée, cookies réécrits
        else compte supprimé
            A-->>P: 401 Refresh token invalide ou expiré
            P-->>U: redirection /login
        end
    end
```

Le compte est relu à chaque refresh (`src/modules/auth/auth.service.ts`, `AuthService.refresh`) :
le rôle porté par le nouveau JWT est celui de la base, d'où la promotion
`ADMIN_EMAILS` visible au refresh suivant.

### 401 sur un appel métier

```mermaid
sequenceDiagram
    autonumber
    participant S as Server Component ou Action
    participant A as API Nest (Render)
    participant L as /api/auth/logout (Vercel)

    S->>A: GET /plan, Authorization Bearer access
    A->>A: JwtAuthGuard, passport-jwt avec JWT_ACCESS_SECRET
    alt JWT valide
        A-->>S: 200
    else JWT absent, invalide ou expiré
        A-->>S: 401
        S->>L: redirect, middleware handle401 de serverApi
        L-->>S: cookies effacés, redirection /login
    end
```

L'API ne relit pas le compte sur une requête authentifiée : `JwtStrategy.validate`
recopie le payload (`src/modules/auth/strategies/jwt.strategy.ts`). Un compte
supprimé passe donc le guard tant que son access token n'a pas expiré.

## Plan vers liste de courses

Les items `DERIVED` sont recalculés depuis les créneaux dans la transaction qui
modifie le plan, sous un verrou `SELECT ... FOR UPDATE` sur la ligne `plans`
(`lockPlan`, `src/modules/shopping-list/derived-items.ts`). Écrivent sous ce
verrou : `PlanService.generate`, `updateSlot`, `moveSlot` et `clearSlots`
(`src/modules/plan/plan.service.ts`), ainsi que toute écriture sur un item de la
liste. Côté recettes (`src/modules/meals/meals.service.ts`) :

- `MealsService.update` fait `save(meal)` avant de prendre le moindre verrou ; seule
  la réconciliation des plans concernés (`reconcilePlans`) passe sous verrou, plan
  par plan ;
- `MealsService.remove` verrouille d'abord tous les plans qui utilisent le repas,
  puis supprime et réconcilie.

### Réconciliation après une écriture sur le plan

```mermaid
sequenceDiagram
    autonumber
    participant F as Front
    participant PS as PlanService
    participant R as derived-items.ts
    participant DB as Neon

    F->>PS: PATCH /plan/slots/:slotId (mealId, servings, away, alsoNext)
    PS->>DB: BEGIN
    PS->>R: lockPlan(planId)
    R->>DB: SELECT plans FOR UPDATE
    PS->>DB: UPDATE plan_slots
    PS->>R: reconcileDerived(planId)
    R->>DB: créneaux du plan avec repas et ingrédients
    R->>DB: items DERIVED du plan, tombstones comprises
    R->>R: computeDerived, somme de quantity x servings par (ingredient, unit)
    R->>R: diffDerived contre l'existant, par clé (ingredient, unit)
    R->>DB: DELETE clés sorties du plan
    R->>DB: UPDATE quantités changées
    R->>DB: INSERT clés nouvelles, checked et dismissed à false
    PS->>DB: COMMIT
    PS-->>F: 200 plan
```

Règles de `diffDerived` (`src/modules/shopping-list/derived-items.ts`) :

- une coche survit, sauf si la quantité augmente sur un item coché : il est alors
  décoché et, s'il était `dismissed`, il revient dans la liste ;
- le nom n'est jamais réécrit, il a pu être édité à la main ;
- les items `MANUAL` ne sont jamais lus ni touchés.

`PlanService.moveSlot` prend le verrou mais ne réconcilie pas : mêmes repas, mêmes
portions. `PlanService.clearSlots` supprime tous les `DERIVED`, tombstones
comprises, et garde les `MANUAL`.

### Suppression d'un item, tombstone et /sync

```mermaid
sequenceDiagram
    autonumber
    participant F as Front
    participant SL as ShoppingListService
    participant R as derived-items.ts
    participant DB as Neon

    F->>SL: DELETE /plan/shopping-list/items/:itemId
    SL->>DB: BEGIN, lockPlan, relecture de l'item
    alt source DERIVED
        SL->>DB: UPDATE dismissed = true
        Note over DB: tombstone, masquée en lecture, garde sa clé
    else source MANUAL
        SL->>DB: DELETE
    end
    SL->>DB: COMMIT
    SL-->>F: 204

    Note over F,DB: plus tard, une écriture sur le plan réconcilie sans restoreDismissed, la tombstone reste masquée

    F->>SL: POST /plan/shopping-list/sync
    SL->>DB: BEGIN
    SL->>R: lockPlan puis reconcileDerived(restoreDismissed true)
    R->>DB: UPDATE dismissed = false sur les clés encore dans le plan
    SL->>DB: COMMIT
    SL-->>F: 200 liste, dismissedCount = 0
```

La lecture (`GET /plan/shopping-list`) filtre `dismissed = false` et renvoie
`dismissedCount`, ce qui permet au front de proposer le `/sync`
(`ShoppingListService.read`). La suppression multiple et le vidage suivent la même
règle : tombstone pour un `DERIVED`, suppression pour un `MANUAL`
(`ShoppingListService.discard`).

## Déploiement

```mermaid
sequenceDiagram
    autonumber
    actor D as Développeur
    participant GH as GitHub
    participant W as Actions deploy.yml
    participant R as Render
    participant DB as Neon

    D->>D: npm version patch ou minor, bump package.json et tag vX.Y.Z
    D->>GH: git push --follow-tags
    GH->>W: push sur un tag v*
    W->>R: curl -fsSL -X POST secret RENDER_DEPLOY_HOOK
    R->>R: build de l'image depuis le Dockerfile multi-stage
    R->>R: Docker Command pnpm start:migrate
    R->>DB: migration:run:prod sur dist/
    alt migrations OK
        R->>R: node dist/main
        R->>R: health check GET /health
    else une migration échoue
        R->>R: start:migrate s'arrête avant node dist/main, l'API ne démarre pas
    end
```

- L'auto-deploy natif de Render est désactivé : seul un tag déploie
  (`.github/workflows/deploy.yml`, déclencheur `on.push.tags`).
- Le champ Docker Command de Render ne passe pas par un shell, d'où le script
  `start:migrate` qui porte le `&&` (`deploy/README.md`, section Render).
- Le front suit le même schéma avec un Deploy Hook Vercel, dans son propre dépôt.
