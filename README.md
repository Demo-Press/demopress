# DemoPress

**Self-hosted disposable WordPress demos.**

DemoPress turns a maintained WordPress template into isolated, temporary product demos. Each launch receives its own WordPress and MariaDB containers, temporary restricted WordPress access, a wildcard hostname and automatic expiry.

DemoPress 1.0 is designed for plugin/theme vendors and WordPress product teams that want a real interactive demo environment without giving visitors access to a shared installation.

[Website](https://demopress.co.uk) · [Hosted DemoPress Cloud](https://cloud.demopress.co.uk) · [Installation](docs/INSTALL.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md) · [Roadmap](ROADMAP.md)

## What DemoPress provides

- **Golden-template workflow** — maintain one persistent WordPress source of truth.
- **Validated snapshots** — export candidate snapshots, test them in isolation and promote only known-good snapshots.
- **Disposable isolation** — separate WordPress and MariaDB containers per demo.
- **Controlled WordPress Admin** — generated restricted demo roles rather than normal Administrator accounts.
- **Demo Presets** — expose multiple demo experiences from one DemoPress installation.
- **Visitor capture** — Name, Email, Company and Website can independently be Off, Optional or Required.
- **Optional email delivery** — Resend can send ready-demo details without being required for provisioning.
- **Manager** — responsive control plane for demos, snapshots, presets, analytics, configuration and diagnostics.
- **Automatic lifecycle** — readiness checks, rate limits, expiry, destruction and orphan-resource reconciliation.
- **Product-neutral core** — profiles define product requirements while launcher themes control presentation.

## Architecture

```text
                    ┌────────────────────┐
                    │ Golden WordPress   │
                    │     template       │
                    └─────────┬──────────┘
                              │
                       export / validate
                              │
                              ▼
                    ┌────────────────────┐
Visitor ──────────► │ DemoPress launcher │ ◄──────── Manager
                    └─────────┬──────────┘
                              │
                         disposable demo
                              │
                    ┌─────────┴──────────┐
                    │                    │
               WordPress             MariaDB
               container             container
```

Snapshot contents include the database, captured WordPress content/plugins/themes, optional uploads and a manifest. Product-specific files come from the validated snapshot rather than a product-specific DemoPress runtime image.

## Core and Cloud

This repository is **DemoPress Core**: the open, self-hosted runtime for one deployment. [DemoPress Cloud](https://cloud.demopress.co.uk) is a separate hosted control plane that provisions and operates Core installations for customers. Billing, customer accounts and infrastructure-provider credentials intentionally remain outside Core.

## Requirements

DemoPress is intended for a Linux Docker host. You need:

- Docker Engine and Docker Compose v2;
- wildcard DNS for disposable demo hostnames;
- HTTPS for launcher, template and wildcard demo domains;
- a reverse proxy network reachable by the launcher and disposable demos;
- persistent storage for DemoPress state and the golden-template WordPress/database volumes;
- sufficient memory for the configured number of concurrent WordPress/MariaDB pairs.

Coolify is supported directly, but DemoPress remains a standard Docker Compose application.

> [!WARNING]
> DemoPress requires access to `/var/run/docker.sock`. Docker socket access is effectively root-equivalent host access. Run DemoPress on an appropriately isolated host, preferably a dedicated VPS, and never expose the Docker API over unauthenticated TCP. Read [SECURITY.md](SECURITY.md) before deployment.

## Quick start

```bash
git clone https://github.com/Demo-Press/demopress.git
cd demopress
./install.sh
```

The installer creates a local `.env` from `env/demopress.env.example` and a local profile file when they do not already exist.

Generate deployment secrets:

```bash
./scripts/generate-secrets.sh
```

Replace every `CHANGE-ME` value in `.env`, configure your domains/network, then validate Compose before deployment:

```bash
docker compose config
docker compose up -d --build
```

For the complete production workflow, including DNS, golden-template setup, DemoPress Agent configuration, snapshot validation and promotion, follow [docs/INSTALL.md](docs/INSTALL.md).

## Release workflow for a demo product

1. Configure the persistent golden-template WordPress site with the product, content and settings visitors should receive.
2. Keep **DemoPress Agent** active and configure the demo-user access policy.
3. Complete **Manager → Setup** and confirm the required plugin/theme inventory.
4. Run **Manager → Template → Validate**.
5. Export a candidate snapshot.
6. Run isolated snapshot validation / Administrator Test.
7. Promote a passing snapshot.
8. Assign it to the intended Demo Preset.
9. Launch a public test and verify frontend, one-click Admin, permissions and expiry.

Publishing a candidate snapshot does not make it trusted for public use. Validation and promotion are deliberate release gates.

## Profiles and launcher themes

`DEMOPRESS_PROFILE` selects product requirements and copy from `profiles/<name>.json`. Manager-saved profile customisations persist in `/data/profile.json`.

`DEMOPRESS_THEME` selects the customer-facing launcher theme. Bundled themes live under `themes/<name>/`; `themes/template` is a starter. Launcher branding is independent of the WordPress theme restored into disposable demos.

External/private launcher themes are supported with `DEMOPRESS_THEME_URL`, optional `DEMOPRESS_THEME_REF` and `DEMOPRESS_THEME_TOKEN`. Tokens belong only in deployment secrets and are sent through the Authorization header rather than embedded in URLs.

## Documentation

- [Installation](docs/INSTALL.md)
- [Golden template workflow](docs/TEMPLATE.md)
- [Profiles](docs/PROFILE.md)
- [Setup Wizard](docs/SETUP-WIZARD.md)
- [Diagnostics](docs/DIAGNOSTICS.md)
- [Lifecycle and cleanup](docs/CLEANUP.md)
- [Detailed security model](docs/SECURITY.md)
- [UI coverage](docs/UI-PAGES.md)
- [Release checklist](docs/RELEASE-CHECKLIST.md)

The public documentation site at [demopress.co.uk](https://demopress.co.uk) tracks the same stable 1.0 deployment model.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security vulnerabilities must not be reported through public issues; follow [SECURITY.md](SECURITY.md).

## Licence

DemoPress is released under the [MIT License](LICENSE).
