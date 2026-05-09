FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.12.4 --activate

WORKDIR /app

# Copy manifests only first (better layer caching)
COPY .npmrc pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json        ./packages/shared/
COPY packages/database/package.json      ./packages/database/
COPY packages/contracts/package.json     ./packages/contracts/
COPY packages/solana-utils/package.json  ./packages/solana-utils/
COPY apps/api/package.json               ./apps/api/
COPY apps/agents/package.json            ./apps/agents/
COPY apps/client/package.json            ./apps/client/
COPY apps/ipfs/package.json              ./apps/ipfs/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY tsconfig.json ./

# Build workspace packages first, then the API
RUN pnpm --filter @dolores/shared build
RUN pnpm --filter @dolores/database build
RUN pnpm --filter @dolores/contracts build
RUN pnpm --filter @dolores/solana-utils build
RUN pnpm --filter api build

# ── Runtime image ──────────────────────────────────────────────
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@10.12.4 --activate

WORKDIR /app
RUN chown node:node /app
USER node

COPY --chown=node:node .npmrc pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY --chown=node:node packages/shared/package.json        ./packages/shared/
COPY --chown=node:node packages/database/package.json      ./packages/database/
COPY --chown=node:node packages/contracts/package.json     ./packages/contracts/
COPY --chown=node:node packages/solana-utils/package.json  ./packages/solana-utils/
COPY --chown=node:node apps/api/package.json               ./apps/api/
COPY --chown=node:node apps/agents/package.json            ./apps/agents/
COPY --chown=node:node apps/client/package.json            ./apps/client/
COPY --chown=node:node apps/ipfs/package.json              ./apps/ipfs/

RUN pnpm install --frozen-lockfile --prod

# Copy built artefacts from builder
COPY --chown=node:node --from=builder /app/packages/shared/dist       ./packages/shared/dist
COPY --chown=node:node --from=builder /app/packages/database/dist     ./packages/database/dist
COPY --chown=node:node --from=builder /app/packages/contracts/dist    ./packages/contracts/dist
COPY --chown=node:node --from=builder /app/packages/solana-utils/dist ./packages/solana-utils/dist
COPY --chown=node:node --from=builder /app/apps/api/dist              ./apps/api/dist

# Optional: bake in .env for local Docker usage (exclude via .dockerignore in prod)
COPY --chown=node:node apps/api/.env ./.env

EXPOSE 8545

CMD ["node", "apps/api/dist/main.js"]