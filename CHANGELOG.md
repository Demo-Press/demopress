# Changelog

All notable public changes to DemoPress are documented here. The public changelog begins with the first stable release.

## 1.0.0 — 2026-08-27

First stable public release of DemoPress.

### Disposable demo platform
- Self-hosted launcher and responsive Manager for isolated WordPress product demos.
- Every disposable demo receives separate WordPress and MariaDB containers, random database credentials, a unique wildcard hostname and hard expiry.
- Demo readiness is fail-closed: clone finalisation must emit the explicit ready signal and routing verification must pass before a demo is marked Ready.
- Reset, retry, extension, expiry, destruction and automatic lifecycle reconciliation are built in.
- Docker resources are scoped with a DemoPress instance label to reduce cross-instance cleanup risk.

### Golden templates and snapshots
- Persistent golden-template WordPress and MariaDB services are included in the standard Compose deployment.
- DemoPress Agent validates the template and streams snapshot data to the launcher.
- Template exports create candidate snapshots with database, captured WordPress content/plugins/themes, optional uploads and validation metadata.
- Candidate snapshots track validation state and can be tested in an isolated disposable environment before promotion.
- Manager supports promotion, rollback and validation diagnostics; presets cannot silently use untrusted candidates as public releases.

### Demo user access
- DemoPress Agent provides a configurable baseline role and optional top-level WordPress Admin menu whitelist.
- Disposable users receive a generated `demopress_demo_admin` role rather than a normal Administrator role.
- Plugin/theme/core installation, editing, updates and user administration remain protected.
- Installed-theme switching can be enabled separately without restoring destructive theme-management capabilities.

### Demo Presets and experience
- One DemoPress installation can define multiple enabled demo presets backed by validated snapshots.
- Presets can define required plugins/theme, start path, lifetime limits, name, description and default state.
- Public launcher supports `?preset=<slug>` and displays a selector when multiple presets are enabled.
- Product-neutral Demo Experience controls can add temporary-demo context, expiry information, documentation/product links and optional WordPress notice suppression.

### Visitor capture and delivery
- Name, Email, Company and Website can independently be Off, Optional or Required.
- Captured values are retained for Manager/analytics use independently of email delivery.
- Optional Resend integration can send demo URL, temporary credentials and one-click Admin information when an email address is supplied.
- Email-delivery failures do not turn an otherwise healthy demo into a failed demo.

### Manager and analytics
- Responsive Manager with dedicated authentication, Setup, Profile, Template, Presets, Visitor Capture, Demo Experience, Demos, Analytics, Diagnostics, System Health and Settings views.
- Analytics includes 7, 30 and 90 day launch/success/failure views, provisioning timing, preset usage and failure-stage information.
- Demo details include lifecycle events and cleaned provisioning logs.

### Themes and profiles
- Product requirements/copy are selected through profiles while customer-facing launcher presentation is selected independently through DemoPress themes.
- Bundled themes and an editable starter theme are included.
- Optional authenticated external/private launcher-theme archives are supported without requiring a fork or product-specific runtime image.
- Generic disposable runtime image is standardised as `demopress-wordpress:1.0`.

### Security and release hardening
- Manager sessions use signed HTTP-only cookies; Manager write actions require authentication and CSRF/origin validation.
- Public reset/login endpoints are rate-limited and one-click login tokens are short-lived/one-use where applicable.
- Security headers include CSP, HSTS on HTTPS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy and Permissions-Policy.
- Compose now fails fast when required domains and deployment secrets are missing instead of falling back to predictable database credentials.
- Installer, environment examples and runtime image tooling are aligned to the stable 1.0 deployment contract.
- GitHub Actions validates JavaScript, PHP, shell scripts, JSON, Docker Compose and both production images.

### Final release refinements
- Manager Setup branding now overrides launcher-theme identity where configured, including platform/product labels, homepage, logo, favicon, accent and footer copy.
- The documented Docker API compatibility floor is 1.44 for current Docker Engine deployments.
- Core/Cloud product boundaries and hosted integration checks are documented.

### Upgrade note
Installations created from pre-1.0 release-candidate builds should re-test existing snapshots in **Manager → Template → Validate** and promote a passing snapshot before relying on it for public presets. Review and regenerate deployment secrets if any pre-release environment used placeholder or predictable values.
