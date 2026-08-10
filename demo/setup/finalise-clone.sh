#!/bin/sh
set -eu
cd /var/www/html
log(){ echo "[DIAG] $*"; }
log "finaliser-start $(date -Iseconds)"
for i in $(seq 1 30); do [ -f wp-settings.php ] && break; sleep 1; done
if [ ! -f wp-config.php ]; then
  wp config create --allow-root --dbname="$WORDPRESS_DB_NAME" --dbuser="$WORDPRESS_DB_USER" --dbpass="$WORDPRESS_DB_PASSWORD" --dbhost="$WORDPRESS_DB_HOST" --skip-check
fi
# WordPress must recognise HTTPS when Traefik terminates TLS. Without this,
# wp-admin can canonical-redirect to itself indefinitely behind a reverse proxy.
if ! grep -q "HTTP_X_FORWARDED_PROTO" wp-config.php; then
  sed -i "/require_once ABSPATH/i if ( ! empty(\$_SERVER['HTTP_X_FORWARDED_PROTO']) && strpos(\$_SERVER['HTTP_X_FORWARDED_PROTO'], 'https') !== false ) { \$_SERVER['HTTPS'] = 'on'; }" wp-config.php
fi
for i in $(seq 1 30); do wp db check --allow-root >/dev/null 2>&1 && break; sleep 1; done
[ -f /snapshot/content.tar.gz ] && { log "START product-content-extract"; tar -xzf /snapshot/content.tar.gz -C /var/www/html/wp-content; log "END product-content-extract"; }
[ -f /snapshot/uploads.tar.gz ] && { log "START uploads-extract"; mkdir -p wp-content/uploads; tar -xzf /snapshot/uploads.tar.gz -C wp-content/uploads; log "END uploads-extract"; }
OLD=$(wp option get home --allow-root 2>/dev/null || true); NEW="${DEMOPRESS_DEMO_URL:-}"
if [ -n "$OLD" ] && [ -n "$NEW" ] && [ "$OLD" != "$NEW" ]; then wp search-replace "$OLD" "$NEW" --all-tables --precise --skip-columns=guid --allow-root >/dev/null; fi
if [ -n "${DEMOPRESS_REQUIRED_THEME:-}" ]; then wp theme activate "$DEMOPRESS_REQUIRED_THEME" --allow-root >/dev/null; fi
IFS=','; for p in ${DEMOPRESS_REQUIRED_PLUGINS:-}; do [ -n "$p" ] || continue; slug=$(echo "$p"|cut -d/ -f1); wp plugin activate "$slug" --allow-root >/dev/null 2>&1 || true; wp plugin is-active "$slug" --allow-root >/dev/null || { echo "required plugin inactive: $p"; exit 1; }; done; unset IFS
USER="${DEMOPRESS_DEMO_USER:-demo_user}"; PASS="${DEMOPRESS_DEMO_PASSWORD:-demo_password}"; if wp user get "$USER" --allow-root >/dev/null 2>&1; then wp user update "$USER" --user_pass="$PASS" --role=administrator --allow-root >/dev/null; else wp user create "$USER" "${USER}@example.invalid" --user_pass="$PASS" --role=administrator --allow-root >/dev/null; fi
wp option update home "$NEW" --allow-root >/dev/null; wp option update siteurl "$NEW" --allow-root >/dev/null
wp rewrite flush --allow-root >/dev/null || true
chown -R www-data:www-data /var/www/html/wp-content
log "finaliser-end $(date -Iseconds)"; echo "DEMO CLONE READY"
