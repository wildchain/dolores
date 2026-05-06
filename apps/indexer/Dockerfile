FROM node:20-slim

# RocksDB native build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/indexer/ ./apps/indexer/

# Install dependencies (including native builds)
RUN pnpm install --no-frozen-lockfile

# Build workspace packages first so their type declarations are available
RUN pnpm --filter @dolores/shared run build
RUN pnpm --filter @dolores/database run build
RUN pnpm --filter @dolores/solana-utils run build
RUN pnpm --filter @dolores/contracts run build

# Build indexer using a Docker-specific tsconfig (no composite/project references)
RUN cd /app/apps/indexer && npx tsc -p tsconfig.docker.json

# Rewrite @dolores/* internal path aliases to relative paths in compiled output
RUN node /app/apps/indexer/fix-aliases.js

# Verify build output exists
RUN ls /app/apps/indexer/dist/main.js

WORKDIR /app/apps/indexer

EXPOSE 3001

CMD ["node", "dist/main.js"]
