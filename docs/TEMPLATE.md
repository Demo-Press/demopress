# Golden Template Workflow

The golden template is an ordinary WordPress site that you control.

1. Install/configure the plugins and theme you want visitors to see.
2. Arrange WordPress Dashboard widgets using the template administrator account.
3. Install DemoPress Agent.
4. Configure the Agent as a Golden template.
5. Set the same token as `INTERNAL_TEMPLATE_TOKEN`.
6. Add required plugin files and required theme to the DemoPress profile.
7. Manager → Template → Validate.
8. Publish Snapshot.
9. Launch Test From Snapshot.
10. When satisfied, use the public launcher.

Each disposable demo receives:
- database snapshot
- uploads snapshot
- plugin/theme file snapshot
- template administrator dashboard/UI preferences
- a fresh restricted demo user
- its own MariaDB container
- its own WordPress container
- a unique wildcard hostname
