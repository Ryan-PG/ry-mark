# Ry-Mark self-hosted production image (multi-stage, no runtime dependencies).
#
# The server uses only Node.js built-ins, so the runtime image does not carry
# node_modules. The frontend build runs inside the build stage.

# ---------- Build stage ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY . .
# Full production build: content manifest + frontend + Cloudflare worker.
RUN npm run build
# Compile the self-hosted Node server (TypeScript -> dist-server/).
RUN npm run build:server

# ---------- Runtime stage ----------
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

# Run as a non-root user.
USER node

COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/package.json ./package.json

EXPOSE 8080

# Health check against the public /healthz endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

CMD ["node", "dist-server/server/main.js"]
