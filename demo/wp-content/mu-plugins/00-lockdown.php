\
<?php
/*
Plugin Name: DemoPress Demo Security
Description: Restricts disposable demo users from modifying the platform itself.
*/
if(!defined('ABSPATH'))exit;

if(!defined('DISALLOW_FILE_EDIT'))define('DISALLOW_FILE_EDIT',true);
if(!defined('DISALLOW_FILE_MODS'))define('DISALLOW_FILE_MODS',true);

add_filter('wp_is_application_passwords_supported','__return_false');
add_filter('upload_size_limit',fn()=>5*1024*1024);
add_filter('pre_wp_mail',fn()=>false);

add_action('admin_menu',function(){
  remove_menu_page('plugins.php');
  remove_menu_page('themes.php');
  remove_menu_page('tools.php');
  remove_menu_page('users.php');
  remove_submenu_page('index.php','update-core.php');
},999);

add_filter('map_meta_cap',function($caps,$cap){
  $blocked=[
   'activate_plugins','install_plugins','update_plugins','delete_plugins','edit_plugins',
   'install_themes','update_themes','delete_themes','switch_themes','edit_themes',
   'update_core','create_users','delete_users','promote_users','edit_users'
  ];
  return in_array($cap,$blocked,true)?['do_not_allow']:$caps;
},10,2);

$required_theme=getenv('DEMOPRESS_REQUIRED_THEME') ?: '';
if($required_theme){
  add_filter('pre_option_template',fn()=>$required_theme);
  add_filter('pre_option_stylesheet',fn()=>$required_theme);
}
