# DemoPress 1.0-rc

DemoPress is a self-hosted platform for disposable WordPress product demos.

Homepage/showcase: https://demopress.co.uk

This is the full **1.0-RC** build for end-to-end testing before final 1.0.

## RC features
- six-step graphical Setup Wizard
- persistent graphical Profile editor
- automatic plugin/theme inventory from DemoPress Agent
- plugin/theme selection
- branding URLs and public copy
- launcher/wildcard/template DNS readiness checks
- Agent connectivity checks
- first-run unconfigured screen
- install helper
- generic database/uploads/plugins/themes snapshots
- isolated WordPress/MariaDB demos
- one-click Admin
- reset, extend, expiry, destroy
- health monitoring and captured degradation logs
- responsive Manager
- diagnostics and audit trail

## Quick start
```bash
git clone <repository> demopress
cd demopress
./install.sh
docker build --no-cache -t demopress-wordpress:latest ./demo
```

Then deploy and open `/manage/setup`.


## Project links
Set `GITHUB_URL` in the environment. It drives the GitHub link shown in the public and Manager interfaces. The official product/showcase site is `https://demopress.co.uk`.
