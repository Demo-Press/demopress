# Installing DemoPress

## DNS

Create records pointing at the VPS:

- `demo.example.com`
- `*.demo.example.com`
- `template.demo.example.com`

The wildcard record is required for disposable demo hosts.

## Coolify

Deploy the repository as a Docker Compose application.

Important:
- mount Docker socket
- persist `/data`
- attach the launcher to the same Docker network as the Traefik/Coolify proxy
- expose launcher port 3000 through your chosen launcher domain

Copy `.env.example` and set:
- DOMAIN
- TEMPLATE_DOMAIN
- ADMIN_PASSWORD
- INTERNAL_TEMPLATE_TOKEN
- COOLIFY_NETWORK

## Demo image

On the deployment VPS:

```bash
git clone <your-demoPress-repository> /opt/demopress
cd /opt/demopress
docker build --no-cache -t demopress-wordpress:latest ./demo
```

The launcher creates disposable WordPress containers from this local image.

## Golden template

Create a normal WordPress site at your configured template domain. Build it exactly as visitors should receive it.

Install the `demopress-agent` plugin from this repository and configure:
- mode: Golden template
- DemoPress launcher URL
- template token

Then use DemoPress Manager → Template → Validate & Publish Snapshot.
