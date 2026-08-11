# DemoPress Theme Template

This directory is a starter for building a branded DemoPress launcher theme without changing the DemoPress application code.

## Create a theme

1. Copy `themes/template` to `themes/your-theme-name`.
2. Edit `theme.json` with your product name and links.
3. Edit the CSS variables at the top of `theme.css` to match your brand.
4. Add any optional component overrides below the variables.
5. Set the DemoPress theme configuration to `your-theme-name` and restart/redeploy the launcher.

Use a simple folder name containing letters, numbers, hyphens or underscores.

## theme.json

- `name` — product/theme name used by DemoPress.
- `brandLabel` — main text in the public header.
- `brandSubLabel` — highlighted secondary header text.
- `showStatusLink` — show or hide the DemoPress status link.
- `links.website` — product website.
- `links.docs` — product documentation.
- `links.github` — product GitHub repository.
- `meta.titleSuffix` — browser title suffix.
- `meta.description` — page meta description.

Links can be removed when they are not needed.

## Styling

DemoPress owns the page structure and responsive behaviour. Themes should normally customise design tokens rather than replace the entire layout.

The most important CSS variables are:

```css
:root {
  --bg: #f7f7f5;
  --fg: #111111;
  --muted: #686868;
  --line: #deded8;
  --brand: #111111;
  --panel: rgba(255,255,255,.68);
  --panel-solid: #ffffff;
  --radius: 20px;
  --radius-sm: 13px;
  --shadow: 0 18px 55px rgba(20,20,20,.07);
  --focus: 0 0 0 3px rgba(17,17,17,.12);
}
```

`theme.css` also contains a list of useful component selectors for more advanced branding.

## Keep themes upgrade-safe

Do not copy or modify `launcher/src/ui.js` for product branding. Keep product-specific presentation inside the theme directory so future DemoPress UI improvements continue to apply automatically.
