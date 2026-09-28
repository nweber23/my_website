# --- Build: Vite bundles the site into dist/ -------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Serve: static files behind nginx ---------------------------------------
FROM nginx:1.25-alpine

# Install gettext for envsubst command
RUN apk add --no-cache gettext

# Copy nginx configuration files
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/conf.d/*.template /etc/nginx/conf.d/
COPY nginx/snippets/ /etc/nginx/snippets/

# Copy the built website
COPY --from=build /app/dist/ /usr/share/nginx/html/

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose ports
EXPOSE 80 443

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]
