# nweber.me Setup Guide

## Summary

Your portfolio is now running in Docker on port 8081. Your main nginx (on ports 80/443) will handle SSL and proxy requests to the portfolio.

## Current Status

✅ Portfolio running on `http://localhost:8081`
✅ Docker container auto-restarts
✅ IPv6 support enabled
⏳ DNS configuration (add missing record)
⏳ Main nginx reverse proxy setup
⏳ SSL certificates via Let's Encrypt

## Step 1: Update DNS at Namecheap

Add this missing AAAA record:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| AAAA | www | 2a01:4f9:c013:4d24::1 | Automatic |

Your complete DNS configuration should be:
- A Record @ → 77.42.80.97
- A Record www → 77.42.80.97
- AAAA Record @ → 2a01:4f9:c013:4d24::1
- **AAAA Record www → 2a01:4f9:c013:4d24::1** (add this)

## Step 2: Configure Main Nginx

Add the reverse proxy configuration to your main nginx:

```bash
# Copy the configuration
sudo cp /root/my_website/nginx-reverse-proxy.conf /etc/nginx/sites-available/nweber.me

# Enable the site
sudo ln -s /etc/nginx/sites-available/nweber.me /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# If test passes, reload nginx
sudo systemctl reload nginx
```

## Step 3: Obtain SSL Certificates

Use Certbot to get Let's Encrypt certificates:

```bash
# Install certbot if not already installed
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Obtain certificates for both domains
sudo certbot --nginx -d nweber.me -d www.nweber.me --email niklasweber610@gmail.com --agree-tos
```

Certbot will automatically:
- Verify domain ownership via port 80
- Install certificates
- Set up auto-renewal

## Step 4: Verify Everything Works

Test your setup:

```bash
# Test HTTP redirect to HTTPS
curl -I http://nweber.me

# Test www redirect to non-www
curl -I https://www.nweber.me

# Test main site
curl -I https://nweber.me
```

## Managing the Portfolio

### View logs
```bash
cd /root/my_website
docker compose logs -f
```

### Restart
```bash
docker compose restart
```

### Stop
```bash
docker compose down
```

### Update and rebuild
```bash
docker compose up -d --build
```

### View status
```bash
docker compose ps
```

## Architecture

```
Internet (IPv4 + IPv6)
         ↓
    nweber.me / www.nweber.me
         ↓
   Main Nginx (ports 80/443)
   - Handles SSL/TLS
   - Redirects www → non-www
   - Redirects HTTP → HTTPS
         ↓
   Reverse Proxy
         ↓
   Portfolio Container (port 8081)
   - Serves static files
   - Cache headers
   - Security headers
```

## Troubleshooting

### Portfolio not responding
```bash
# Check if container is running
docker ps --filter "name=portfolio"

# Check logs
docker compose logs nginx

# Restart container
docker compose restart
```

### Main nginx issues
```bash
# Check nginx status
sudo systemctl status nginx

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Test configuration
sudo nginx -t
```

### SSL certificate issues
```bash
# Check certificate status
sudo certbot certificates

# Renew certificates manually
sudo certbot renew

# Check renewal timer
sudo systemctl status certbot.timer
```

## File Locations

- Portfolio files: `/root/my_website/`
- Docker container: `portfolio-nginx`
- Container logs: `/root/my_website/nginx/logs/`
- Main nginx config: `/etc/nginx/sites-available/nweber.me`
- SSL certificates: `/etc/letsencrypt/live/nweber.me/`

## DNS Propagation

After updating DNS at Namecheap, it may take up to 48 hours for changes to propagate globally. Check propagation status:

```bash
# Check A record
dig nweber.me A
dig www.nweber.me A

# Check AAAA record
dig nweber.me AAAA
dig www.nweber.me AAAA
```

## Next Steps

1. ✅ Add missing AAAA record at Namecheap
2. ✅ Configure main nginx with reverse proxy
3. ✅ Obtain SSL certificates with Certbot
4. ✅ Test the site: https://nweber.me

Your portfolio will be live at **https://nweber.me** once these steps are complete!
