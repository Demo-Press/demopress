<?php
/*
Plugin Name: DemoPress One Click Login
Description: Consumes short-lived launcher tokens and signs the disposable demo user into WordPress.
*/

if (!defined('ABSPATH')) {
    exit;
}

add_action('init', function () {
    if (empty($_GET['demopress_demo_login'])) {
        return;
    }

    $token = sanitize_text_field(
        wp_unslash($_GET['demopress_demo_login'])
    );

    $host = wp_parse_url(
        home_url(),
        PHP_URL_HOST
    );

    $response = wp_remote_post(
        (rtrim(getenv('DEMOPRESS_LAUNCHER_URL') ?: get_option('demopress_launcher_url',''),'/') . '/api/demo-tools/consume-login'),
        [
            'timeout' => 5,
            'body' => [
                'demo'  => $host,
                'token' => $token,
            ],
        ]
    );

    if (is_wp_error($response)) {
        wp_die(
            'Demo login unavailable: '
            . esc_html($response->get_error_message())
        );
    }

    $status = wp_remote_retrieve_response_code($response);

    $data = json_decode(
        wp_remote_retrieve_body($response),
        true
    );

    if (
        $status !== 200
        || empty($data['success'])
        || empty($data['user'])
    ) {
        wp_die('Demo login token is invalid or expired.');
    }

    $user = get_user_by(
        'login',
        $data['user']
    );

    if (!$user) {
        wp_die('Demo user not found.');
    }

    wp_set_current_user($user->ID);

    wp_set_auth_cookie(
        $user->ID,
        false,
        is_ssl()
    );

    wp_safe_redirect(admin_url());
    exit;
});
