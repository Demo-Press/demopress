# DemoPress Security

DemoPress is a high-trust control plane because it creates and destroys Docker containers.

## Manager
- `/manage` uses HTTP Basic Authentication.
- Placeholder admin passwords are rejected.
- All Manager POST actions require a CSRF token.
- Manager and demo credential pages use `Cache-Control: no-store`.
- Administrative actions remain visible in the audit trail.

## Browser hardening
The launcher sends CSP, HSTS on HTTPS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, Cross-Origin-Opener-Policy and Cross-Origin-Resource-Policy.

The current server-rendered UI uses inline CSS/JavaScript, so CSP permits `'unsafe-inline'`. Moving those assets into static files with nonces/hashes is a post-1.0 hardening improvement.

## Template connection
DemoPress Agent template APIs require `INTERNAL_TEMPLATE_TOKEN`. Use at least 32 random bytes / 64 hex characters. Keep the value only in deployment secrets and the golden template.

## Docker socket
The launcher needs `/var/run/docker.sock`; Docker socket access is effectively root-equivalent host access. Run DemoPress on a dedicated VPS, do not colocate unrelated sensitive workloads, never expose Docker's API over TCP, restrict SSH/firewall access, and keep the host patched.

`no-new-privileges` is enabled, but it does not reduce the authority granted by the Docker socket.

## Demo isolation
Each demo receives separate WordPress and MariaDB containers, random DB credentials, a restricted temporary WordPress account, and a hard expiry. Plugin/theme/core modification, outgoing mail and common sensitive-file access are blocked.

## Public demo API
Reset and one-click-login endpoints are rate-limited. Login tokens are short-lived and one-use.

## Secrets
Never commit real `ADMIN_PASSWORD` or `INTERNAL_TEMPLATE_TOKEN` values. Do not place them in profile JSON or the public demopress.co.uk website.
