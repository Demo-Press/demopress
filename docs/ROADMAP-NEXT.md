# DemoPress Roadmap Status

The roadmap that originally lived in this file was the implementation plan used to finish the DemoPress 1.0 release candidate. Its five major items are now part of the 1.0 codebase:

1. **Strict readiness and self-healing** — provisioning requires successful clone finalisation and route verification, with detailed failure diagnostics and lifecycle reconciliation.
2. **Snapshot validation, versioning and rollback** — exports become candidate snapshots, isolated validation records pass/fail state, and validated snapshots can be promoted or rolled back to.
3. **Demo Presets** — one installation can define multiple reusable demo configurations backed by validated snapshots.
4. **Analytics** — Manager reports launch, readiness/failure, provisioning timing, preset and visitor-capture lifecycle metrics.
5. **Demo Experience controls** — optional disposable-demo context, expiry, links/CTA and notice presentation are managed by the DemoPress runtime layer.

These are therefore no longer “next revision” items. Current behaviour is documented in the main `README.md`, `docs/` pages and the public demopress.co.uk documentation.

## Post-1.0 development

New functionality should be planned against the stable 1.0 baseline rather than extending this historical roadmap. Release-blocking work before the 1.0 tag should be limited to audit findings, documentation corrections, regression fixes and validation failures.

Larger new features should target the 1.1 release line after 1.0 has been deployed and observed in production.
