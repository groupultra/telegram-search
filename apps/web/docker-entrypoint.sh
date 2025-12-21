#!/bin/sh
set -e

# Replace environment variables in nginx config
envsubst '${BACKEND_URL}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Execute the passed command
exec "$@"

