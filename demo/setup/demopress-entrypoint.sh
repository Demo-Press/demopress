#!/bin/sh
set -eu

# Disposable demo containers start with an empty /var/www/html. The golden
# template may use a persistent /var/www/html volume. Always make sure the
# WordPress core tree exists BEFORE creating/updating the Agent directory.
# Creating wp-content first can interfere with the official WordPress image's
# initial copy and leave a partially-seeded installation.
if [ ! -f /var/www/html/wp-settings.php ]; then
  echo "DemoPress: seeding WordPress core into /var/www/html"
  mkdir -p /var/www/html
  cp -a /usr/src/wordpress/. /var/www/html/
  chown -R www-data:www-data /var/www/html 2>/dev/null || true
fi

# The golden template uses a persistent /var/www/html volume. Agent updates
# baked into a newer DemoPress image would otherwise never reach that existing
# volume. Sync only DemoPress-owned Agent files; product plugins, themes,
# uploads and other template content remain untouched.
AGENT_SRC=/usr/src/wordpress/wp-content/plugins/demopress-agent
AGENT_DST=/var/www/html/wp-content/plugins/demopress-agent

if [ -d "$AGENT_SRC" ]; then
  mkdir -p "$AGENT_DST"
  find "$AGENT_DST" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
  cp -a "$AGENT_SRC"/. "$AGENT_DST"/
  chown -R www-data:www-data "$AGENT_DST" 2>/dev/null || true
fi

# Let the upstream WordPress entrypoint handle wp-config.php generation and
# the normal Apache startup after the filesystem is known-good.
exec docker-entrypoint.sh "$@"
