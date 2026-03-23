FROM nginx:1.25-alpine

# Install gettext for envsubst command
RUN apk add --no-cache gettext

# Copy nginx configuration files
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/conf.d/*.template /etc/nginx/conf.d/
COPY nginx/snippets/ /etc/nginx/snippets/

# Copy website files
COPY index.html /usr/share/nginx/html/
COPY imprint.html /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY script.js /usr/share/nginx/html/
COPY robots.txt /usr/share/nginx/html/
COPY sitemap.xml /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose ports
EXPOSE 80 443

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]
