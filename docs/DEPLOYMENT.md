# Docker Deployment Guide with Let's Encrypt SSL

This guide covers deploying the static portfolio website using Docker with automatic SSL certificate management via Let's Encrypt.

## Table of Contents
- [Prerequisites](#prerequisites)
- [DNS Setup](#dns-setup)
- [Initial Setup](#initial-setup)
- [First Deployment](#first-deployment)
- [Verification](#verification)
- [Maintenance](#maintenance)
- [Troubleshooting](#troubleshooting)
- [Security](#security)

## Prerequisites

Before deploying, ensure you have:

1. **Docker & Docker Compose** installed on your server
   ```bash
   # Check installation
   docker --version
   docker-compose --version
   ```

2. **A domain name** with access to DNS management

3. **Server with public IP** accessible from the internet

4. **Open firewall ports**:
   - Port 80 (HTTP) - Required for Let's Encrypt validation
   - Port 443 (HTTPS) - For secure traffic

5. **Minimum 512MB RAM** recommended for running all services

## DNS Setup

Configure your domain's DNS records BEFORE starting deployment:

1. **Create an A record** pointing to your server's public IP:
   ```
   Type: A
   Name: @ (or your subdomain)
   Value: YOUR_SERVER_IP
   TTL: 3600
   ```

2. **Verify DNS propagation**:
   ```bash
   dig +short yourdomain.com
   # Should return your server's IP address
   ```

3. **Wait for propagation** (can take up to 48 hours, usually minutes)

## Initial Setup

### 1. Clone or Navigate to Project

```bash
cd /path/to/my_website
```

### 2. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your domain and email
nano .env
```

Edit the `.env` file:
```bash
# Your actual domain name
DOMAIN_NAME=yourdomain.com

# Email for Let's Encrypt notifications
EMAIL=your-email@example.com

# Use staging for testing (recommended for first try)
STAGING=true
```

**Important**: Start with `STAGING=true` to avoid hitting Let's Encrypt rate limits during testing.

### 3. Review Configuration Files

The deployment uses these key files:
- `docker-compose.yml` - Service orchestration
- `Dockerfile` - nginx container configuration
- `nginx/nginx.conf` - Main nginx configuration
- `nginx/conf.d/*.template` - Server configurations with domain substitution
- `nginx/snippets/*.conf` - Reusable SSL and security settings

## First Deployment

### Step 1: Test with Staging Certificates

Staging certificates allow you to test the setup without hitting production rate limits (50 certificates/week).

```bash
# Ensure STAGING=true in .env
bash scripts/init-letsencrypt.sh
```

The script will:
1. Verify DNS configuration
2. Build Docker images
3. Start nginx
4. Request a staging certificate from Let's Encrypt
5. Configure SSL and restart services

**Expected output**:
```
=== Let's Encrypt SSL Certificate Initialization ===
Domain: yourdomain.com
Email: your-email@example.com
Staging: true

Verifying DNS configuration...
DNS configured: yourdomain.com -> YOUR_IP

Building Docker image...
Starting nginx service...
Requesting SSL certificate from Let's Encrypt...
Using STAGING environment (test certificates)
Certificate successfully created!

=== Setup Complete! ===
Your website is now accessible at:
  https://yourdomain.com

Note: You are using STAGING certificates (not trusted by browsers)
```

### Step 2: Verify Staging Deployment

```bash
# Check services are running
docker-compose ps

# Should show 3 services running:
# - portfolio-nginx
# - portfolio-certbot (exited - this is normal)
# - portfolio-certbot-renewer

# Test HTTPS (will show security warning - expected for staging)
curl -k https://yourdomain.com

# View logs
docker-compose logs -f
```

### Step 3: Switch to Production Certificates

Once staging works correctly:

```bash
# Stop all services
docker-compose down

# Remove staging certificates
sudo rm -rf certbot/conf/*

# Edit .env and remove STAGING variable
nano .env
# Change: STAGING=true
# To: STAGING=
# Or delete the STAGING line entirely

# Run initialization again with production settings
bash scripts/init-letsencrypt.sh
```

### Step 4: Verify Production Deployment

```bash
# Test HTTPS (should work without warnings)
curl https://yourdomain.com

# Check certificate details
docker-compose run --rm certbot certificates

# Expected output shows:
# - Certificate Name: yourdomain.com
# - Domains: yourdomain.com
# - Expiry Date: ~90 days from now
# - Certificate Path: /etc/letsencrypt/live/yourdomain.com/fullchain.pem
```

## Verification

### 1. HTTPS Access

Visit your website in a browser:
```
https://yourdomain.com
```

You should see:
- Padlock icon in address bar
- No security warnings
- Valid SSL certificate

### 2. SSL Security Test

Test your SSL configuration:
```
https://www.ssllabs.com/ssltest/analyze.html?d=yourdomain.com
```

**Expected grade**: A or A+

### 3. HTTP to HTTPS Redirect

```bash
# Should redirect to HTTPS
curl -I http://yourdomain.com
# Look for: HTTP/1.1 301 Moved Permanently
# Location: https://yourdomain.com/
```

### 4. Certificate Auto-Renewal

Test renewal with a dry run:
```bash
docker-compose run --rm certbot renew --dry-run

# Expected output:
# Congratulations, all simulated renewals succeeded
```

### 5. Security Headers

```bash
curl -I https://yourdomain.com

# Should include headers:
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# X-Content-Type-Options: nosniff
# X-Frame-Options: SAMEORIGIN
# X-XSS-Protection: 1; mode=block
```

## Maintenance

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f nginx
docker-compose logs -f certbot-renewer

# Last 100 lines
docker-compose logs --tail=100 nginx
```

### Update Website Content

```bash
# Edit your files (index.html, styles.css, script.js, etc.)
nano index.html

# Rebuild and restart nginx
docker-compose build nginx
docker-compose restart nginx

# Or rebuild from scratch
docker-compose up -d --build
```

### Manual Certificate Renewal

Certificates auto-renew every 12 hours (if within 30 days of expiry). To manually renew:

```bash
bash scripts/renew-certs.sh
```

Or directly:
```bash
docker-compose run --rm certbot renew
docker-compose exec nginx nginx -s reload
```

### Check Certificate Status

```bash
# View certificate details
docker-compose run --rm certbot certificates

# Check expiry date
docker-compose run --rm certbot certificates | grep "Expiry Date"
```

### Update Docker Images

Keep your images up to date:

```bash
# Pull latest images
docker-compose pull

# Rebuild and restart
docker-compose up -d --build
```

### Backup Certificates

**Important**: Back up your certificates regularly to avoid re-issuing if you rebuild.

```bash
# Backup certbot volume
docker run --rm -v portfolio-certbot-conf:/data -v $(pwd):/backup \
  alpine tar czf /backup/certbot-backup-$(date +%Y%m%d).tar.gz /data

# Restore from backup
docker run --rm -v portfolio-certbot-conf:/data -v $(pwd):/backup \
  alpine sh -c "cd /data && tar xzf /backup/certbot-backup-YYYYMMDD.tar.gz --strip 1"
```

### Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (DANGER: deletes certificates!)
docker-compose down -v
```

## Troubleshooting

### Certificate Generation Fails

**Problem**: `Failed to obtain certificate`

**Solutions**:
1. Verify DNS is correctly configured:
   ```bash
   dig +short yourdomain.com
   nslookup yourdomain.com
   ```

2. Check port 80 is accessible:
   ```bash
   # From another machine
   curl http://yourdomain.com/.well-known/acme-challenge/test
   ```

3. Verify firewall allows ports 80 and 443:
   ```bash
   # Check firewall status
   sudo ufw status
   sudo iptables -L
   ```

4. Check certbot logs:
   ```bash
   docker-compose logs certbot
   ```

5. Ensure you're not hitting rate limits (use STAGING=true for testing)

### Nginx Won't Start

**Problem**: `nginx: [emerg] cannot load certificate`

**Solutions**:
1. Check if certificates exist:
   ```bash
   docker-compose run --rm nginx ls -la /etc/letsencrypt/live/
   ```

2. Verify domain name in `.env` matches certificate directory

3. Check nginx configuration:
   ```bash
   docker-compose run --rm nginx nginx -t
   ```

4. Review nginx logs:
   ```bash
   docker-compose logs nginx
   ```

### Assets Not Loading

**Problem**: CSS/JS/images return 404

**Solutions**:
1. Verify file paths in Dockerfile:
   ```bash
   docker-compose run --rm nginx ls -la /usr/share/nginx/html/
   ```

2. Check nginx access logs:
   ```bash
   docker-compose logs nginx | grep "GET"
   ```

3. Verify volume mounts in docker-compose.yml

### Certificate Renewal Failing

**Problem**: Auto-renewal not working

**Solutions**:
1. Test renewal:
   ```bash
   docker-compose run --rm certbot renew --dry-run
   ```

2. Check certbot-renewer is running:
   ```bash
   docker-compose ps certbot-renewer
   ```

3. Verify certbot-renewer logs:
   ```bash
   docker-compose logs certbot-renewer
   ```

4. Ensure nginx is accessible on port 80 for ACME challenges

### Rate Limit Errors

**Problem**: `too many certificates already issued`

**Solutions**:
1. Use staging environment for testing:
   ```bash
   STAGING=true bash scripts/init-letsencrypt.sh
   ```

2. Wait 7 days (rate limit window)

3. Consider using different subdomains if testing multiple times

### Domain Name Not Substituted

**Problem**: Nginx shows `${DOMAIN_NAME}` literally

**Solutions**:
1. Verify `DOMAIN_NAME` is set in `.env`
2. Check docker-compose.yml passes environment variable to nginx
3. Verify entrypoint.sh runs `envsubst` correctly:
   ```bash
   docker-compose exec nginx cat /etc/nginx/conf.d/default.conf
   ```

## Security

### Security Features Implemented

1. **TLS 1.2 and 1.3 only** - No legacy protocols
2. **Strong cipher suites** - Forward secrecy with ECDHE
3. **HSTS header** - Forces HTTPS for 1 year
4. **OCSP stapling** - Fast certificate validation
5. **Security headers**:
   - X-Frame-Options: Prevents clickjacking
   - X-Content-Type-Options: Prevents MIME sniffing
   - X-XSS-Protection: XSS filter
   - Referrer-Policy: Controls referrer information
6. **Read-only volumes** - Website files mounted read-only
7. **Automatic certificate renewal** - No expired certificates

### Additional Security Recommendations

1. **Enable automatic updates**:
   ```bash
   # Setup unattended upgrades (Ubuntu/Debian)
   sudo apt install unattended-upgrades
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```

2. **Setup monitoring** (optional):
   - UptimeRobot: https://uptimerobot.com
   - Pingdom: https://www.pingdom.com
   - SSL certificate monitoring

3. **Regular backups**:
   - Backup certbot volumes (see Maintenance section)
   - Backup website content
   - Store backups off-site

4. **Limit Docker privileges** (if needed):
   ```yaml
   # Add to nginx service in docker-compose.yml
   security_opt:
     - no-new-privileges:true
   cap_drop:
     - ALL
   cap_add:
     - CHOWN
     - SETUID
     - SETGID
   ```

5. **Monitor logs regularly**:
   ```bash
   # Check for unusual access patterns
   docker-compose exec nginx tail -f /var/log/nginx/access.log
   ```

## Advanced Configuration

### Custom Domain (www subdomain)

To support both `example.com` and `www.example.com`:

1. Add DNS A record for www subdomain
2. Update `.env`:
   ```bash
   DOMAIN_NAME=example.com www.example.com
   ```
3. Update nginx templates to use both domains in server_name

### Generate DH Parameters (Enhanced Security)

For stronger DHE cipher security:

```bash
# Generate dhparam (takes 5-10 minutes)
docker-compose run --rm nginx sh -c "openssl dhparam -out /etc/nginx/dhparam.pem 2048"

# Uncomment ssl_dhparam line in nginx/snippets/ssl-params.conf
```

### Enable IPv6

If your server has IPv6:

```bash
# Already enabled in configs with:
listen [::]:80;
listen [::]:443 ssl http2;
```

Add AAAA record in DNS pointing to your IPv6 address.

## Useful Commands

```bash
# View all services status
docker-compose ps

# Restart specific service
docker-compose restart nginx

# View real-time logs
docker-compose logs -f

# Execute command in running container
docker-compose exec nginx sh

# Validate nginx configuration
docker-compose exec nginx nginx -t

# Reload nginx (without restart)
docker-compose exec nginx nginx -s reload

# Check certificate details
docker-compose run --rm certbot certificates

# Force certificate renewal (if needed)
docker-compose run --rm certbot renew --force-renewal

# Clean up stopped containers
docker-compose rm

# Remove all (DANGER: including volumes)
docker-compose down -v
```

## Support Resources

- **Let's Encrypt Docs**: https://letsencrypt.org/docs/
- **Certbot Docs**: https://eff-certbot.readthedocs.io/
- **Nginx Docs**: https://nginx.org/en/docs/
- **Docker Compose Docs**: https://docs.docker.com/compose/
- **SSL Labs Test**: https://www.ssllabs.com/ssltest/

## License

This deployment configuration is part of the portfolio project. Modify as needed for your use case.
