<?php
if(!defined('ABSPATH'))exit(1);

$user_login=(string)(getenv('DEMOPRESS_DEMO_USER')?:'');
$password=(string)(getenv('DEMOPRESS_DEMO_PASSWORD')?:'');
$role_name=(string)(getenv('DEMOPRESS_DEMO_ROLE_NAME')?:'DemoPress Demo User');
if($user_login===''||$password===''){fwrite(STDERR,"[DIAG] ERROR personalise missing demo credentials\n");exit(2);}

$policy=get_option('demopress_demo_access',[]);if(!is_array($policy))$policy=[];
$base_role_slug=sanitize_key($policy['base_role']??'administrator');$base_role=get_role($base_role_slug);
if(!$base_role){$base_role_slug='administrator';$base_role=get_role('administrator');}
if(!$base_role){fwrite(STDERR,"[DIAG] ERROR personalise no usable baseline role\n");exit(3);}
$allow_theme_switching=!empty($policy['allow_theme_switching']);

$capabilities=[];foreach((array)$base_role->capabilities as $cap=>$allowed){if($allowed)$capabilities[$cap]=true;}
$protected=[
 'activate_plugins','deactivate_plugins','delete_plugins','edit_plugins','install_plugins','update_plugins',
 'delete_themes','edit_themes','install_themes','update_themes','edit_files',
 'edit_users','create_users','delete_users','list_users','promote_users','remove_users',
 'update_core','import','export'
];
if(!$allow_theme_switching)$protected[]='switch_themes';
foreach($protected as $cap)unset($capabilities[$cap]);
if($allow_theme_switching)$capabilities['switch_themes']=true;
$capabilities['read']=true;$capabilities['demopress_demo_user']=true;

remove_role('demopress_demo_admin');
$role=add_role('demopress_demo_admin',$role_name,$capabilities);
if(!$role){fwrite(STDERR,"[DIAG] ERROR personalise unable to create demo role\n");exit(4);}

$user=get_user_by('login',$user_login);
if($user){wp_set_password($password,$user->ID);$user=new WP_User($user->ID);$user->set_role('demopress_demo_admin');$user_id=$user->ID;}
else{$user_id=wp_insert_user(['user_login'=>$user_login,'user_pass'=>$password,'user_email'=>'demo-'.sanitize_user($user_login).'@example.invalid','role'=>'demopress_demo_admin']);if(is_wp_error($user_id)){fwrite(STDERR,"[DIAG] ERROR personalise user creation failed: ".$user_id->get_error_message()."\n");exit(5);}$user=new WP_User($user_id);}
update_user_meta($user_id,'demopress_demo_user',1);
update_option('demopress_demo_access_effective_role','demopress_demo_admin',false);
update_option('default_role','subscriber');

$template_admin=null;foreach(get_users(['role'=>'administrator','orderby'=>'ID','order'=>'ASC','number'=>20]) as $candidate){if($candidate->user_login!==$user_login){$template_admin=$candidate;break;}}
$ui_meta_keys=['metaboxhidden_dashboard','closedpostboxes_dashboard','meta-box-order_dashboard','screen_layout_dashboard','show_welcome_panel','dismissed_wp_pointers','community-events-location','wp_user-settings','wp_user-settings-time','admin_color'];
if($template_admin){foreach($ui_meta_keys as $key){if(metadata_exists('user',$template_admin->ID,$key))update_user_meta($user_id,$key,get_user_meta($template_admin->ID,$key,true));}echo "[DIAG] dashboard-preferences copied-from={$template_admin->user_login}\n";}

wp_destroy_all_sessions();
$restricted=!empty($policy['restrict_menus'])?'yes':'no';$allowed=count((array)($policy['allowed_menus']??[]));$theme_switch=$allow_theme_switching?'yes':'no';
echo "[DIAG] demo-access base-role={$base_role_slug} menu-restriction={$restricted} allowed-menus={$allowed} theme-switching={$theme_switch}\n";
echo "[DIAG] personaliser role=demopress_demo_admin user={$user_login} id={$user_id}\n";
