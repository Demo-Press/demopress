#!/bin/bash
set -euo pipefail
cd /var/www/html

ms(){ date +%s%3N; }

run_step(){
  local name="$1" timeout_seconds="$2"; shift 2
  local start end elapsed rc
  start="$(ms)"
  echo "[DIAG] START ${name}"
  if timeout --foreground "${timeout_seconds}s" "$@"; then
    end="$(ms)"; elapsed=$((end-start))
    echo "[DIAG] END ${name} ${elapsed}ms"
    return 0
  fi
  rc=$?; end="$(ms)"; elapsed=$((end-start))
  if [ "$rc" -eq 124 ]; then
    echo "[DIAG] TIMEOUT ${name} after ${elapsed}ms"
  else
    echo "[DIAG] ERROR ${name} exit=${rc} after ${elapsed}ms"
  fi
  return "$rc"
}

echo "[DIAG] finaliser-start $(date -Iseconds)"

echo "[DIAG] START db-check"
S="$(ms)"; READY=0
for i in $(seq 1 60); do
  if timeout --foreground 8s wp db check --allow-root >/dev/null 2>&1; then READY=1; break; fi
  sleep 1
done
E="$(ms)"
if [ "$READY" -ne 1 ]; then echo "[DIAG] TIMEOUT db-check after $((E-S))ms"; exit 124; fi
echo "[DIAG] END db-check $((E-S))ms"

if [ -f /snapshot/content.tar.gz ]; then
  run_step "product-content-extract" 90 \
    sh -c 'mkdir -p wp-content/plugins wp-content/themes && tar -xzf /snapshot/content.tar.gz -C wp-content && chown -R www-data:www-data wp-content/plugins wp-content/themes'
else
  echo "[DIAG] SKIP product-content-extract"
fi


if [ -f /snapshot/uploads.tar.gz ]; then
  run_step "uploads-extract" 60 sh -c 'mkdir -p wp-content/uploads && tar -xzf /snapshot/uploads.tar.gz -C wp-content/uploads && chown -R www-data:www-data wp-content/uploads'
else
  echo "[DIAG] SKIP uploads-extract"
fi

run_step "search-replace" 90 \
  wp search-replace "$TEMPLATE_URL" "$WORDPRESS_URL" --all-tables --precise --quiet --allow-root

echo "[DIAG] START required-components"
S="$(ms)"
timeout --foreground 30s wp eval '
require_once ABSPATH . "wp-admin/includes/plugin.php";
$required=json_decode(getenv("DEMOPRESS_REQUIRED_PLUGINS") ?: "[]",true) ?: [];
foreach($required as $plugin){
  if(!is_plugin_active($plugin)){
    fwrite(STDERR,"[DIAG] ERROR required-components plugin-not-active={$plugin}\n");
    exit(10);
  }
}
$required_theme=getenv("DEMOPRESS_REQUIRED_THEME") ?: "";
if($required_theme && wp_get_theme()->get_stylesheet() !== $required_theme){
  fwrite(STDERR,"[DIAG] ERROR required-components active-theme=".wp_get_theme()->get_stylesheet()."\n");
  exit(11);
}
update_option("demopress_mode","demo");
update_option("demopress_launcher_url",getenv("DEMOPRESS_LAUNCHER_URL") ?: "");
update_option("demopress_product_name",getenv("DEMOPRESS_PRODUCT_NAME") ?: "WordPress Demo");
echo "[DIAG] required-components-ok\n";
' --allow-root
E="$(ms)"
echo "[DIAG] END required-components $((E-S))ms"

run_step "demo-role-and-user" 45 wp eval-file /setup/personalise.php --allow-root
run_step "rewrite-flush" 25 wp rewrite flush --hard --allow-root || true

echo "[DIAG] finaliser-end $(date -Iseconds)"
echo "DEMO CLONE READY"
