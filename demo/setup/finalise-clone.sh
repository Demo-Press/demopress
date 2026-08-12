#!/bin/sh
set -eu
cd /var/www/html

log(){ echo "[DIAG] $*"; }
fail(){ log "ERROR $*"; exit 1; }

wp_safe(){
  timeout -k 2s 45s wp --allow-root --skip-plugins --skip-themes "$@"
}

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
if [ ! -f wp-config.php ]; then
  timeout -k 2s 30s wp config create --allow-root \
    --dbname="$WORDPRESS_DB_NAME" \
    --dbuser="$WORDPRESS_DB_USER" \
    --dbpass="$WORDPRESS_DB_PASSWORD" \
    --dbhost="$WORDPRESS_DB_HOST" \
    --skip-check || fail "wp-config create failed"
fi

# A valid wp-config.php must hand control to wp-settings.php. A partially
# generated/corrupted config can still allow low-level DB commands to work but
# causes normal web requests to reach wp-blog-header.php without wp() defined.
if ! grep -q "wp-settings.php" wp-config.php; then
  log "wp-config.php missing wp-settings bootstrap - repairing"
  cat >> wp-config.php <<'PHP'

/** DemoPress bootstrap repair: load WordPress settings. */
if ( ! defined( 'ABSPATH' ) ) {
    define( 'ABSPATH', __DIR__ . '/' );
}
require_once ABSPATH . 'wp-settings.php';
PHP
fi

if ! grep -q "HTTP_X_FORWARDED_PROTO" wp-config.php; then
  if grep -q "wp-settings.php" wp-config.php; then
    sed -i "/wp-settings.php/i if ( ! empty(\$_SERVER['HTTP_X_FORWARDED_PROTO']) && strpos(\$_SERVER['HTTP_X_FORWARDED_PROTO'], 'https') !== false ) { \$_SERVER['HTTPS'] = 'on'; }" wp-config.php
  else
    fail "wp-config.php has no WordPress bootstrap insertion point"
  fi
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

# Verify a real WordPress bootstrap, not just DB connectivity.
BOOTSTRAP=$(timeout -k 2s 20s wp eval 'echo function_exists("wp") ? "WP_BOOTSTRAP_OK" : "WP_BOOTSTRAP_MISSING";' --allow-root --skip-plugins --skip-themes 2>&1) || fail "WordPress PHP bootstrap failed: $BOOTSTRAP"
echo "$BOOTSTRAP" | grep -q "WP_BOOTSTRAP_OK" || fail "WordPress bootstrap incomplete: $BOOTSTRAP"
log "wordpress-bootstrap wp-function-ok"
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
# The Agent is part of the DemoPress runtime and must be active for the login bridge
# and menu policy enforcement even when it is not a product-required plugin.
wp_safe plugin activate demopress-agent >/dev/null 2>&1 || fail "DemoPress Agent activation failed"
log "END required-components"

log "START demo-role-and-user"
USER="${DEMOPRESS_DEMO_USER:-demo_user}"
PASS="${DEMOPRESS_DEMO_PASSWORD:-demo_password}"
export DEMOPRESS_DEMO_USER="$USER" DEMOPRESS_DEMO_PASSWORD="$PASS"
mkdir -p /tmp/demopress
cat > /tmp/demopress/apply-access.php <<'PHP'
<?php
$policy=get_option('demopress_demo_access',[]);
if(!is_array($policy))$policy=[];
$base=sanitize_key($policy['base_role']??'administrator');
$base_role=get_role($base);
if(!$base_role){$base='administrator';$base_role=get_role('administrator');}
if(!$base_role){fwrite(STDERR,"No usable WordPress baseline role found\n");exit(2);}

$caps=[];
foreach((array)$base_role->capabilities as $cap=>$allowed){if($allowed)$caps[$cap]=true;}
$blocked=[
  'activate_plugins','deactivate_plugins','delete_plugins','edit_plugins','install_plugins','update_plugins',
  'switch_themes','delete_themes','edit_themes','install_themes','update_themes',
  'edit_files','edit_users','create_users','delete_users','list_users','promote_users','remove_users',
  'update_core','import','export'
];
foreach($blocked as $cap)unset($caps[$cap]);
$caps['read']=true;
$caps['demopress_demo_user']=true;
remove_role('demopress_demo_admin');
add_role('demopress_demo_admin','DemoPress Demo User',$caps);

$user_login=(string)getenv('DEMOPRESS_DEMO_USER');
$password=(string)getenv('DEMOPRESS_DEMO_PASSWORD');
if($user_login===''||$password===''){fwrite(STDERR,"Demo credentials missing\n");exit(3);}
$user=get_user_by('login',$user_login);
if(!$user){
  $id=wp_create_user($user_login,$password,$user_login.'@example.invalid');
  if(is_wp_error($id)){fwrite(STDERR,$id->get_error_message()."\n");exit(4);}
  $user=get_user_by('id',$id);
}else{
  wp_set_password($password,$user->ID);
}
$user->set_role('demopress_demo_admin');
update_user_meta($user->ID,'demopress_demo_user',1);
update_option('demopress_demo_access_effective_role','demopress_demo_admin',false);
echo 'base='.$base.' role=demopress_demo_admin user='.$user_login."\n";
PHP
ROLE_OUT=$(timeout -k 2s 45s wp eval-file /tmp/demopress/apply-access.php --allow-root --skip-plugins --skip-themes 2>&1) || fail "demo access role creation failed: $ROLE_OUT"
log "demo-access $ROLE_OUT"

# Defense in depth: this MU plugin runs before normal plugins and protects DemoPress
# infrastructure pages plus dangerous platform actions from disposable demo users.
mkdir -p wp-content/mu-plugins
cat > wp-content/mu-plugins/demopress-demo-guard.php <<'PHP'
<?php
/** DemoPress disposable-demo security guard. Generated by finalise-clone.sh. */
if(!defined('ABSPATH'))exit;
function demopress_guard_is_demo_user(){return is_user_logged_in()&&current_user_can('demopress_demo_user');}
add_filter('map_meta_cap',function($caps,$cap,$user_id,$args){
  $user=get_userdata($user_id);
  if(!$user||empty($user->allcaps['demopress_demo_user']))return $caps;
  $blocked=['activate_plugins','deactivate_plugins','delete_plugins','edit_plugins','install_plugins','update_plugins','switch_themes','delete_themes','edit_themes','install_themes','update_themes','edit_files','edit_users','create_users','delete_users','list_users','promote_users','remove_users','update_core','import','export'];
  if(in_array($cap,$blocked,true))return ['do_not_allow'];
  return $caps;
},999,4);
add_action('admin_init',function(){
  if(!demopress_guard_is_demo_user())return;
  global $pagenow;
  $page=isset($_GET['page'])?sanitize_key(wp_unslash($_GET['page'])):'';
  if($page==='demopress-agent')wp_die('DemoPress platform settings are not available in disposable demos.','Access denied',['response'=>403]);
  $blocked_pages=['plugin-install.php','plugins.php','plugin-editor.php','theme-install.php','themes.php','theme-editor.php','update-core.php','users.php','user-new.php','import.php','export.php'];
  if(in_array($pagenow,$blocked_pages,true))wp_die('This platform-level WordPress area is not available in the demo environment.','Access denied',['response'=>403]);
},0);
PHP
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
