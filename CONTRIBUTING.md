# Contributing to DemoPress

Thanks for helping improve DemoPress. The project prioritises safe disposable WordPress environments, predictable upgrades and a small product-neutral core.

## Before opening a change

- Search existing issues and pull requests first.
- Keep product-specific branding and commercial assets outside the DemoPress core repository.
- Treat changes touching Docker lifecycle, authentication, snapshots, temporary credentials or WordPress permissions as security-sensitive.
- Do not commit real deployment credentials, access tokens, customer data or generated snapshots.

## Development checks

Before opening a pull request, run the checks that apply to your change:

```bash
find launcher/src -type f -name '*.js' -print0 | xargs -0 -n1 node --check
find demo/wp-content -type f -name '*.php' -print0 | xargs -0 -n1 php -l
find . -type f -name '*.sh' -not -path './.git/*' -print0 | xargs -0 -n1 sh -n
cp env/demopress.env.example .env
docker compose config --quiet
docker build -f launcher/Dockerfile -t demopress-launcher:local .
docker build -f demo/Dockerfile -t demopress-wordpress:1.0 demo
```

GitHub Actions repeats release-critical checks on pull requests.

## Pull requests

Keep PRs focused and describe:

- what changed;
- why it changed;
- security or deployment impact;
- how it was validated;
- whether documentation or environment examples changed.

Changes to public behaviour should update the relevant documentation in the same PR. Changes to the v1 deployment contract should also update `CHANGELOG.md` when appropriate.

## Security reports

Do not open public issues for exploitable vulnerabilities. Follow [SECURITY.md](SECURITY.md).

## Licence

By contributing, you agree that your contribution is provided under the repository's MIT licence.
