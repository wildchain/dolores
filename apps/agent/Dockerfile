FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/agent/ ./apps/agent/
# Agent imports IDL from cli at runtime
COPY apps/cli/src/idl/ ./apps/cli/src/idl/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build workspace packages first, then the agent
RUN pnpm --filter @dolores/contracts run build
RUN pnpm --filter @dolores/shared run build
RUN pnpm --filter @dolores/solana-utils run build
RUN pnpm --filter @dolores/agent run build

WORKDIR /app/apps/agent

CMD ["node", "dist/index.js"]
