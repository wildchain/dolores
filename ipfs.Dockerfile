FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY .npmrc package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/ipfs/package.json ./apps/ipfs/

RUN pnpm install --frozen-lockfile

# Copy source
COPY apps/ipfs/ ./apps/ipfs/
COPY tsconfig.json ./

# Build the IPFS node
RUN pnpm --filter ipfs-node build

# ── Runtime image ──────────────────────────────────────────────
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY .npmrc package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/ipfs/package.json ./apps/ipfs/

RUN pnpm install --frozen-lockfile --prod

# Copy built artefacts from builder
COPY --from=builder /app/apps/ipfs/dist ./apps/ipfs/dist

# Create data directory
RUN mkdir -p /app/data/ipfs && chown node:node /app/data/ipfs
USER node

EXPOSE 3002

CMD ["node", "apps/ipfs/dist/index.js"]
