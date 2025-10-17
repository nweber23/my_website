# Multi-stage build for optimized production image
FROM node:18-alpine AS base

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init curl

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S portfolio -u 1001

# Development stage
FROM base AS development
ENV NODE_ENV=development

# Copy package files
COPY package*.json ./

# Install deps (use ci if lockfile exists, otherwise install)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source code
COPY . .

# Change ownership to non-root user
RUN chown -R portfolio:nodejs /app
USER portfolio

# Expose port
EXPOSE 3000

# Development command
CMD ["dumb-init", "npm", "run", "dev"]

# Production build stage
FROM base AS build

# Copy package files
COPY package*.json ./

# Install deps for building (ci if lockfile exists)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source code
COPY . .

# Production stage
FROM base AS production
ENV NODE_ENV=production

# Copy package files
COPY package*.json ./

# Install only production deps (fallback if no lockfile)
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi && npm cache clean --force

# Copy built application
COPY --from=build /app .

# Create logs directory
RUN mkdir -p /app/logs

# Change ownership to non-root user
RUN chown -R portfolio:nodejs /app
USER portfolio

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Production command
CMD ["dumb-init", "node", "server.js"]