<?php
/**
 * Plugin Name: DemoPress Agent
 * Description: Golden-template export, readiness, demo access policy and disposable-demo login bridge for DemoPress.
 * Version: 1.1.0
 * Author: DemoPress
 */
if(!defined('ABSPATH'))exit;
const DEMOPRESS_AGENT_VERSION='1.1.0';

function demopress_mode(){if(defined('DEMOPRESS_MODE'))return (string)DEMOPRESS_MODE;$e=getenv('DEMOPRESS_MODE');return $e?:'template';}
function demopress_template_mode(){return demopress_mode()==='template';}
function demopress_template_domain(){if(defined('DEMOPRESS_TEMPLATE_DOMAIN'))$d=(string)DEMOPRESS_TEMPLATE_DOMAIN;else $d=(string)(getenv('DEMOPRESS_TEMPLATE_DOMAIN')?:'');return strtolower(trim(preg_replace('#^https?://#i','',$d),'/'));}
function demopress_canonical_template_url(){ $d=demopress_template_domain();return $d?'https://'.$d:''; }
function demopress_saved_secret(){return (string)get_option('demopress_agent_secret','');}
function demopress_env_secret(){if(defined('DEMOPRESS_INTERNAL_TEMPLATE_TOKEN'))return (string)DEMOPRESS_INTERNAL_TEMPLATE_TOKEN;return (string)(getenv('INTERNAL_TEMPLATE_TOKEN')?:'');}
function demopress_expected_secret(){return demopress_saved_secret()?:demopress_env_secret();}
function demopress_auth($request){$a=demopress_expected_secret();$b=(string)$request->get_header('X-DemoPress-Template-Token');return $a!==''&&$b!==''&&hash_equals($a,$b);}
function demopress_direct_auth(){ $a=demopress_expected_secret();$b=(string)($_SERVER['HTTP_X_DEMOPRESS_TEMPLATE_TOKEN']??'');return $a!==''&&$b!==''&&hash_equals($a,$b);}
function demopress_sync_template_urls(){if(!demopress_template_mode())return;$url=demopress_canonical_template_url();if(!$url)return;if(get_option('home')!==$url)update_option('home',$url);if(get_option('siteurl')!==$url)update_option('siteurl',$url);}
add_action('init','demopress_sync_template_urls',1);
add_action('admin_init','demopress_sync_template_urls',1);

function demopress_demo_access_policy(){
  $raw=get_option('demopress_demo_access',[]);
  if(!is_array($raw))$raw=[];
  $role=sanitize_key($raw['base_role']??'administrator');
  $restrict=!empty($raw['restrict_menus']);
  $menus=[];
  foreach((array)($raw['allowed_menus']??[]) as $slug){$slug=sanitize_text_field((string)$slug);if($slug!=='')$menus[]=$slug;}
  return ['base_role'=>$role?:'administrator','restrict_menus'=>$restrict,'allowed_menus'=>array_values(array_unique($menus))];
}
function demopress_menu_label($label){return trim(wp_strip_all_tags(preg_replace('/<span[^>]*>.*?<\/span>/i','',(string)$label)));}
function demopress_admin_url_for_menu($slug){
  $slug=(string)$slug;
  if($slug==='index.php')return admin_url();
  if(strpos($slug,'.php')!==false&&strpos($slug,'?')===false)return admin_url($slug);
  if(strpos($slug,'.php?')!==false)return admin_url($slug);
  return admin_url('admin.php?page='.rawurlencode($slug));
}

add_action('admin_menu',function(){add_options_page('DemoPress Agent','DemoPress Agent','manage_options','demopress-agent','demopress_settings_page');});
add_action('admin_init',function(){
  if(!current_user_can('manage_options')||empty($_POST['demopress_agent_save']))return;
  check_admin_referer('demopress_agent_save');

  $action=sanitize_key($_POST['secret_action']??'keep');
  if($action==='clear')delete_option('demopress_agent_secret');
  elseif($action==='generate')update_option('demopress_agent_secret',bin2hex(random_bytes(32)),false);
  elseif($action==='replace'&&!empty($_POST['demopress_agent_secret']))update_option('demopress_agent_secret',sanitize_text_field(wp_unslash($_POST['demopress_agent_secret'])),false);

  $roles=wp_roles()->roles;
  $base=sanitize_key($_POST['demo_base_role']??'administrator');
  if(!isset($roles[$base]))$base='administrator';
  $restrict=!empty($_POST['demo_restrict_menus']);
  $menus=[];
  foreach((array)($_POST['demo_allowed_menus']??[]) as $slug){$slug=sanitize_text_field(wp_unslash($slug));if($slug!=='')$menus[]=$slug;}
  update_option('demopress_demo_access',[
    'base_role'=>$base,
    'restrict_menus'=>$restrict?1:0,
    'allowed_menus'=>array_values(array_unique($menus))
  ],false);

  wp_safe_redirect(admin_url('options-general.php?page=demopress-agent&updated=1'));exit;
});

function demopress_settings_page(){
  if(!current_user_can('manage_options'))return;
  global $menu;
  $saved=demopress_saved_secret();$env=demopress_env_secret();$effective=demopress_expected_secret();$source=$saved?'Saved in WordPress':($env?'Environment / wp-config':'None');$canonical=demopress_canonical_template_url();
  $policy=demopress_demo_access_policy();$roles=wp_roles()->roles;
  $menu_rows=[];
  foreach((array)$menu as $item){
    if(empty($item[2])||strpos((string)$item[2],'separator')===0)continue;
    $slug=(string)$item[2];$label=demopress_menu_label($item[0]??$slug);if($label==='')$label=$slug;
    $menu_rows[$slug]=$label;
  }
  ?>
  <div class="wrap"><h1>DemoPress Agent</h1><p>Agent version <strong><?php echo esc_html(DEMOPRESS_AGENT_VERSION);?></strong></p>
  <?php if(!empty($_GET['updated'])):?><div class="notice notice-success is-dismissible"><p>DemoPress Agent settings saved.</p></div><?php endif;?>
  <table class="widefat striped" style="max-width:900px"><tbody>
    <tr><td><strong>Mode</strong></td><td><?php echo esc_html(demopress_mode());?></td></tr>
    <tr><td><strong>Canonical template</strong></td><td><?php echo $canonical?'<code>'.esc_html($canonical).'</code>':'<span style="color:#b32d2e">Not configured</span>';?></td></tr>
    <tr><td><strong>Secret key</strong></td><td><?php if($effective):?><span style="color:#16803a;font-weight:700">✓ Secret key saved</span><br><code><?php echo esc_html(substr(hash('sha256',$effective),0,12));?>…</code><br><small>Source: <?php echo esc_html($source);?>. The key itself is never displayed.</small><?php else:?><span style="color:#b32d2e;font-weight:700">No secret key configured</span><?php endif;?></td></tr>
    <tr><td><strong>Demo user role</strong></td><td><?php echo esc_html($roles[$policy['base_role']]['name']??$policy['base_role']);?><?php echo $policy['restrict_menus']?' · menu whitelist enabled':' · all permitted menus visible';?></td></tr>
  </tbody></table>

  <form method="post" style="max-width:900px"><?php wp_nonce_field('demopress_agent_save');?><input type="hidden" name="demopress_agent_save" value="1">
    <h2>Secret key</h2>
    <p><label><input type="radio" name="secret_action" value="keep" checked> Keep current key</label></p>
    <p><label><input type="radio" name="secret_action" value="replace"> Replace with: <input type="password" name="demopress_agent_secret" autocomplete="new-password" style="width:420px;max-width:100%"></label></p>
    <p><label><input type="radio" name="secret_action" value="generate"> Generate a new 64-character key</label></p>
    <p><label><input type="radio" name="secret_action" value="clear"> Clear saved WordPress key (environment key, if present, becomes effective)</label></p>
    <p><strong>Recommended:</strong> use the same secret as <code>INTERNAL_TEMPLATE_TOKEN</code> on the launcher. Environment configuration remains supported for automated deployments.</p>

    <hr style="margin:28px 0">
    <h2>Demo user access</h2>
    <p>Choose what the temporary demo user can access. This policy is stored in the golden WordPress database, included in snapshots and automatically applied to every disposable demo.</p>
    <table class="form-table" role="presentation"><tbody>
      <tr><th scope="row"><label for="demo_base_role">Baseline role</label></th><td><select name="demo_base_role" id="demo_base_role">
        <?php foreach($roles as $slug=>$data):?><option value="<?php echo esc_attr($slug);?>" <?php selected($policy['base_role'],$slug);?>><?php echo esc_html($data['name']);?> (<?php echo esc_html($slug);?>)</option><?php endforeach;?>
      </select><p class="description">DemoPress copies this role's capabilities, then always removes plugin/theme installation, code editing, WordPress core updates and user-management capabilities.</p></td></tr>
      <tr><th scope="row">Admin menu</th><td><label><input type="checkbox" name="demo_restrict_menus" value="1" <?php checked($policy['restrict_menus']);?>> Only show and allow the selected top-level admin areas</label><p class="description">Leave this disabled to preserve the current DemoPress behaviour and show every menu permitted by the baseline role.</p></td></tr>
    </tbody></table>

    <div style="border:1px solid #c3c4c7;background:#fff;padding:14px 18px;max-height:420px;overflow:auto">
      <p style="margin-top:0"><strong>Allowed top-level admin areas</strong></p>
      <?php if(!$menu_rows):?><p>No WordPress admin menu items were detected.</p><?php else:?>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px 18px">
        <?php foreach($menu_rows as $slug=>$label):$checked=!$policy['restrict_menus']||in_array($slug,$policy['allowed_menus'],true);?>
          <label><input type="checkbox" name="demo_allowed_menus[]" value="<?php echo esc_attr($slug);?>" <?php checked($checked);?>> <?php echo esc_html($label);?> <code style="font-size:11px"><?php echo esc_html($slug);?></code></label>
        <?php endforeach;?>
        </div>
      <?php endif;?>
    </div>
    <p class="description">Plugin menu items appear here automatically when their plugins are active on the golden template. Configure access after installing and activating the product you want to demonstrate.</p>

    <p class="submit"><button class="button button-primary">Save DemoPress Agent settings</button></p>
  </form></div>
  <?php
}

add_action('admin_notices',function(){if(demopress_template_mode())echo '<div class="notice notice-info"><p><strong>DemoPress Template Site.</strong> Finish your changes, configure demo-user access under Settings → DemoPress Agent, then publish a snapshot from DemoPress Manager.</p></div>';});

/* Enforce the golden-template menu policy only inside disposable demos. */
add_action('admin_menu',function(){
  if(demopress_mode()!=='demo')return;
  $policy=demopress_demo_access_policy();if(!$policy['restrict_menus'])return;
  global $menu;
  foreach((array)$menu as $item){
    $slug=(string)($item[2]??'');
    if($slug===''||strpos($slug,'separator')===0)continue;
    if(!in_array($slug,$policy['allowed_menus'],true))remove_menu_page($slug);
  }
},9999);
add_action('admin_head',function(){
  if(demopress_mode()!=='demo'||!is_admin()||wp_doing_ajax())return;
  if(!current_user_can('demopress_demo_user'))return;
  $policy=demopress_demo_access_policy();if(!$policy['restrict_menus'])return;
  global $parent_file,$pagenow;
  if(in_array($pagenow,['profile.php','admin-ajax.php','admin-post.php'],true))return;
  $parent=(string)($parent_file?:$pagenow);
  if($parent&&in_array($parent,$policy['allowed_menus'],true))return;
  if($pagenow==='admin.php'){
    $page=sanitize_text_field(wp_unslash($_GET['page']??''));
    if($page&&in_array($page,$policy['allowed_menus'],true))return;
  }
  $first=$policy['allowed_menus'][0]??'';
  if($first){wp_safe_redirect(demopress_admin_url_for_menu($first));exit;}
  wp_die('This area is not available in the demo environment.','Demo access restricted',['response'=>403]);
},1);

function demopress_plugins(){require_once ABSPATH.'wp-admin/includes/plugin.php';$a=[];foreach(get_plugins() as $f=>$d)$a[]=['file'=>$f,'name'=>$d['Name']??'','version'=>$d['Version']??'','active'=>is_plugin_active($f)];return $a;}
function demopress_themes(){$a=[];foreach(wp_get_themes() as $s=>$t)$a[]=['slug'=>$s,'name'=>$t->get('Name'),'version'=>$t->get('Version'),'active'=>get_stylesheet()===$s];return $a;}
add_action('rest_api_init',function(){
  register_rest_route('demopress-agent/v1','/status',['methods'=>'GET','permission_callback'=>'demopress_auth','callback'=>function(){
    $policy=demopress_demo_access_policy();$roles=wp_roles()->roles;
    return ['ok'=>true,'agentVersion'=>DEMOPRESS_AGENT_VERSION,'mode'=>demopress_mode(),'secretConfigured'=>demopress_expected_secret()!=='','canonicalTemplate'=>demopress_canonical_template_url(),'wordpress'=>get_bloginfo('version'),'activeTheme'=>get_stylesheet(),'themeVersion'=>wp_get_theme()->get('Version'),'plugins'=>demopress_plugins(),'themes'=>demopress_themes(),'db'=>true,'site'=>home_url('/'),'exportProtocol'=>2,'exportMode'=>'stream','demoAccess'=>['baseRole'=>$policy['base_role'],'baseRoleName'=>$roles[$policy['base_role']]['name']??$policy['base_role'],'restrictMenus'=>$policy['restrict_menus'],'allowedMenus'=>$policy['allowed_menus']]];
  }]);
  register_rest_route('demopress-agent/v1','/ready',['methods'=>'GET','permission_callback'=>'__return_true','callback'=>function(){return ['ready'=>true,'mode'=>demopress_mode(),'wordpress'=>get_bloginfo('version'),'home'=>home_url('/'),'canonicalTemplate'=>demopress_canonical_template_url(),'theme'=>get_stylesheet()];}]);
});

function demopress_headers($type,$name){while(ob_get_level())@ob_end_clean();nocache_headers();header_remove('Content-Type');header('Content-Type: '.$type);header('Content-Disposition: attachment; filename="'.$name.'"');header('X-DemoPress-Export-Protocol: 2');}
function demopress_tmp($n){return trailingslashit(get_temp_dir()).'demopress-'.$n.'-'.wp_generate_password(12,false,false).'.tar.gz';}
function demopress_tar($args){$cmd='tar';foreach($args as $a)$cmd.=' '.escapeshellarg($a);exec($cmd.' 2>&1',$out,$code);if($code!==0)throw new RuntimeException('tar failed: '.implode("\n",$out));}
function demopress_content(){ $f=demopress_tmp('content');demopress_tar(['-czf',$f,'-C',WP_CONTENT_DIR,'--exclude=plugins/demopress-agent','plugins','themes']);return $f;}
function demopress_uploads(){ $u=wp_upload_dir();if(!is_dir($u['basedir']))return null;$entries=array_diff(scandir($u['basedir'])?:[],['.','..']);if(!$entries)return null;$f=demopress_tmp('uploads');demopress_tar(['-czf',$f,'-C',$u['basedir'],'.']);return $f;}
function demopress_stream_db(){global $wpdb;demopress_headers('application/sql; charset=utf-8','database.sql');echo "SET FOREIGN_KEY_CHECKS=0;\n";foreach($wpdb->get_col('SHOW TABLES') as $table){$c=$wpdb->get_row("SHOW CREATE TABLE `$table`",ARRAY_N);if(!$c)continue;echo "DROP TABLE IF EXISTS `$table`;\n{$c[1]};\n";$offset=0;do{$rows=$wpdb->get_results("SELECT * FROM `$table` LIMIT 500 OFFSET ".intval($offset),ARRAY_A);foreach($rows as $row){$vals=array_map(function($v)use($wpdb){return is_null($v)?'NULL':"'".$wpdb->_real_escape($v)."'";},array_values($row));echo "INSERT INTO `$table` VALUES(".implode(',',$vals).");\n";}$offset+=count($rows);}while(count($rows)===500);}echo "SET FOREIGN_KEY_CHECKS=1;\n";}
add_action('template_redirect',function(){if(empty($_GET['demopress_export']))return;$type=sanitize_key(wp_unslash($_GET['demopress_export']));if(!demopress_template_mode()||!demopress_direct_auth()){status_header(401);exit('Unauthorized');}@set_time_limit(0);if($type==='database'){demopress_stream_db();exit;}if($type==='content'||$type==='uploads'){$f=$type==='content'?demopress_content():demopress_uploads();if(!$f){status_header(204);exit;}demopress_headers('application/gzip',$type.'.tar.gz');header('Content-Length: '.filesize($f));readfile($f);@unlink($f);exit;}status_header(400);exit('Unknown export type');},-1000);
add_action('init',function(){if(empty($_GET['demopress_demo_login'])||demopress_mode()!=='demo')return;$token=(string)wp_unslash($_GET['demopress_demo_login']);$user=get_user_by('login',getenv('DEMOPRESS_DEMO_USER')?:'');$expected=getenv('DEMOPRESS_DEMO_PASSWORD')?:'';if(!$user||!$expected||!hash_equals($expected,$token))return;wp_set_current_user($user->ID);wp_set_auth_cookie($user->ID,true,is_ssl());wp_safe_redirect(admin_url());exit;});
