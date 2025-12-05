#!/bin/sh
set -e

: "${BACKEND_URL:=http://127.0.0.1:3000}"

envsubst '${BACKEND_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

nginx

cd apps/server && exec npm run start
