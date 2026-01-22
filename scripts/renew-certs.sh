#!/bin/bash

# renew-certs.sh
# Manually renew Let's Encrypt SSL certificates

set -e

echo "=== Manual Certificate Renewal ==="
echo ""

# Check if docker-compose is running
if ! docker-compose ps | grep -q "Up"; then
    echo "Error: Services are not running. Start them with:"
    echo "  docker-compose up -d"
    exit 1
fi

echo "Attempting to renew certificates..."
docker-compose run --rm certbot renew

echo ""
echo "Reloading nginx to apply renewed certificates..."
docker-compose exec nginx nginx -s reload

echo ""
echo "Certificate renewal complete!"
echo ""
echo "To verify the next renewal date:"
echo "  docker-compose run --rm certbot certificates"
