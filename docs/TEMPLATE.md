# Golden Template Workflow

The golden template is the persistent WordPress source used to build disposable demos.

1. Install/configure the plugins and WordPress theme visitors should receive.
2. Add the content, media and settings you want included.
3. Keep DemoPress Agent active on the template.
4. Configure the demo-user access policy in DemoPress Agent after the product plugins are active.
5. Confirm the required plugin/theme metadata in DemoPress Manager.
6. Run **Manager → Template → Validate**.
7. Publish a candidate snapshot.
8. Run isolated snapshot validation.
9. Promote a validated snapshot for public use.
10. Launch a test demo and verify the resulting experience.

Publishing a candidate does not automatically make that snapshot the public release. Validation and promotion provide the release gate, and retained validated snapshots can be used for rollback.

Each disposable demo receives:
- selected snapshot database state
- uploads snapshot when present
- captured plugin/theme files
- a fresh restricted demo user
- its own MariaDB container
- its own WordPress container
- a unique wildcard hostname
- the configured preset start path and lifetime

The golden-template WordPress filesystem and MariaDB data are persistent across normal DemoPress redeployments. Publish and validate a new snapshot after template changes before expecting new demos to contain them.
