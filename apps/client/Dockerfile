FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/client/ ./apps/client/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build packages first
RUN pnpm --filter @dolores/shared run build
RUN pnpm --filter @dolores/contracts run build

# Build the client
WORKDIR /app/apps/client
RUN pnpm build

# Serve the static export with a simple HTTP server
RUN npm install -g serve

EXPOSE 3000

CMD ["serve", "out", "-l", "3000"]