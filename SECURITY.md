# Security Policy

## Supported versions

DemoPress 1.0.x is the supported stable release line. Security fixes are applied to the latest 1.0.x release unless a newer supported release line is announced here.

## Reporting a vulnerability

Please do not disclose exploitable security vulnerabilities in a public issue or discussion.

Before the public v1 launch, repository owners should enable **GitHub Private Vulnerability Reporting** under **Settings → Security → Code security and analysis**. Once enabled, use the repository's **Security → Report a vulnerability** flow.

If private vulnerability reporting is temporarily unavailable, contact the project owner privately and provide a concise description, affected component/version, reproduction details and potential impact. Do not include real deployment credentials.

We aim to acknowledge credible reports promptly, reproduce them, assess severity and coordinate a fix before public disclosure.

## Deployment security

DemoPress is a high-trust control plane. The launcher requires access to `/var/run/docker.sock`, which is effectively root-equivalent access to the Docker host. Run DemoPress on a dedicated VPS or other appropriately isolated host; do not expose the Docker API over TCP and do not colocate unrelated sensitive workloads.

Use HTTPS for launcher, template and disposable demo hosts. Generate unique Manager, Agent and database credentials for every deployment and keep them in deployment secrets rather than source control.

See [docs/SECURITY.md](docs/SECURITY.md) for the detailed security model and operational guidance.
