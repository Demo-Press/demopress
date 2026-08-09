<?php
/*
Plugin Name: DemoPress Demo Heartbeat
Description: Keeps disposable demo sessions active while a logged-in visitor is using the site.
*/

if (!defined('ABSPATH')) {
    exit;
}

add_action('rest_api_init', function () {
    register_rest_route(
        'demopress-agent/v1',
        '/heartbeat',
        [
            'methods' => 'POST',
            'permission_callback' => function () {
                return is_user_logged_in();
            },
            'callback' => function () {
                $host = wp_parse_url(
                    home_url(),
                    PHP_URL_HOST
                );

                $response = wp_remote_post(
                    (rtrim(getenv('DEMOPRESS_LAUNCHER_URL') ?: get_option('demopress_launcher_url',''),'/') . '/api/demo-tools/heartbeat'),
                    [
                        'timeout' => 3,
                        'body' => [
                            'demo' => $host,
                        ],
                    ]
                );

                if (is_wp_error($response)) {
                    return new WP_REST_Response(
                        [
                            'success' => false,
                            'error' => $response->get_error_message(),
                        ],
                        503
                    );
                }

                return new WP_REST_Response(
                    [
                        'success' => true,
                    ],
                    200
                );
            },
        ]
    );
});

add_action('wp_footer', function () {
    if (!is_user_logged_in()) {
        return;
    }
    ?>
    <script>
    (function () {
        function sendDemoHeartbeat() {
            fetch(
                '/wp-json/demopress-agent/v1/heartbeat',
                {
                    method: 'POST',
                    credentials: 'same-origin'
                }
            ).catch(function () {});
        }

        setInterval(sendDemoHeartbeat, 60000);
    })();
    </script>
    <?php
});
