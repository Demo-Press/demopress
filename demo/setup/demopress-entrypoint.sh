#!/bin/sh
set -eu

# The golden template uses a persistent /var/www/html volume. The official
# WordPress image only seeds /usr/src/wordpress on a fresh install, so plugin
# updates baked into a newer DemoPress image would otherwise never reach an
# existing template volume. Sync only DemoPress-owned runtime files here;
# product plugins/themes/content remain entirely under the template owner's
# control.
AGENT_SRC=/usr/src/wordpress/wp-content/plugins/demopress-agent
AGENT_DST=/var/www/html/wp-content/plugins/demopress-agent

if [ -d "$AGENT_SRC" ]; then
  mkdir -p "$AGENT_DST"
  # Remove stale DemoPress Agent files before copying the bundled version, but
  # never touch sibling product plugins.
  find "$AGENT_DST" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
  cp -a "$AGENT_SRC"/. "$AGENT_DST"/
  chown -R www-data:www-data "$AGENT_DST" 2>/dev/null || true
fi

exec docker-entrypoint.sh "$@"
