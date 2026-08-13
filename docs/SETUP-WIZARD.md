# Setup Wizard

The Manager setup flow prepares a DemoPress installation for its first public demo.

1. Product identity
2. Domains
3. Branding
4. Plugin/theme inventory
5. DNS and Agent readiness
6. Snapshot validation and go-live checks

The selected bundled profile comes from `profiles/<DEMOPRESS_PROFILE>.json`. Changes made through Manager are persisted in `/data/profile.json`, merged over the bundled profile, and read dynamically without restarting the launcher.

After setup, use **Manager → Template** to export a candidate snapshot, validate it with an isolated test, and promote the validated snapshot before assigning it to a public Demo Preset.
