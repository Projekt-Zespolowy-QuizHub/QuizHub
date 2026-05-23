# Production Deployment

This is the production source of truth for `QuizHub`. It describes the real VPS, the real deployment branch, the current production commit, and the exact commands used on the server.

## Production Server

- Host type: VPS
- Hostname: `QuizHub`
- Public domain: `quizhub.tech`
- Public aliases: `www.quizhub.tech`
- Public IPv4: `165.245.212.111`
- Private IPv4: `10.114.0.2`

## Deployment Source of Truth

- Deployment branch: `deployment`
- Current deployment target: `48f1efd9eaeab86732f965d7dd6c519541c015f1`
- Rollback reference for the current release wave: `f8ed926ce56a92807e5d06e25d51566e9e19df3f`
- Rule: after every successful production deploy, update this file with the new production commit, the previous rollback commit, verification date, and operator.

## Current Production State

- Current deployed commit: `f8ed926ce56a92807e5d06e25d51566e9e19df3f`
- Current deployed branch: `deployment`
- Last verified date: `2026-05-23`
- Last operator: `Codex via SSH inspection`
- Migrations included: current production is still on commit `f8ed926`; the pending target `48f1efd` is a newer deployment branch state and has not been deployed yet.

## Server-Specific Values

- SSH target: `root@165.245.212.111`
- Repository path on VPS: `/opt/quizhub-prod`
- Compose project name: `quizhub-prod`
- Environment file on VPS: `/opt/quizhub-prod/.env.prod`
- Compose file on VPS: `/opt/quizhub-prod/docker-compose.prod.yml`
- Secret material such as the root password must stay only in the local ignored supplement: `docs/PRODUCTION_DEPLOYMENT.local.md`

## Actual Environment Variables

The backend reads these variables from `backend/quizarena/settings.py`:

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

The frontend reads:

- `BACKEND_INTERNAL_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL`
- `NEXT_PUBLIC_WS_HOST`

## Deploy With a Domain and HTTPS

1. Log into the VPS and move to the production repo:

```bash
ssh root@165.245.212.111
cd /opt/quizhub-prod
```

2. Prepare `.env.prod` from `.env.prod.example` if it does not already exist, then update secrets and domain values.

3. Make sure both `quizhub.tech` and `www.quizhub.tech` point to `165.245.212.111`.

4. Install Certbot on the host and create the ACME webroot if this is the first HTTPS setup:

```bash
sudo apt-get update
sudo apt-get install -y certbot
sudo mkdir -p /var/www/certbot
```

5. Issue the certificate before enabling TLS if the host does not already have the certificate:

```bash
cd /opt/quizhub-prod
docker compose -p quizhub-prod --env-file .env.prod -f docker-compose.prod.yml stop nginx
sudo certbot certonly --standalone \
  -d quizhub.tech \
  -d www.quizhub.tech \
  -m you@example.com \
  --agree-tos \
  --no-eff-email
```

6. Pull the deployment branch and confirm the expected target commit:

```bash
cd /opt/quizhub-prod
git fetch origin
git checkout deployment
git pull origin deployment
git rev-parse HEAD
```

Expected `HEAD` for the next deploy:

```text
48f1efd9eaeab86732f965d7dd6c519541c015f1
```

7. Build and start production:

```bash
cd /opt/quizhub-prod
docker compose -p quizhub-prod --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

The backend entrypoint runs `python manage.py migrate --noinput` and `python manage.py collectstatic --noinput --clear` automatically at container startup.

## Verification on Server

Use these commands on the VPS to verify the deployment context and runtime state:

```bash
cd /opt/quizhub-prod
pwd
git rev-parse HEAD
git rev-parse --abbrev-ref HEAD
docker compose ls
docker compose -p quizhub-prod --env-file .env.prod -f docker-compose.prod.yml ps
curl -I https://quizhub.tech/
curl -I https://quizhub.tech/healthz
curl https://quizhub.tech/api/schema/
```

The production repo path should be `/opt/quizhub-prod`, the branch should be `deployment`, and `docker compose ls` should show the project `quizhub-prod`.

## Rollback

If the current release wave must be reverted, roll back to `f8ed926ce56a92807e5d06e25d51566e9e19df3f`:

```bash
cd /opt/quizhub-prod
git fetch origin
git checkout f8ed926ce56a92807e5d06e25d51566e9e19df3f
docker compose -p quizhub-prod --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

This leaves the repo in detached `HEAD` state. Before the next normal deploy, switch back to the `deployment` branch and pull from `origin/deployment`.

## Renewal

Renew certificates automatically from the host with a post-hook reload:

```bash
sudo certbot renew --post-hook "cd /opt/quizhub-prod && docker compose -p quizhub-prod --env-file .env.prod -f docker-compose.prod.yml restart nginx"
```

## Notes

- Nginx serves ACME challenge files from `/var/www/certbot` mounted from the host.
- Certificates are expected at `/etc/letsencrypt/live/quizhub.tech/`.
- Keep `165.245.212.111` in `ALLOWED_HOSTS` if direct IP diagnostics are still needed.
