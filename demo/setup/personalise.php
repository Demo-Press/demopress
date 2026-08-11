<?php
if (!defined('ABSPATH')) exit(1);

$user_login=getenv('DEMO_ADMIN_USER');
$password=getenv('DEMO_ADMIN_PASSWORD');
$role_name=getenv('DEMOPRESS_DEMO_ROLE_NAME') ?: 'DemoPress Demo Admin';

if(!$user_login||!$password){
    fwrite(STDERR,"[DIAG] ERROR personalise missing demo credentials\n"); exit(2);
}

$administrator=get_role('administrator');
if(!$administrator){
    fwrite(STDERR,"[DIAG] ERROR personalise administrator role unavailable\n"); exit(3);
}

$policy=get_option('demopress_demo_access',[]);
if(!is_array($policy))$policy=[];
$base_role_slug=sanitize_key($policy['base_role']??'administrator');
$base_role=get_role($base_role_slug);
if(!$base_role){$base_role_slug='administrator';$base_role=$administrator;}

$template_admin=null;
foreach(get_users(['role'=>'administrator','orderby'=>'ID','order'=>'ASC','number'=>20]) as $candidate){
    if($candidate->user_login!==$user_login){$template_admin=$candidate;break;}
}

$capabilities=$base_role->capabilities;
foreach([
 'activate_plugins','install_plugins','update_plugins','delete_plugins','edit_plugins',
 'install_themes','update_themes','delete_themes','switch_themes','edit_themes',
 'update_core','create_users','delete_users','promote_users','edit_users'
] as $cap){unset($capabilities[$cap]);}
$capabilities['demopress_demo_user']=true;

remove_role('demopress_demo_admin');
$role=add_role('demopress_demo_admin',$role_name,$capabilities);
if(!$role){fwrite(STDERR,"[DIAG] ERROR personalise unable to create demo role\n");exit(4);}

$user=get_user_by('login',$user_login);
if($user){
    wp_set_password($password,$user->ID);
    $user=new WP_User($user->ID);
    $user->set_role('demopress_demo_admin');
    $user_id=$user->ID;
}else{
    $user_id=wp_insert_user([
      'user_login'=>$user_login,
      'user_pass'=>$password,
      'user_email'=>'demo-'.sanitize_user($user_login).'@invalid.local',
      'role'=>'demopress_demo_admin'
    ]);
    if(is_wp_error($user_id)){
      fwrite(STDERR,"[DIAG] ERROR personalise user creation failed: ".$user_id->get_error_message()."\n");
      exit(5);
    }
}

$ui_meta_keys=[
 'metaboxhidden_dashboard','closedpostboxes_dashboard','meta-box-order_dashboard',
 'screen_layout_dashboard','show_welcome_panel','dismissed_wp_pointers',
 'community-events-location','wp_user-settings','wp_user-settings-time','admin_color'
];

if($template_admin){
  foreach($ui_meta_keys as $key){
    if(metadata_exists('user',$template_admin->ID,$key)){
      update_user_meta($user_id,$key,get_user_meta($template_admin->ID,$key,true));
    }
  }
  echo "[DIAG] dashboard-preferences copied-from={$template_admin->user_login}\n";
}

wp_destroy_all_sessions();
update_option('default_role','subscriber');
$restricted=!empty($policy['restrict_menus'])?'yes':'no';
$allowed=count((array)($policy['allowed_menus']??[]));
echo "[DIAG] demo-access base-role={$base_role_slug} menu-restriction={$restricted} allowed-menus={$allowed}\n";
echo "[DIAG] personaliser role=demopress_demo_admin user={$user_login} id={$user_id}\n";
