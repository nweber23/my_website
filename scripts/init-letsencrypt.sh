#!/bin/bash

# init-letsencrypt.sh
# Initialize Let's Encrypt SSL certificates for the first time

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Let's Encrypt SSL Certificate Initialization ===${NC}\n"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please copy .env.example to .env and configure your domain settings:"
    echo "  cp .env.example .env"
    echo "  nano .env"
    exit 1
fi

# Load environment variables
source .env

# Validate required variables
if [ -z "$DOMAIN_NAME" ]; then
    echo -e "${RED}Error: DOMAIN_NAME not set in .env file${NC}"
    exit 1
fi

if [ -z "$EMAIL" ]; then
    echo -e "${RED}Error: EMAIL not set in .env file${NC}"
    exit 1
fi

echo "Domain: $DOMAIN_NAME"
echo "Email: $EMAIL"
echo "Staging: ${STAGING:-false}"
echo ""

# Check if certificates already exist
if [ -d "certbot/conf/live/$DOMAIN_NAME" ]; then
    echo -e "${YELLOW}Warning: Certificates already exist for $DOMAIN_NAME${NC}"
    echo "To regenerate certificates, remove the existing ones first:"
    echo "  docker-compose down"
    echo "  sudo rm -rf certbot/conf/live/$DOMAIN_NAME certbot/conf/archive/$DOMAIN_NAME certbot/conf/renewal/$DOMAIN_NAME.conf"
    echo ""
    read -p "Do you want to continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: docker-compose is not installed${NC}"
    exit 1
fi

# Verify DNS is configured
echo -e "${YELLOW}Verifying DNS configuration...${NC}"
DNS_IP=$(dig +short $DOMAIN_NAME | tail -n1)
if [ -z "$DNS_IP" ]; then
    echo -e "${RED}Error: DNS not configured for $DOMAIN_NAME${NC}"
    echo "Please create an A record pointing to your server's IP address"
    exit 1
fi
echo -e "${GREEN}DNS configured: $DOMAIN_NAME -> $DNS_IP${NC}"
echo ""

# Create directories for certbot
echo "Creating certbot directories..."
mkdir -p certbot/conf certbot/www

# Build and start services
echo -e "${YELLOW}Building Docker image...${NC}"
docker-compose build

echo -e "${YELLOW}Starting nginx service...${NC}"
docker-compose up -d nginx

# Wait for nginx to be ready
echo "Waiting for nginx to start..."
sleep 5

# Request certificate
echo -e "${YELLOW}Requesting SSL certificate from Let's Encrypt...${NC}"
if [ ! -z "$STAGING" ]; then
    echo -e "${YELLOW}Using STAGING environment (test certificates)${NC}"
fi

docker-compose run --rm certbot

# Check if certificate was created
if [ -d "certbot/conf/live/$DOMAIN_NAME" ]; then
    echo -e "${GREEN}Certificate successfully created!${NC}"

    # Restart nginx to load SSL configuration
    echo -e "${YELLOW}Reloading nginx with SSL configuration...${NC}"
    docker-compose restart nginx

    # Start certbot-renewer
    echo -e "${YELLOW}Starting certificate auto-renewal service...${NC}"
    docker-compose up -d certbot-renewer

    echo ""
    echo -e "${GREEN}=== Setup Complete! ===${NC}"
    echo ""
    echo "Your website is now accessible at:"
    echo -e "  ${GREEN}https://$DOMAIN_NAME${NC}"
    echo ""

    if [ ! -z "$STAGING" ]; then
        echo -e "${YELLOW}Note: You are using STAGING certificates (not trusted by browsers)${NC}"
        echo "To get production certificates:"
        echo "  1. Stop services: docker-compose down"
        echo "  2. Remove staging certificates: sudo rm -rf certbot/conf/*"
        echo "  3. Edit .env and remove or comment out STAGING variable"
        echo "  4. Run this script again: bash scripts/init-letsencrypt.sh"
    fi

    echo ""
    echo "To verify certificate renewal:"
    echo "  docker-compose run --rm certbot renew --dry-run"
    echo ""
    echo "To view logs:"
    echo "  docker-compose logs -f"

else
    echo -e "${RED}Certificate creation failed!${NC}"
    echo "Check the logs for details:"
    echo "  docker-compose logs certbot"
    exit 1
fi
