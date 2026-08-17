# Installing DemoPress 1.0

DemoPress is designed for a Linux VPS running Docker. Coolify is supported directly, but the repository remains a standard Docker Compose application.

## 1. DNS

Create records pointing at the VPS/reverse proxy:

- `demo.example.com`
- `*.demo.example.com`
- `template.demo.example.com`

The wildcard record is required because every disposable environment receives a hostname such as `demo-a1b2c3d4.demo.example.com`.

## 2. Deploy one Compose application

Clone the repository and deploy its root `docker-compose.yml`:

```bash
git clone https://github.com/Demo-Press/demopress.git
cd demopress
```

For Coolify, create **one Docker Compose application** from this repository. The Compose file already defines:

- `launcher` — public launcher and Manager
- `template` — persistent golden-template WordPress
- `template-db` — persistent golden-template MariaDB

You do **not** create a second Coolify resource for the golden template.

The launcher needs access to `/var/run/docker.sock` and must join the same external Docker network as the reverse proxy so it can create routable disposable demo containers.

## 3. Configure environment variables

Use `env/demopress.env.example` as the canonical deployment example. At minimum configure:

```env
DOMAIN=demo.example.com
TEMPLATE_DOMAIN=template.demo.example.com
DEMOPRESS_THEME=default
DEMOPRESS_PROFILE=default

ADMIN_PASSWORD=replace-with-a-strong-manager-password
INTERNAL_TEMPLATE_TOKEN=replace-with-a-strong-random-secret
TEMPLATE_DB_PASSWORD=replace-with-a-random-password
TEMPLATE_DB_ROOT_PASSWORD=replace-with-a-different-random-password

DOCKER_NETWORK=coolify
DEMO_IMAGE=demopress-wordpress:1.0
AUTO_BUILD_DEMO_IMAGE=1
```

Generate suitable random values with:

```bash
./scripts/generate-secrets.sh
```

`ADMIN_PASSWORD`, `INTERNAL_TEMPLATE_TOKEN` and database passwords are secrets and must not be committed.

For the WPRaffle deployment, also configure the private launcher theme source:

```env
DEMOPRESS_PROFILE=wpraffle
DEMOPRESS_THEME=wpraffle
DEMOPRESS_THEME_URL=https://api.github.com/repos/Demo-Press/demopress-themes/tarball/{ref}
DEMOPRESS_THEME_REF=main
DEMOPRESS_THEME_TOKEN=
```

Store `DEMOPRESS_THEME_TOKEN` as a deployment secret. It must be a fine-grained GitHub token with read-only Contents access to `Demo-Press/demopress-themes`. Do not commit the token or include it in `DEMOPRESS_THEME_URL`. Generic deployments that use a bundled theme do not need these external-theme values.

The launcher listens on port 3000 inside its container. In Coolify, application routing should expose the service; a separate `PORT` environment variable is not required.

## 4. Runtime image

The supported disposable runtime image is:

```text
demopress-wordpress:1.0
```

With `AUTO_BUILD_DEMO_IMAGE=1`, DemoPress can build the bundled runtime image when it is missing. You normally do not need a separate product-specific runtime image because plugins, themes, uploads and database state come from published golden snapshots.

For manual maintenance you can rebuild the image with:

```bash
./scripts/rebuild-demo-image.sh
```

## 5. Persistent data

The Compose application persists:

- launcher database, settings and snapshots in the `demopress_data` volume
- golden WordPress files in `demopress_template_wp`
- golden MariaDB data in `demopress_template_db`

Normal redeployments must preserve these volumes. Editing the golden template and redeploying DemoPress is not a replacement for publishing a new snapshot.

## 6. First template boot

Open:

```text
https://template.demo.example.com/wp-admin/
```

Complete WordPress installation if required, then install and configure the product plugins, theme, content and settings that visitors should receive.

DemoPress Agent is included with the template runtime. Confirm it is active before continuing.

## 7. Configure DemoPress Agent

Open **WordPress → Settings → DemoPress Agent** and verify:

- template mode is active
- the canonical template URL is correct
- an effective Agent secret exists and matches `INTERNAL_TEMPLATE_TOKEN`
- the Demo user access baseline role is intentional
- any optional top-level WordPress Admin menu whitelist is configured after the product plugins are active

A WordPress-saved Agent secret takes precedence over the environment value when present. The full effective secret is never displayed.

## 8. Complete Setup in Manager

Open:

```text
https://demo.example.com/manage
```

DemoPress presents its dedicated Manager sign-in page. Sign in with `ADMIN_PASSWORD`.

Use **Manager → Setup** to review product identity, domains, branding, required plugin/theme inventory and readiness checks. Manager-saved profile settings persist in `/data/profile.json`.

## 9. Visitor capture and optional Resend

In **Manager → Visitor Capture**, Name, Email, Company and Website can each be Off, Optional or Required. Environment variables provide initial fallback defaults.

Resend delivery is optional and independent of visitor capture. When configured, DemoPress can email the ready demo URL, credentials, one-click Admin link and expiry information to a supplied visitor email address.

## 10. Publish, validate and test

The release workflow is:

1. Finish changes on the golden template.
2. Run **Manager → Template → Validate**.
3. Publish a candidate snapshot.
4. Run isolated snapshot validation / Administrator Test.
5. Promote a validated snapshot for public use.
6. Verify the public site, one-click Admin, restricted demo role, start page and diagnostics.
7. Only then expose the public launcher.

Presets can point at validated snapshots and override required components, start path and lifetime settings for different demo experiences.

## 11. Final checks

Before considering the deployment ready:

- Setup readiness is green.
- Template validation succeeds.
- Agent secret and demo-user policy are correct.
- A validated snapshot is active.
- Administrator Test reaches Ready.
- Wildcard demo URLs resolve through HTTPS.
- One-click Admin signs in as the restricted DemoPress role.
- Visitor Capture and Resend behaviour matches your policy.
- Manager Diagnostics reports no unexpected orphan resources.
