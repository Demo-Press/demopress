<?php
/*
Plugin Name: DemoPress Agent
Description: Connects a WordPress golden template and disposable clones to DemoPress.
Version: 1.0.0
Author: DemoPress
Author URI: https://demopress.co.uk
*/
if(!defined('ABSPATH'))exit;

function demopress_mode(){return get_option('demopress_mode','template');}
function demopress_template_mode(){return demopress_mode()==='template';}
function demopress_demo_mode(){return demopress_mode()==='demo';}
function demopress_launcher_url(){
  return rtrim(get_option('demopress_launcher_url',getenv('DEMOPRESS_LAUNCHER_URL')?:''),'/');
}
function demopress_allowed(){
  return is_user_logged_in()&&(current_user_can('manage_options')||in_array('demopress_demo_admin',(array)wp_get_current_user()->roles,true));
}
function demopress_token(){return (string)get_option('demopress_template_token','');}
function demopress_internal_auth($request){
  $expected=demopress_token();
  if(!$expected)$expected=getenv('INTERNAL_TEMPLATE_TOKEN')?:($_SERVER['INTERNAL_TEMPLATE_TOKEN']??'');
  $got=$request->get_header('x-demopress-template-token');
  return $expected&&$got&&hash_equals($expected,$got);
}

add_action('admin_menu',function(){
  if(!current_user_can('manage_options')||!demopress_template_mode())return;
  add_options_page('DemoPress Agent','DemoPress Agent','manage_options','demopress-agent','demopress_settings_page');
});
function demopress_settings_page(){
  if(isset($_POST['demopress_save'])&&check_admin_referer('demopress_settings')){
    update_option('demopress_mode',sanitize_text_field($_POST['mode']??'template'));
    update_option('demopress_launcher_url',esc_url_raw($_POST['launcher_url']??''));
    if(!empty($_POST['token']))update_option('demopress_template_token',sanitize_text_field($_POST['token']));
    echo '<div class="notice notice-success"><p>DemoPress settings saved.</p></div>';
  }
  $mode=demopress_mode();$url=demopress_launcher_url();
  echo '<div class="wrap"><h1>DemoPress Agent</h1><p>Connect this WordPress site to your DemoPress instance.</p><form method="post">';
  wp_nonce_field('demopress_settings');
  echo '<table class="form-table"><tr><th>Mode</th><td><select name="mode"><option value="template" '.selected($mode,'template',false).'>Golden template</option><option value="demo" '.selected($mode,'demo',false).'>Disposable demo</option></select></td></tr>';
  echo '<tr><th>DemoPress launcher URL</th><td><input class="regular-text" name="launcher_url" value="'.esc_attr($url).'" placeholder="https://demo.example.com"></td></tr>';
  echo '<tr><th>Template token</th><td><input class="regular-text" type="password" name="token" placeholder="Leave blank to keep existing token"><p class="description">Must match INTERNAL_TEMPLATE_TOKEN in DemoPress.</p></td></tr></table>';
  submit_button('Save','primary','demopress_save');
  echo '</form></div>';
}

add_action('admin_notices',function(){
 if(demopress_template_mode())echo '<div class="notice notice-warning"><p><strong>DemoPress Template Mode</strong> — This site is the golden source for disposable demos.</p></div>';
 elseif(demopress_demo_mode())echo '<div class="notice notice-info"><p><strong>DemoPress Live Demo</strong> — This environment is temporary and automatically expires.</p></div>';
});

add_action('wp_dashboard_setup',function(){
 if(!demopress_allowed())return;
 wp_add_dashboard_widget('demopress_demo_widget',demopress_template_mode()?'DemoPress Template':'Live Demo',function(){
   if(demopress_template_mode()){
     $url=demopress_launcher_url();
     echo '<p>This site is the golden source for disposable demos. Finish your changes, then publish a snapshot from DemoPress Manager.</p>';
     if($url)echo '<p><a class="button button-primary" href="'.esc_url($url.'/manage/template').'">Open DemoPress Manager</a></p>';
     return;
   }
   echo '<p>Welcome to your private WordPress sandbox.</p><p><a class="button" href="'.esc_url(home_url('/')).'">View Site</a> <button class="button" id="demopress-reset">Reset Demo</button></p><p id="demopress-session">Checking session…</p>';
 });
});

add_action('admin_bar_menu',function($bar){
 if(!demopress_allowed()||demopress_template_mode())return;
 $bar->add_node(['id'=>'demopress','title'=>'DemoPress Demo','href'=>admin_url()]);
 $bar->add_node(['id'=>'demopress-site','parent'=>'demopress','title'=>'View Site','href'=>home_url('/')]);
},100);

function demopress_assets(){
 if(!demopress_allowed()||demopress_template_mode())return;
 wp_enqueue_script('demopress-tools',plugin_dir_url(__FILE__).'tools.js',[],'1.0.0',true);
 wp_localize_script('demopress-tools','DemoPressAgent',['rest'=>rest_url('demopress-agent/v1/'),'nonce'=>wp_create_nonce('wp_rest')]);
}
add_action('admin_enqueue_scripts','demopress_assets');
add_action('wp_enqueue_scripts','demopress_assets');

add_action('rest_api_init',function(){
 register_rest_route('demopress-agent/v1','/heartbeat',['methods'=>'POST','permission_callback'=>'__return_true','callback'=>function(){
   $url=demopress_launcher_url();if(!$url)return ['ok'=>false];
   wp_remote_post($url.'/api/demo-tools/heartbeat',['timeout'=>2,'body'=>['demo'=>wp_parse_url(home_url(),PHP_URL_HOST)]]);
   return ['ok'=>true];
 }]);
 register_rest_route('demopress-agent/v1','/session',['methods'=>'GET','permission_callback'=>'demopress_allowed','callback'=>function(){
   $url=demopress_launcher_url();if(!$url)return ['success'=>false];
   $r=wp_remote_get($url.'/api/demo-tools/session?demo='.rawurlencode(wp_parse_url(home_url(),PHP_URL_HOST)),['timeout'=>3]);
   return json_decode(wp_remote_retrieve_body($r),true)?:['success'=>false];
 }]);
 register_rest_route('demopress-agent/v1','/reset',['methods'=>'POST','permission_callback'=>'demopress_allowed','callback'=>function(){
   $url=demopress_launcher_url();if(!$url)return ['success'=>false];
   $r=wp_remote_post($url.'/api/demo-tools/reset',['timeout'=>3,'body'=>['demo'=>wp_parse_url(home_url(),PHP_URL_HOST)]]);
   return json_decode(wp_remote_retrieve_body($r),true)?:['success'=>false];
 }]);

 register_rest_route('demopress-agent/v1','/status',['methods'=>'GET','permission_callback'=>'demopress_internal_auth','callback'=>function(){
   require_once ABSPATH.'wp-admin/includes/plugin.php';
   $plugins=[];
   foreach(get_plugins() as $file=>$data){
     $plugins[]=['file'=>$file,'name'=>$data['Name'],'version'=>$data['Version'],'active'=>is_plugin_active($file)];
   }
   $themes=[];
   foreach(wp_get_themes() as $stylesheet=>$theme){
     $themes[]=['stylesheet'=>$stylesheet,'name'=>$theme->get('Name'),'version'=>$theme->get('Version'),'active'=>$stylesheet===get_stylesheet()];
   }
   return [
     'ok'=>true,
     'mode'=>demopress_mode(),
     'wordpress'=>get_bloginfo('version'),
     'activeTheme'=>get_stylesheet(),
     'themeVersion'=>wp_get_theme()->get('Version'),
     'plugins'=>$plugins,
     'themes'=>$themes,
     'db'=>true,
     'site'=>home_url('/')
   ];
 }]);

 register_rest_route('demopress-agent/v1','/export',['methods'=>'POST','permission_callback'=>'demopress_internal_auth','callback'=>function(){
   if(!demopress_template_mode())return new WP_Error('not_template','Not template mode',['status'=>403]);
   global $wpdb;
   $tables=$wpdb->get_col('SHOW TABLES');$sql='';
   foreach($tables as $table){
     $create=$wpdb->get_row("SHOW CREATE TABLE `$table`",ARRAY_N);
     $sql.="DROP TABLE IF EXISTS `$table`;\n".$create[1].";\n";
     $rows=$wpdb->get_results("SELECT * FROM `$table`",ARRAY_A);
     foreach($rows as $row){
       $vals=array_map(function($v)use($wpdb){return is_null($v)?'NULL':"'".$wpdb->_real_escape($v)."'";},array_values($row));
       $sql.="INSERT INTO `$table` VALUES(".implode(',',$vals).");\n";
     }
   }
   $uploads=wp_upload_dir();$tar='';$content='';

   if(class_exists('PharData')&&is_dir($uploads['basedir'])){
     try{
       $tmp=wp_tempnam('demopress-uploads.tar.gz');
       $base=preg_replace('/\.gz$/','',$tmp);
       $phar=new PharData($base);
       $phar->buildFromDirectory($uploads['basedir']);
       $phar->compress(Phar::GZ);
       $gz=$base.'.gz';
       if(file_exists($gz))$tar=base64_encode(file_get_contents($gz));
     }catch(Throwable $e){}
   }

   if(class_exists('PharData')){
     try{
       $tmp=wp_tempnam('demopress-content.tar.gz');
       $base=preg_replace('/\.gz$/','',$tmp);
       $phar=new PharData($base);

       $dirs=[
         'plugins'=>WP_CONTENT_DIR.'/plugins',
         'themes'=>WP_CONTENT_DIR.'/themes'
       ];

       foreach($dirs as $prefix=>$dir){
         if(!is_dir($dir))continue;
         $it=new RecursiveIteratorIterator(
           new RecursiveDirectoryIterator($dir,FilesystemIterator::SKIP_DOTS)
         );
         foreach($it as $file){
           if(!$file->isFile())continue;
           $local=$prefix.'/'.substr($file->getPathname(),strlen($dir)+1);
           $phar->addFile($file->getPathname(),$local);
         }
       }

       $phar->compress(Phar::GZ);
       $gz=$base.'.gz';
       if(file_exists($gz))$content=base64_encode(file_get_contents($gz));
     }catch(Throwable $e){}
   }

   return [
     'ok'=>true,
     'database_b64'=>base64_encode($sql),
     'uploads_b64'=>$tar,
     'content_b64'=>$content,
     'manifest'=>['site'=>home_url('/'),'time'=>time(),'theme'=>get_stylesheet()]
   ];
 }]);
});
