# DemoPress Roadmap

DemoPress 1.0 is the stable baseline. This roadmap intentionally avoids promising dates and records the direction for post-1.0 work rather than unfinished v1 release tasks.

## 1.1 candidates

- Further Content Security Policy hardening by moving remaining inline assets to static files and adopting nonces or hashes where practical.
- Additional automated integration and lifecycle tests around provisioning, snapshot validation, reset and expiry.
- More deployment documentation for reverse proxies and Docker hosts outside Coolify.
- Expanded Manager observability and exportable analytics while preserving visitor privacy.
- Additional reusable Demo Experience controls that remain product-neutral.

## Longer-term considerations

- Pluggable infrastructure/runtime adapters where they can be introduced without weakening isolation.
- Improved multi-instance operational tooling.
- More automated backup/restore guidance for persistent DemoPress state and golden-template data.
- Broader notification integrations through clearly separated provider adapters.

Security fixes, data-integrity issues and regressions take priority over roadmap features.
