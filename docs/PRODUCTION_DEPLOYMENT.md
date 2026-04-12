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

## Deploy Without a Domain

1. Copy `.env.prod.example` to `.env.prod`.
2. Replace the placeholder secrets and IP address values.
3. Build and start:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

4. Verify:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
curl http://YOUR_SERVER_IP/
curl http://YOUR_SERVER_IP/api/schema/
```

## Notes

- The app is configured to run over plain HTTP by IP first.
- When a domain is added later, update:
  - `PUBLIC_ORIGIN`
  - `ALLOWED_HOSTS`
  - `CORS_ALLOWED_ORIGINS`
  - `CSRF_TRUSTED_ORIGINS`
  - `NEXT_PUBLIC_WS_URL`
  - `NEXT_PUBLIC_WS_HOST`
- After adding HTTPS behind Nginx, set:
  - `SESSION_COOKIE_SECURE=True`
  - `CSRF_COOKIE_SECURE=True`
  - `SECURE_SSL_REDIRECT=True`
