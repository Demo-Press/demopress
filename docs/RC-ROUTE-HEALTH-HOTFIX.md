
# DemoPress 1.0-RC Route / Health Hotfix

This hotfix separates internal WordPress health from public HTTPS route verification.

The launcher now:
- verifies WordPress and MariaDB directly inside the demo container;
- checks the public wildcard URL separately;
- records the route as verified/unverified/failed;
- does not falsely degrade a healthy demo just because the launcher cannot hairpin through its own public HTTPS hostname;
- stops public-route monitoring if the launcher cannot reach that hostname;
- supports strict mode with `REQUIRE_PUBLIC_ROUTE_CHECK=true`.

Default is `REQUIRE_PUBLIC_ROUTE_CHECK=false` for compatibility with Coolify/Docker networking.

If the route is unverified, test the demo URL from an external browser. If it fails externally too, check wildcard DNS and Traefik routing.
