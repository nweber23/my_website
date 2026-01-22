#!/bin/sh
set -e

# Substitute environment variables in nginx templates
echo "Substituting DOMAIN_NAME=${DOMAIN_NAME} in nginx configuration templates..."

if [ -f /etc/nginx/conf.d/default.conf.template ]; then
    envsubst '${DOMAIN_NAME}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
    echo "Created /etc/nginx/conf.d/default.conf"
fi

if [ -f /etc/nginx/conf.d/ssl.conf.template ]; then
    envsubst '${DOMAIN_NAME}' < /etc/nginx/conf.d/ssl.conf.template > /etc/nginx/conf.d/ssl.conf
    echo "Created /etc/nginx/conf.d/ssl.conf"
fi

# Remove template files so nginx doesn't try to parse them
rm -f /etc/nginx/conf.d/*.template

echo "Starting nginx..."
# Start nginx in foreground
exec nginx -g 'daemon off;'
