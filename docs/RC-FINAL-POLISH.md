
# DemoPress 1.0-RC Final Polish

This pass does not change the provisioning architecture.

## Manager UX
- Save success/error toast notifications.
- Buttons disable while valid forms submit.
- Profile and Settings fields use browser validation.
- Settings show explicit units and human-readable lifetime hints.
- Invalid lifetime combinations are rejected.
- Setup and Profile link directly to configuration checks.

## Setup validation
- Product/company/platform names are required.
- Homepage/logo/favicon fields validate HTTP/HTTPS URLs.
- Launcher/template values validate hostnames and cannot be identical.
- Public launch copy is required and length checked.
- Product Stack disables inactive plugins/themes.
- Required theme can only be the active golden-template theme.
- Readiness and final steps show a configuration-completeness summary.
- Administrator test launch is disabled until required configuration checks pass.

## Operational settings
- Idle lifetime: 60–86,400 seconds.
- Maximum lifetime: 300–604,800 seconds and cannot be lower than idle lifetime.
- Maximum active demos: 1–100.
- Failed retention: 60–86,400 seconds.
- Maintenance mode is described clearly.

Secrets and infrastructure settings remain environment-managed.
