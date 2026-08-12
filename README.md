# DemoPress 1.0

DemoPress is a self-hosted platform for creating private, disposable WordPress product demos from a maintained golden template.

## Core model

- One generic launcher/runtime codebase.
- `DEMOPRESS_THEME` selects launcher branding.
- `DEMOPRESS_PROFILE` selects required WordPress plugins/theme and product copy.
- A golden WordPress template is published as streamed `database.sql`, `content.tar.gz`, `uploads.tar.gz` and `manifest.json`.
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
7. Configure **Demo user access** in DemoPress Agent before publishing the template.
8. Visit `/manage` on the launcher domain. DemoPress presents its own Manager sign-in page; use `ADMIN_PASSWORD` to sign in.
9. Open **Template** in Manager, validate the golden template and publish a snapshot.
10. Launch an **Administrator Test** and verify the disposable site, temporary user and permitted WordPress areas.
11. When the test is healthy, make the public launcher available to visitors.

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

The access policy is stored in the golden WordPress database, so it automatically travels with the published snapshot.

## Visitor capture

Visitor capture is independent of email delivery. In **Manager → Visitor Capture** you can configure Name, Email, Company and Website individually as:

- Off
- Optional
- Required

Captured values are stored against the demo for Manager/analytics use whether or not an email service is configured.

If Resend is configured and an email address was supplied, DemoPress can send the ready demo URL, temporary credentials and one-click Admin link when provisioning completes. Email-delivery failures are recorded but do not turn a working demo into a failed demo.

## Golden-template workflow

The recommended operating workflow is:

1. Make product/content changes on the permanent template WordPress site.
2. Configure DemoPress Agent secret and demo-user access policy.
3. In DemoPress Manager, validate the template.
4. Publish a new golden snapshot.
5. Launch an Administrator Test.
6. Confirm the public site, WordPress Admin, role restrictions and required product features.
7. Keep that snapshot current until you intentionally publish another one.

Template WordPress content is persistent. Redeploying DemoPress should not be used as a substitute for publishing a new snapshot after product changes.

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

Product files themselves are carried by the published snapshot rather than separate runtime images.

## Manager authentication and security

`/manage` uses a dedicated DemoPress sign-in page backed by `ADMIN_PASSWORD` and a signed session cookie. Manager write actions are protected by authentication, CSRF validation and same-origin checks.

Use HTTPS for both launcher and template domains. Treat `ADMIN_PASSWORD`, `INTERNAL_TEMPLATE_TOKEN`, database passwords and any Resend API key as secrets.

## Useful checks

Before considering a deployment complete, verify:

- Template validation passes.
- Agent secret is configured.
- Demo user baseline role and allowed menus are intentional.
- A golden snapshot is current.
- Administrator Test reaches **Ready**.
- Public demo URL works through HTTPS.
- One-click Admin signs in as the generated DemoPress demo role.
- Protected WordPress platform areas return access denied for the demo user.
- Visitor-capture requirements match your privacy/lead-capture policy.
- Resend delivery works if enabled.

## Runtime image

DemoPress intentionally uses one generic runtime image. Product-specific plugins, themes, uploads and database state come from the golden snapshot. Avoid maintaining separate product-specific DemoPress runtime repositories or images unless you have a specific infrastructure reason to do so.
