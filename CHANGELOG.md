# Changelog

## Next revision — in development

### Reliability and snapshots
- Demo readiness is now fail-closed: a public HTTP response can no longer bypass an incomplete clone finaliser.
- Disposable WordPress must emit the explicit `DEMO CLONE READY` signal before routing verification can mark a demo ready.
- Golden-template exports are now candidate snapshots rather than automatically active releases.
- Candidate snapshots have `untested`, `testing`, `passed`, or `failed` validation state.
- Manager supports isolated snapshot validation, promotion of validated snapshots, rollback to previously validated snapshots, and validation diagnostics.
- Snapshots referenced by demo presets cannot be deleted until the preset is moved elsewhere.
- Reset Demo and Retry Finalisation Manager operations have been restored and use the strict readiness path.

### Demo presets
- One DemoPress installation can now define multiple demo presets.
- Presets can select a validated snapshot, required plugins/theme, start path, idle/max lifetime, enabled/default state, name and description.
- Existing installations automatically receive a backwards-compatible `default` preset.
- Public launcher supports `?preset=<slug>` and displays a preset selector when more than one preset is enabled.
- Demo records, Docker labels and analytics record the preset used.

### Analytics
- Manager analytics now supports 7, 30 and 90 day views.
- Reports public launch count, ready/failure rate, average provisioning time, stage timings, preset usage and failure stages.
- Optional visitor-capture and demo-email totals are included without exposing credentials or secrets.

### Demo experience
- Added product-neutral Demo Experience controls for disposable environments.
- Optional DemoPress toolbar can show temporary-demo context, expiry, documentation, product CTA and exit links.
- WordPress admin notices can optionally be hidden for disposable demo users.
- Experience controls are implemented through the DemoPress MU-plugin layer and do not modify the golden product configuration.

### Manager visual redesign
- Reworked the Manager into a cohesive monochrome control-panel design with a persistent grouped sidebar, consistent spacing, typography and responsive mobile navigation.
- Added proper navigation icons and permanent links for Presets and Demo Experience.
- Dashboard KPI cards now use a consistent visual hierarchy and are supplemented by live Recent Demos and System Health panels.
- Operational states across Manager tables use reusable success, warning, failure and animated provisioning pills instead of raw status text.
- Template Manager now visualises the Exported → Validated → Ready → Active snapshot pipeline and presents snapshots as release cards.
- Demo Presets are presented as responsive product-style cards rather than a dense configuration table.
- Manager login has been aligned to the same white/black/neutral design system with no coloured gradient treatment.

### Security and quality
- New Manager mutation routes are protected with Manager authentication and CSRF/origin checks.
- Preset start destinations are constrained to local paths; external CTA/docs/exit destinations accept HTTP/HTTPS only.
- Authenticated template API/export requests continue to reject redirects and retain token authentication.
- Added GitHub Actions validation for launcher JavaScript, shell scripts, DemoPress PHP and JSON files.

### Upgrade note
Existing active snapshots created before snapshot validation state was introduced should be re-tested in **Manager → Template → Validate** and promoted before relying on them for public presets. The automatic `default` preset preserves the single-template configuration model.

## 1.0-rc
- Final Manager/Setup polish: form validation, save notifications, completeness checks, safer component selection and clearer operational settings
- Demo and one-click Admin actions now open in new tabs on customer and Manager views, preserving the demo details page
- Setup Wizard
- Profile editor
- plugin/theme inventory and selection
- branding configuration
- DNS/readiness checks
- installer helper
- RC test plan