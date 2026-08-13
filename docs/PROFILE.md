# DemoPress Profile

DemoPress behavior is controlled by a JSON profile.

`DEMOPRESS_PROFILE` selects the bundled base profile from `profiles/<name>.json`. Manager-saved customisations are persisted in `/data/profile.json`, merged over the bundled profile and read dynamically so normal launcher redeployments keep the saved configuration.

DemoPress 1.0 also normalises older profiles where selected product components were stored only in the allowed plugin/theme fields so required-component Manager views remain consistent.

Important keys:

- `productName`: name shown to demo visitors
- `companyName`: vendor/company
- `homepageUrl`: vendor or DemoPress product homepage
- `launcherDomain`: public launcher host
- `templateDomain`: golden template host
- `tagline`: generic launch-page copy
- `requiredPlugins`: plugin files that must be active in the golden template
- `allowedPlugins`: intended product stack
- `requiredTheme`: stylesheet slug that must be active
- `allowedThemes`: intended theme allow-list
- `dashboardTips`: customer suggestions shown when a demo is ready
- `demoRoleName`: visible name of restricted demo role

Example:

```json
{
  "platformName": "DemoPress",
  "productName": "Acme Booking",
  "companyName": "Acme Ltd",
  "homepageUrl": "https://acme.example",
  "launcherDomain": "demo.acme.example",
  "templateDomain": "template.demo.acme.example",
  "requiredPlugins": [
    "acme-booking/acme-booking.php",
    "woocommerce/woocommerce.php"
  ],
  "allowedPlugins": [
    "acme-booking/acme-booking.php",
    "woocommerce/woocommerce.php"
  ],
  "requiredTheme": "acme-demo",
  "allowedThemes": ["acme-demo"],
  "dashboardTips": [
    "Create a new booking service.",
    "Try the customer booking flow.",
    "Review the plugin settings in WordPress Admin."
  ]
}
```

The golden snapshot also carries the template's plugin and theme files, so product-specific code is not baked into the DemoPress core image.

Demo Presets can select validated snapshots and apply per-demo required components, start path and lifetime settings without creating a separate DemoPress installation.
