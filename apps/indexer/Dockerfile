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
RUN pnpm install --frozen-lockfile

# Build
RUN pnpm --filter indexer run build

WORKDIR /app/apps/indexer

EXPOSE 3001

CMD ["node", "dist/main.js"]