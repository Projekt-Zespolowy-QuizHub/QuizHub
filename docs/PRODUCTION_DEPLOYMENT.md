# Production Deployment

This repository did not include a complete production `docker-compose` setup. Use the files added for production deployment:

- `docker-compose.prod.yml`
- `.env.prod.example`

## Actual Environment Variables

The code currently reads these backend variables from `backend/quizarena/settings.py`:

- `DJANGO_SECRET_KEY`
- `DEBUG`
- `ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `DB_ENGINE`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `REDIS_URL`
- `GEMINI_API_KEY`
- `STATIC_ROOT`
- `MEDIA_ROOT`
- `SESSION_COOKIE_SECURE`
- `CSRF_COOKIE_SECURE`
- `SECURE_SSL_REDIRECT`

The frontend currently reads:

- `BACKEND_INTERNAL_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL`
- `NEXT_PUBLIC_WS_HOST`

## Deploy With a Domain and HTTPS

1. Copy `.env.prod.example` to `.env.prod`.
2. Replace the placeholder secrets and domain values.
3. Point both `quizhub.tech` and `www.quizhub.tech` to the server IP.
4. Install Certbot on the host and create the challenge webroot:

```bash
sudo apt-get update
sudo apt-get install -y certbot
sudo mkdir -p /var/www/certbot
```

5. Issue the certificate on the host before enabling the TLS Nginx config:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml stop nginx
sudo certbot certonly --standalone \
  -d quizhub.tech \
  -d www.quizhub.tech \
  -m you@example.com \
  --agree-tos \
  --no-eff-email
```

6. Build and start:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

7. Verify:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
curl -I https://quizhub.tech/
curl https://quizhub.tech/api/schema/
```

8. Renew automatically from the host with a post-hook reload:

```bash
sudo certbot renew --post-hook "cd /PATH/TO/REPO && docker compose --env-file .env.prod -f docker-compose.prod.yml restart nginx"
```

## Notes

- Nginx serves ACME challenge files from `/var/www/certbot` mounted from the host.
- Certificates are expected at `/etc/letsencrypt/live/quizhub.tech/`.
- Keep `165.245.212.111` in `ALLOWED_HOSTS` if you still want direct IP access for diagnostics.
