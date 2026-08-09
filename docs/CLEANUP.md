# Demo Cleanup

Destroy, expiry and reset cleanup removes the WordPress container, MariaDB container and any demo-labelled volumes.

The golden snapshot is never removed.

Manager → System reports orphaned demo containers and orphaned database containers. Use **Clean Orphans Now** for immediate reconciliation. Automatic reconciliation runs every 10 minutes.
