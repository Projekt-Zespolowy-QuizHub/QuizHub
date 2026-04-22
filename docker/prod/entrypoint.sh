#!/bin/sh
set -e

echo "==> Running database migrations..."
python manage.py migrate --noinput

echo "==> Collecting static files..."
python manage.py collectstatic --noinput --clear

echo "==> Starting Daphne ASGI server..."
exec daphne \
    -b 0.0.0.0 \
    -p 8000 \
    --access-log - \
    quizarena.asgi:application
