# DemoPress — Next Revision Roadmap

This roadmap defines the next major product-improvement cycle after the 1.0 release line. The objective is to evolve DemoPress from a reliable single-product disposable-demo platform into a safer, multi-template demonstration platform with stronger operational visibility and a more intentional visitor experience.

## 1. Demo Presets / Multiple Templates

Allow one DemoPress installation to expose multiple independently configured demo presets.

Each preset should be able to define:
- Name, slug and description
- Published snapshot
- Required plugins and theme
- Demo lifetime limits
- Demo access policy
- Start URL / landing page
- Visitor-capture policy
- Branding / CTA overrides where appropriate

The launcher should accept a preset explicitly and record it on the demo. Existing installations without presets must continue to behave as a single default preset.

Suggested public form: `/?preset=<slug>`.

## 2. Snapshot Versioning, Validation and Rollback

Promote snapshots from simple retained exports to managed releases.

Manager should expose:
- Active snapshot
- Previous snapshots
- Snapshot manifest/inventory
- Launch validation test
- Make active / rollback
- Delete (never active snapshot)
- Validation status and timestamp

Publishing should no longer imply that an exported snapshot is healthy. A snapshot should be exportable first, then validated with a disposable administrator-test clone, and only then promoted to active. Validation should verify database import, WordPress bootstrap, table prefix, required components, Agent, frontend, wp-admin and HTTPS route.

## 3. Demo Analytics and Activity

Add purpose-built platform analytics rather than a general web-analytics replacement.

Initial metrics:
- Demos launched / ready / failed / expired / destroyed
- Success rate
- Average provisioning time
- Average database import/finalisation/routing time
- Average demo lifetime
- Peak/active demos
- Admin-login/open rate where measurable
- Preset usage
- Failure stages and common errors
- Visitor capture totals without exposing secrets

Analytics must be derived from DemoPress-owned lifecycle data and remain usable when visitor capture is disabled.

## 4. Configurable Demo Experience

Use the Agent/MU-plugin layer to make a disposable installation clearly feel like a controlled product demo without modifying the demonstrated product.

Configurable options should include:
- Demo toolbar
- Remaining-time indicator
- Reset action
- Exit / return-to-product action
- Product/docs/source CTA
- Welcome/dashboard panel
- Start destination (dashboard, frontend, or safe explicit path)
- Hide irrelevant WordPress notices

All actions must respect the existing DemoPress access policy. Product-specific code must not be added to the core Agent.

## 5. Self-Healing and Strict Readiness

A demo must not be marked `running` merely because its public route returns a successful HTTP response.

Before readiness, verify:
1. Database reachable
2. Snapshot imported
3. `wp-config.php` valid
4. Non-empty table prefix matches the imported WordPress tables
5. WordPress PHP bootstrap succeeds
6. Required plugins are active
7. Required theme is active
8. Demo user/access policy applied
9. Agent available
10. Frontend responds successfully
11. wp-admin responds successfully
12. Public HTTPS route is valid

Safe automatic repairs may include:
- Repairing an empty/incorrect table prefix when it can be determined unambiguously
- Correcting cloned home/site URLs
- Activating the Agent/required components
- Flushing rewrites
- Repairing DemoPress-owned/content permissions

If verification still fails, fail provisioning with a specific stage/reason and preserve diagnostics. HTTP availability alone must never bypass an incomplete or failed finaliser.

## Recommended implementation order

1. Strict readiness and self-healing
2. Snapshot validation/versioning/rollback
3. Preset data model and multiple-template provisioning
4. Analytics
5. Demo-experience controls

This order deliberately establishes reliability and snapshot safety before expanding the number of configurations DemoPress can operate.

## Compatibility principles

- Existing single-template installations become the implicit `default` preset.
- Existing profiles remain valid.
- Existing snapshots remain readable.
- The DemoPress Agent remains a generic control/security integration, not a product-specific plugin.
- Secrets and infrastructure controls must never be exposed to disposable demo users.
- New readiness checks should fail closed when a security-sensitive or WordPress-bootstrap condition cannot be established.
