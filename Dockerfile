# syntax=docker/dockerfile:1
# Image de prod de l'API PrepaList — multi-stage, pnpm via corepack.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# Dépendances complètes (build a besoin des devDeps : nest CLI, typescript).
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build TS -> dist, puis élagage des devDependencies (typeorm reste : prod dep).
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build
RUN pnpm prune --prod

# Runtime minimal : node + dist + node_modules de prod uniquement.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
RUN corepack enable
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
USER node
# Migrations : NON jouées ici (risque multi-réplicas). Étape release dédiée :
#   docker run --rm <image> pnpm migration:run:prod
CMD ["node", "dist/main"]
