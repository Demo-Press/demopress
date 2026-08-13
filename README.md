# DemoPress 1.0

DemoPress is a self-hosted platform for creating private, disposable WordPress product demos from a maintained golden template.

## Core model

- One generic launcher/runtime codebase.
- `DEMOPRESS_THEME` selects launcher branding.
- `DEMOPRESS_PROFILE` selects required WordPress plugins/theme and product copy.
- Golden-template exports become candidate snapshots containing `database.sql`, `content.tar.gz`, optional `uploads.tar.gz` and `manifest.json`.
- Candidate snapshots are validated with an isolated disposable test before promotion for public use.
- Demo Presets select a validated snapshot plus product requirements, start path and lifetime settings.
- Every disposable WordPress demo receives its own MariaDB container and temporary WordPress user.
- Docker resources are labelled with `com.demopress.instance=<DOMAIN>` so multiple DemoPress deployments on one daemon remain isolated.
- The generic runtime image is `demopress-wordpress:1.0`.
- Automatic reconciliation reports unknown/orphan resources but does not silently remove resources belonging to another DemoPress instance.

## First deployment

1. Configure the environment values from `env/demopress.env.example`.
2. Deploy `docker-compose.yml`.
3. Visit the template WordPress domain and complete WordPress installation if required.
4. Install and configure the product plugins/theme you want visitors to experience.
5. Ensure **DemoPress Agent** is active.
6. Open **WordPress → Settings → DemoPress Agent** and confirm the Agent secret is configured.
7. Configure **Demo user access** in DemoPress Agent.
8. Visit `/manage` on the launcher domain and sign in with the configured Manager password.
9. Open **Template**, validate the source and export a candidate snapshot.
10. Validate the candidate with an isolated test and promote it after validation passes.
11. Configure or review the Demo Preset that should use the validated snapshot.
12. Launch a test from the promoted snapshot and verify the disposable site, temporary user and permitted WordPress areas.
13. When the test is healthy, make the public launcher available to visitors.

## DemoPress Agent secret key

WordPress **Settings → DemoPress Agent** shows whether an effective secret exists and whether it comes from WordPress or the environment. The actual key is never displayed; only a short SHA-256 fingerprint is shown.

You can keep, replace, generate or clear the saved WordPress key. A blank replacement does not destroy the existing key.

For automated deployments, set `INTERNAL_TEMPLATE_TOKEN`. A key saved inside WordPress takes precedence when present. The launcher and Agent must use the same effective secret.

## Demo user access

Demo-user permissions are configured on the **golden WordPress template**, because WordPress is the authoritative source for installed roles, capabilities and plugin admin menus.

Open **Settings → DemoPress Agent → Demo user access** and configure:

- **Baseline role** — the WordPress role whose normal product capabilities should be copied into the disposable demo role.
- **Admin menu restriction** — optionally enable a top-level admin-area whitelist.
- **Allowed admin areas** — choose the WordPress/plugin menus visitors should be able to access.

Plugin menu items are discovered from the golden template, so install and activate the product before configuring the whitelist.

When a disposable demo is created, DemoPress builds a dedicated `demopress_demo_admin` role from the selected baseline. It then removes platform-dangerous capabilities such as plugin/theme installation or editing, WordPress core updates and user administration. The temporary user is assigned to this generated role rather than being made a normal Administrator.

The Agent enforces the selected menu policy in disposable-demo mode, while a clone-side MU security guard blocks DemoPress platform settings and dangerous WordPress platform URLs even if the baseline role is broad.

The access policy is stored in the golden WordPress database, so it automatically travels with snapshot exports.

## Visitor capture

Visitor capture is independent of email delivery. In **Manager → Visitor Capture** you can configure Name, Email, Company and Website individually as:

- Off
- Optional
- Required

Captured values are stored against the demo for Manager/analytics use whether or not an email service is configured.

If Resend is configured and an email address was supplied, DemoPress can send the ready demo URL, temporary credentials and one-click Admin link when provisioning completes. Email-delivery failures are recorded but do not turn a working demo into a failed demo.

## Golden-template and snapshot workflow

The recommended operating workflow is:

1. Make product/content changes on the permanent template WordPress site.
2. Configure DemoPress Agent secret and demo-user access policy.
3. Validate the golden template in Manager.
4. Export a candidate snapshot.
5. Run isolated validation against that candidate.
6. Inspect validation diagnostics if it fails; a failed or untested candidate should not be used for public demos.
7. Promote the candidate after validation passes.
8. Assign the validated snapshot to the appropriate Demo Preset.
9. Launch a test and confirm the public site, WordPress Admin, role restrictions and required product features.
10. Use the public launcher after the promoted snapshot and preset have been verified.

Publishing/exporting a snapshot does not itself make it trusted for public use. Snapshot validation and promotion are deliberate release steps. Template WordPress content remains persistent across normal redeployments.

## Demo Presets

A single DemoPress installation can expose multiple configured demo experiences. Presets can select a validated snapshot, required plugins/theme, start path, lifetime limits and whether the preset is enabled/default. Existing installations retain a backwards-compatible `default` preset.

The public launcher supports `?preset=<slug>` and shows a selector when multiple presets are enabled.

## Demo Experience

Manager includes product-neutral Demo Experience controls for disposable environments. These can provide temporary-demo context such as a toolbar, expiry information, documentation/product links and optional WordPress notice suppression without modifying the demonstrated product configuration.

## Profiles and themes

To add another product deployment, create a product-neutral profile and optional launcher theme:

- `profiles/<name>.json`
- `themes/<name>/theme.json`
- `themes/<name>/theme.css`

A starter theme is available under `themes/template`.

Deploy with:

```env
DEMOPRESS_PROFILE=<name>
DEMOPRESS_THEME=<name>
```

Product files themselves are carried by snapshots rather than separate runtime images.

## Manager authentication and security

`/manage` uses a dedicated DemoPress sign-in page backed by the configured Manager password and a signed session cookie. Manager write actions are protected by authentication, CSRF validation and same-origin checks.

Use HTTPS for both launcher and template domains. Keep Manager, Agent, database and mail-provider credentials in deployment secrets rather than profile JSON or source control.

## Useful checks

Before considering a deployment complete, verify:

- Template validation passes.
- Agent secret is configured.
- Demo user baseline role and allowed menus are intentional.
- The intended snapshot has passed isolated validation and has been promoted.
- Public presets reference the intended validated snapshot.
- A test demo reaches **Ready** only after clone finalisation succeeds.
- Public demo URL works through HTTPS.
- One-click Admin signs in as the generated DemoPress demo role.
- Protected WordPress platform areas return access denied for the demo user.
- Visitor-capture requirements match your privacy/lead-capture policy.
- Resend delivery works if enabled.
- Manager diagnostics show no unexpected orphan resources.

## Runtime image

DemoPress intentionally uses one generic runtime image. Product-specific plugins, themes, uploads and database state come from snapshots. Avoid maintaining separate product-specific DemoPress runtime repositories or images unless you have a specific infrastructure reason to do so.
