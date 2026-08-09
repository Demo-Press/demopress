<?php
/*
Plugin Name: DemoPress Demo Runtime
Description: Runtime hardening for disposable DemoPress disposable demo sites.
*/
if (!defined('ABSPATH')) exit;
if (!defined('DISABLE_WP_CRON')) define('DISABLE_WP_CRON', true);
add_filter('xmlrpc_enabled', '__return_false');
remove_action('wp_head', 'wp_generator');
