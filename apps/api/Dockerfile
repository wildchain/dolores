FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build
RUN pnpm --filter @dolores/api run build

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["node", "dist/main.js"]
