
# DemoPress 1.0-RC Lifecycle / Log Retention Hotfix

Earlier RC builds parsed blank numeric values as zero. In JavaScript,
`Number("") === 0`, so `DEFAULT_DEMO_LIFETIME=` could create a zero-second
expiry and a healthy demo would be removed on the next five-minute cleanup sweep.

Blank numeric environment and Manager values now use their normal fallback.

Before container deletion DemoPress now archives the final 500 lines of
WordPress/Apache and MariaDB logs to SQLite. Deleted diagnostics retain these
logs and show deletion timestamp/reason.

Still remove blank/duplicate Coolify environment variables so each setting has
one canonical value.
