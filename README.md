# DemoPress 1.0

One repository for generic and branded disposable WordPress demos.

## Core model

- One generic launcher/runtime codebase.
- `DEMOPRESS_THEME` selects launcher branding (`default`, `wpraffle`, or a future theme).
- `DEMOPRESS_PROFILE` selects required WordPress plugins/theme and product copy.
- A golden WordPress template is published as streamed `database.sql`, `content.tar.gz`, `uploads.tar.gz` and `manifest.json`.
- Every disposable WordPress demo receives its own MariaDB container.
- Docker resources are labelled with `com.demopress.instance=<DOMAIN>` so two DemoPress deployments on the same daemon cannot delete each other's demos.
- Automatic reconciliation reports unknown/orphan resources but never removes them automatically; manager-triggered cleanup is instance-scoped.
- The runtime image is `demopress-wordpress:1.0` for all products. The launcher can rebuild it from bundled source if Docker cleanup removes it.

## DemoPress Agent secret key

WordPress **Settings → DemoPress Agent** shows whether an effective secret exists and whether it comes from WordPress or the environment. The actual key is never shown; only a short SHA-256 fingerprint is displayed. You can keep, replace, generate, or clear the saved WordPress key. A blank replacement never destroys the existing key.

For deployment automation, set `INTERNAL_TEMPLATE_TOKEN` in the environment. The Agent's saved WordPress key takes precedence when present.

## Deploy twice from one Git repository

Create two Coolify applications pointing to the same repository and `docker-compose.yml`.

### Generic DemoPress
Copy values from `env/demopress.env.example` into the application's Environment Variables.

### WPRaffle
Copy values from `env/wpraffle.env.example`. This selects `DEMOPRESS_THEME=wpraffle` and `DEMOPRESS_PROFILE=wpraffle` while keeping the same code and runtime image.

Generate new secrets with:

```bash
./scripts/generate-secrets.sh
```

Do **not** reuse secrets shown in previous logs/chat.

## First deployment

1. Deploy the application.
2. Visit `https://template.<your-domain>/wp-admin/` and finish WordPress installation if needed.
3. For WPRaffle, install/configure WooCommerce, TeraWallet, WPRaffle and `wpraffle-theme` on the template site.
4. Ensure DemoPress Agent is active. Check Settings → DemoPress Agent; it should say **Secret key saved** if `INTERNAL_TEMPLATE_TOKEN` reaches WordPress.
5. Visit `/manage` on the launcher domain using Basic Auth (any username; `ADMIN_PASSWORD` is the password).
6. Open Template Manager and publish a snapshot.
7. Launch an administrator test demo.

## Adding another branded product

Add:

- `themes/<name>/theme.json`
- `themes/<name>/theme.css`
- `profiles/<name>.json`

Deploy with `DEMOPRESS_THEME=<name>` and `DEMOPRESS_PROFILE=<name>`.

## Important upgrade note

DemoPress 1.0 intentionally uses a generic runtime image. Do not retain separate `wpraffle-demo-wp:*` images or a separate WPRaffle DemoPress repository. Product files are carried by snapshots.
