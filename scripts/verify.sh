#!/bin/sh
set -eu
node --check launcher/src/server.js
node --check launcher/src/provisioner.js
node --check launcher/src/lifecycle.js
node --check launcher/src/snapshots.js
node --check launcher/src/docker.js
php -l demo/wp-content/plugins/demopress-agent/demopress-agent.php 2>/dev/null || true
echo "DemoPress source syntax checks completed."
