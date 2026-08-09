# DemoPress Profile

DemoPress behavior is controlled by a JSON profile. By default the launcher looks for:

1. `PROFILE_PATH`
2. `/data/profile.json`
3. `config/profile.json`
4. `config/profile.example.json`

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
