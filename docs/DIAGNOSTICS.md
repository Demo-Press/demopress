# DemoPress Diagnostics

DemoPress records millisecond-level provisioning events, database import timing, WordPress container timing, clone-finaliser timing, HTTPS route checks and cleaned container logs.

Use **Manager → Diagnostics** for platform checks and **Manager → Demos → Demo Details** for the event timeline and logs for a specific disposable environment.

The supported runtime image is `demopress-wordpress:1.0`. With `AUTO_BUILD_DEMO_IMAGE=1`, DemoPress can build the bundled runtime when it is missing. For a manual rebuild after runtime changes, use:

```bash
./scripts/rebuild-demo-image.sh
```

A normal launch progresses through database setup, snapshot restore, WordPress startup, finalising, routing verification and Ready. When provisioning fails, use the recorded stage and event timeline as the primary troubleshooting source.
