# Multi-stage production build for SentinelAI

# ---------------------------------------------
# Stage 1: Build the React Dashboard
# ---------------------------------------------
FROM node:20-alpine AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# ---------------------------------------------
# Stage 2: Production Runtime
# ---------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install production server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production

# Copy server application source code
COPY server/ ./server/

# Copy built frontend assets into client/dist for same-origin static serving
COPY --from=client-builder /app/client/dist ./client/dist

# Expose HTTP port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/health || exit 1

# Start the unified SentinelAI server (API + Client SPA)
CMD ["node", "server/src/server.js"]
