FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY docker/prod/nginx/nginx.conf /etc/nginx/nginx.conf

RUN mkdir -p /var/www/static /var/www/media

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/api/schema/ || exit 1
