#!/bin/sh
set -eu
cd /var/www/html

log(){ echo "[DIAG] $*"; }
fail(){ log "ERROR $*"; exit 1; }

# Run WP-CLI with a hard per-command timeout and without loading product
# plugins/themes unless the command specifically needs to manipulate them.
wp_safe(){
  timeout -k 2s 45s wp --allow-root --skip-plugins --skip-themes "$@"
}

log "finaliser-start $(date -Iseconds)"

log "START wordpress-files"
ready=0
for i in $(seq 1 30); do
  if [ -f wp-settings.php ]; then ready=1; break; fi
  sleep 1
done
[ "$ready" -eq 1 ] || fail "wordpress-files timeout"
log "END wordpress-files"

log "START wordpress-config"
if [ ! -f wp-config.php ]; then
  timeout -k 2s 30s wp config create --allow-root \
    --dbname="$WORDPRESS_DB_NAME" \
    --dbuser="$WORDPRESS_DB_USER" \
    --dbpass="$WORDPRESS_DB_PASSWORD" \
    --dbhost="$WORDPRESS_DB_HOST" \
    --skip-check || fail "wp-config create failed"
fi

# WordPress must recognise HTTPS when Traefik terminates TLS.
if ! grep -q "HTTP_X_FORWARDED_PROTO" wp-config.php; then
  sed -i "/require_once ABSPATH/i if ( ! empty(\$_SERVER['HTTP_X_FORWARDED_PROTO']) && strpos(\$_SERVER['HTTP_X_FORWARDED_PROTO'], 'https') !== false ) { \$_SERVER['HTTPS'] = 'on'; }" wp-config.php
fi
log "END wordpress-config"

log "START wordpress-bootstrap"
db_ok=0
for i in $(seq 1 30); do
  if timeout -k 1s 8s wp db check --allow-root >/dev/null 2>&1; then
    db_ok=1
    break
  fi
  [ "$i" -eq 1 ] || [ $((i % 5)) -eq 0 ] && log "wordpress-bootstrap waiting attempt=$i"
  sleep 1
done
[ "$db_ok" -eq 1 ] || fail "wordpress-bootstrap database check timeout"
log "END wordpress-bootstrap"

if [ -f /snapshot/content.tar.gz ]; then
  log "START product-content-extract"
  timeout -k 2s 60s tar -xzf /snapshot/content.tar.gz -C /var/www/html/wp-content || fail "product-content-extract failed"
  log "END product-content-extract"
else
  log "SKIP product-content-extract"
fi

if [ -f /snapshot/uploads.tar.gz ]; then
  log "START uploads-extract"
  mkdir -p wp-content/uploads
  timeout -k 2s 60s tar -xzf /snapshot/uploads.tar.gz -C wp-content/uploads || fail "uploads-extract failed"
  log "END uploads-extract"
else
  log "SKIP uploads-extract"
fi

log "START search-replace"
OLD=$(wp_safe option get home 2>/dev/null || true)
NEW="${DEMOPRESS_DEMO_URL:-}"
if [ -n "$OLD" ] && [ -n "$NEW" ] && [ "$OLD" != "$NEW" ]; then
  wp_safe search-replace "$OLD" "$NEW" --all-tables --precise --skip-columns=guid >/dev/null || fail "search-replace failed"
fi
log "END search-replace"

log "START required-components"
if [ -n "${DEMOPRESS_REQUIRED_THEME:-}" ]; then
  wp_safe theme activate "$DEMOPRESS_REQUIRED_THEME" >/dev/null || fail "required theme activation failed: $DEMOPRESS_REQUIRED_THEME"
fi

IFS=','
for p in ${DEMOPRESS_REQUIRED_PLUGINS:-}; do
  [ -n "$p" ] || continue
  slug=$(echo "$p" | cut -d/ -f1)
  wp_safe plugin activate "$slug" >/dev/null 2>&1 || true
  wp_safe plugin is-active "$slug" >/dev/null 2>&1 || fail "required plugin inactive: $p"
done
unset IFS
log "END required-components"

log "START demo-role-and-user"
USER="${DEMOPRESS_DEMO_USER:-demo_user}"
PASS="${DEMOPRESS_DEMO_PASSWORD:-demo_password}"
if wp_safe user get "$USER" >/dev/null 2>&1; then
  wp_safe user update "$USER" --user_pass="$PASS" --role=administrator >/dev/null || fail "demo user update failed"
else
  wp_safe user create "$USER" "${USER}@example.invalid" --user_pass="$PASS" --role=administrator >/dev/null || fail "demo user create failed"
fi
log "END demo-role-and-user"

log "START canonical-urls"
if [ -n "$NEW" ]; then
  wp_safe option update home "$NEW" >/dev/null || fail "home URL update failed"
  wp_safe option update siteurl "$NEW" >/dev/null || fail "siteurl update failed"
fi
log "END canonical-urls"

log "START rewrite-flush"
wp_safe rewrite flush >/dev/null 2>&1 || true
log "END rewrite-flush"

log "START permissions"
chown -R www-data:www-data /var/www/html/wp-content
log "END permissions"

log "finaliser-end $(date -Iseconds)"
echo "DEMO CLONE READY"
