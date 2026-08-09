# Diagnostic Pass

Adds millisecond-level provisioning events, SQL import progress, WordPress container timings, finaliser sub-step timings, active HTTPS checks, cleaned Docker logs, and a Copy Diagnostic Log / plain-text diagnostic endpoint.

Deployment for this release:
- GitHub update
- Coolify redeploy (launcher changes)
- VPS git pull
- rebuild `demopress-demo-wp:latest` (demo finaliser changed)
