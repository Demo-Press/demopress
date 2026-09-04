# DemoPress 1.0 Release Checklist

## Deployment
- Launcher DNS resolves.
- Wildcard demo DNS resolves.
- Template DNS resolves.
- HTTPS works for launcher, template and wildcard demo hosts.
- `/data` and the golden-template WordPress/database volumes are persistent.
- Docker socket and external proxy network are available to the launcher.
- Runtime image `demopress-wordpress:1.0` exists or can be built automatically.

## Manager and setup
- Dedicated Manager sign-in works on desktop, tablet and mobile.
- Setup readiness checks pass.
- Profile required plugins/theme match the intended golden-template product stack.
- Visitor Capture fields are configured intentionally.
- Resend delivery is tested when enabled.
- Presets and Demo Experience settings are reviewed.

## Golden template
- DemoPress Agent is active and connected.
- Demo-user baseline role and optional Admin-menu whitelist are intentional.
- Template validation passes.
- Candidate snapshot publishes successfully.
- Isolated snapshot validation passes.
- A validated snapshot is promoted for public use.

## Disposable demo lifecycle
- Administrator Test reaches Ready.
- Public launch reaches Ready.
- Public demo URL works through HTTPS.
- One-click Admin works.
- Restricted demo role cannot access protected WordPress platform areas.
- Configured start path works.
- Reset restores the selected golden snapshot.
- Expiry/destroy removes WordPress and MariaDB containers.
- Per-IP/public launch limits fail cleanly when exceeded.

## Release quality
- Manager and public launcher work at desktop, tablet and mobile widths.
- Empty, loading, failure and expired states are readable.
- Diagnostics show no unexpected orphan resources.
- GitHub validation workflow is green on the release commit.
- README, `docs/`, environment example and demopress.co.uk documentation describe the same current workflow.
- Changelog contains the final 1.0.0 release notes.


## Hosted integration boundary

- [ ] DemoPress Core can be deployed and operated without DemoPress Cloud.
- [ ] Cloud-specific accounts, billing and provider credentials are not present in Core.
- [ ] A Cloud-provisioned deployment passes the same launcher, template, snapshot and disposable-demo checks as a self-hosted deployment.
- [ ] `DOCKER_API_VERSION` is compatible with the target Docker Engine (1.44 is the documented baseline).
