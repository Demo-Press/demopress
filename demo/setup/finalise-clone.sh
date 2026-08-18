#!/bin/sh
set -eu
cd /var/www/html

log(){ echo "[DIAG] $*"; }
fail(){ log "ERROR $*"; exit 1; }
wp_safe(){ timeout -k 2s 45s wp --allow-root --skip-plugins --skip-themes "$@"; }

log "finaliser-start $(date -Iseconds)"
log "START wordpress-files"
ready=0
for i in $(seq 1 30); do
  if [ -f wp-settings.php ] && [ -f wp-load.php ] && [ -f wp-includes/functions.php ]; then ready=1; break; fi
  sleep 1
done
[ "$ready" -eq 1 ] || fail "wordpress-files timeout or incomplete WordPress core"
log "END wordpress-files"

log "START wordpress-config"
if [ -f wp-config.php ]; then
  log "wp-config.php already exists; using existing configuration"
else
  log "wp-config.php not present; creating configuration"
  if timeout -k 2s 30s wp config create --allow-root --dbname="$WORDPRESS_DB_NAME" --dbuser="$WORDPRESS_DB_USER" --dbpass="$WORDPRESS_DB_PASSWORD" --dbhost="$WORDPRESS_DB_HOST" --skip-check; then
    log "wp-config.php created by clone finaliser"
  elif [ -f wp-config.php ]; then
    # The official WordPress Docker entrypoint can create wp-config.php between
    # our existence check and `wp config create`. Treat that as a successful
    # hand-off rather than failing an otherwise healthy clone.
    log "wp-config.php appeared during creation; using Docker-generated configuration"
  else
    fail "wp-config create failed"
  fi
fi
[ -s wp-config.php ] || fail "wp-config.php missing or empty after configuration stage"
PREFIX="${WORDPRESS_TABLE_PREFIX:-}"
if [ -z "$PREFIX" ] && [ -f /snapshot/database.sql ]; then PREFIX=$(sed -n 's/^CREATE TABLE `\([^`]*\)options`.*/\1/p' /snapshot/database.sql | head -1 || true); fi
[ -n "$PREFIX" ] || PREFIX="wp_"
CURRENT_PREFIX=$(timeout -k 2s 15s wp config get table_prefix --allow-root 2>/dev/null || true)
if [ -z "$CURRENT_PREFIX" ] || [ "$CURRENT_PREFIX" != "$PREFIX" ]; then
  log "wp-config.php table prefix '${CURRENT_PREFIX:-<empty>}' -> '$PREFIX'"
  timeout -k 2s 20s wp config set table_prefix "$PREFIX" --type=variable --allow-root >/dev/null || fail "unable to set WordPress table prefix"
fi
CHECK_PREFIX=$(timeout -k 2s 15s wp config get table_prefix --allow-root 2>/dev/null || true)
[ -n "$CHECK_PREFIX" ] || fail "WordPress table prefix is still empty after repair"
log "wordpress-config table-prefix=$CHECK_PREFIX"
if ! grep -q "wp-settings.php" wp-config.php; then
  log "wp-config.php missing wp-settings bootstrap - repairing"
  cat >> wp-config.php <<'PHP'

/** DemoPress bootstrap repair: load WordPress settings. */
if ( ! defined( 'ABSPATH' ) ) { define( 'ABSPATH', __DIR__ . '/' ); }
require_once ABSPATH . 'wp-settings.php';
PHP
fi
if ! grep -q "HTTP_X_FORWARDED_PROTO" wp-config.php; then
  sed -i "/wp-settings.php/i if ( ! empty(\$_SERVER['HTTP_X_FORWARDED_PROTO']) && strpos(\$_SERVER['HTTP_X_FORWARDED_PROTO'], 'https') !== false ) { \$_SERVER['HTTPS'] = 'on'; }" wp-config.php
fi
log "END wordpress-config"

log "START wordpress-bootstrap"
db_ok=0
for i in $(seq 1 30); do
  if timeout -k 1s 8s wp db check --allow-root >/dev/null 2>&1; then db_ok=1; break; fi
  [ "$i" -eq 1 ] || [ $((i % 5)) -eq 0 ] && log "wordpress-bootstrap waiting attempt=$i"
  sleep 1
done
[ "$db_ok" -eq 1 ] || fail "wordpress-bootstrap database check timeout"
BOOTSTRAP=$(timeout -k 2s 20s wp eval 'echo function_exists("wp") ? "WP_BOOTSTRAP_OK" : "WP_BOOTSTRAP_MISSING";' --allow-root --skip-plugins --skip-themes 2>&1) || fail "WordPress PHP bootstrap failed: $BOOTSTRAP"
echo "$BOOTSTRAP" | grep -q "WP_BOOTSTRAP_OK" || fail "WordPress bootstrap incomplete: $BOOTSTRAP"
log "wordpress-bootstrap wp-function-ok"
log "END wordpress-bootstrap"

if [ -f /snapshot/content.tar.gz ]; then log "START product-content-extract"; timeout -k 2s 60s tar -xzf /snapshot/content.tar.gz -C /var/www/html/wp-content || fail "product-content-extract failed"; log "END product-content-extract"; else log "SKIP product-content-extract"; fi
if [ -f /snapshot/uploads.tar.gz ]; then log "START uploads-extract"; mkdir -p wp-content/uploads; timeout -k 2s 60s tar -xzf /snapshot/uploads.tar.gz -C wp-content/uploads || fail "uploads-extract failed"; log "END uploads-extract"; else log "SKIP uploads-extract"; fi

log "START search-replace"
OLD=$(wp_safe option get home 2>/dev/null || true)
NEW="${DEMOPRESS_DEMO_URL:-}"
if [ -n "$OLD" ] && [ -n "$NEW" ] && [ "$OLD" != "$NEW" ]; then wp_safe search-replace "$OLD" "$NEW" --all-tables --precise --skip-columns=guid >/dev/null || fail "search-replace failed"; fi
log "END search-replace"

log "START required-components"
if [ -n "${DEMOPRESS_REQUIRED_THEME:-}" ]; then wp_safe theme activate "$DEMOPRESS_REQUIRED_THEME" >/dev/null || fail "required theme activation failed: $DEMOPRESS_REQUIRED_THEME"; fi
IFS=','
for p in ${DEMOPRESS_REQUIRED_PLUGINS:-}; do
  [ -n "$p" ] || continue
  slug=$(echo "$p" | cut -d/ -f1)
  wp_safe plugin activate "$slug" >/dev/null 2>&1 || true
  wp_safe plugin is-active "$slug" >/dev/null 2>&1 || fail "required plugin inactive: $p"
done
unset IFS
wp_safe plugin activate demopress-agent >/dev/null 2>&1 || fail "DemoPress Agent activation failed"
log "END required-components"

log "START demo-role-and-user"
USER="${DEMOPRESS_DEMO_USER:-demo_user}"
PASS="${DEMOPRESS_DEMO_PASSWORD:-demo_password}"
export DEMOPRESS_DEMO_USER="$USER" DEMOPRESS_DEMO_PASSWORD="$PASS"
ROLE_OUT=$(timeout -k 2s 45s wp eval-file /usr/local/share/demopress/personalise.php --allow-root --skip-plugins --skip-themes 2>&1) || fail "demo access role creation failed: $ROLE_OUT"
log "demo-access $ROLE_OUT"

mkdir -p wp-content/mu-plugins
cat > wp-content/mu-plugins/demopress-demo-guard.php <<'PHP'
<?php
if(!defined('ABSPATH'))exit;
function demopress_guard_is_demo_user(){return is_user_logged_in()&&current_user_can('demopress_demo_user');}
function demopress_guard_policy(){$p=get_option('demopress_demo_access',[]);return is_array($p)?$p:[];}
function demopress_guard_blocked_caps(){
  $p=demopress_guard_policy();$caps=['activate_plugins','deactivate_plugins','delete_plugins','edit_plugins','install_plugins','update_plugins','delete_themes','edit_themes','install_themes','update_themes','edit_files','edit_users','create_users','delete_users','list_users','promote_users','remove_users','update_core','import','export'];
  if(empty($p['allow_theme_switching']))$caps[]='switch_themes';return $caps;
}
add_filter('map_meta_cap',function($caps,$cap,$user_id,$args){$user=get_userdata($user_id);if(!$user||empty($user->allcaps['demopress_demo_user']))return $caps;if(in_array($cap,demopress_guard_blocked_caps(),true))return ['do_not_allow'];return $caps;},999,4);
add_action('admin_init',function(){
  if(!demopress_guard_is_demo_user())return;global $pagenow;$page=isset($_GET['page'])?sanitize_key(wp_unslash($_GET['page'])):'';
  if($page==='demopress-agent')wp_die('DemoPress platform settings are not available in disposable demos.','Access denied',['response'=>403]);
  $blocked_pages=['plugin-install.php','plugins.php','plugin-editor.php','theme-install.php','theme-editor.php','update-core.php','users.php','user-new.php','import.php','export.php'];
  if(in_array($pagenow,$blocked_pages,true))wp_die('This platform-level WordPress area is protected in the demo environment.','Access denied',['response'=>403]);
},0);
PHP

cat > wp-content/mu-plugins/demopress-demo-experience.php <<'PHP'
<?php
if(!defined('ABSPATH'))exit;
function demopress_experience_user(){return is_user_logged_in()&&current_user_can('demopress_demo_user');}
function demopress_experience_env($key,$default=''){ $v=getenv($key);return $v===false?$default:(string)$v; }
add_action('after_setup_theme',function(){if(demopress_experience_user()&&demopress_experience_env('DEMOPRESS_TOOLBAR_ENABLED','1')==='1')show_admin_bar(true);});
add_action('admin_bar_menu',function($bar){if(!demopress_experience_user()||demopress_experience_env('DEMOPRESS_TOOLBAR_ENABLED','1')!=='1')return;$bar->add_node(['id'=>'demopress-demo','title'=>'DemoPress Demo','href'=>home_url('/')]);$expires=(int)demopress_experience_env('DEMOPRESS_EXPIRES_AT','0');if($expires&&demopress_experience_env('DEMOPRESS_SHOW_REMAINING','1')==='1')$bar->add_node(['parent'=>'demopress-demo','id'=>'demopress-remaining','title'=>'Temporary demo · expires '.wp_date('H:i',$expires),'href'=>false]);$docs=esc_url_raw(demopress_experience_env('DEMOPRESS_DOCS_URL'));if($docs)$bar->add_node(['parent'=>'demopress-demo','id'=>'demopress-docs','title'=>'Documentation','href'=>$docs,'meta'=>['target'=>'_blank','rel'=>'noopener']]);$cta=esc_url_raw(demopress_experience_env('DEMOPRESS_CTA_URL'));$label=sanitize_text_field(demopress_experience_env('DEMOPRESS_CTA_LABEL'));if($cta)$bar->add_node(['parent'=>'demopress-demo','id'=>'demopress-cta','title'=>$label?:'Product site','href'=>$cta,'meta'=>['target'=>'_blank','rel'=>'noopener']]);$exit=esc_url_raw(demopress_experience_env('DEMOPRESS_EXIT_URL'));if($exit)$bar->add_node(['parent'=>'demopress-demo','id'=>'demopress-exit','title'=>'Exit Demo','href'=>$exit,'meta'=>['target'=>'_blank','rel'=>'noopener']]);},1000);
add_action('admin_head',function(){if(!demopress_experience_user())return;if(demopress_experience_env('DEMOPRESS_HIDE_NOTICES','0')==='1')echo '<style>.notice:not(.demopress-keep),.update-nag,.updated,.error{display:none!important}</style>';});
PHP
log "END demo-role-and-user"

log "START canonical-urls"
if [ -n "$NEW" ]; then wp_safe option update home "$NEW" >/dev/null || fail "home URL update failed"; wp_safe option update siteurl "$NEW" >/dev/null || fail "siteurl update failed"; fi
log "END canonical-urls"
log "START rewrite-flush"; wp_safe rewrite flush >/dev/null 2>&1 || true; log "END rewrite-flush"
log "START permissions"; chown -R www-data:www-data /var/www/html/wp-content; log "END permissions"
log "finaliser-end $(date -Iseconds)"
echo "DEMO CLONE READY"
