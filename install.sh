#!/bin/sh
set -eu
echo "DemoPress 1.0-RC installer"
echo "=========================="
command -v docker >/dev/null 2>&1 || { echo "Docker is required."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 is required."; exit 1; }
[ -f .env ] || { cp .env.example .env; echo "Created .env"; }
mkdir -p data
[ -f data/profile.json ] || { cp config/profile.example.json data/profile.json; echo "Created data/profile.json"; }
echo "Next:"
echo "1. Edit .env domains/secrets."
echo "2. docker build --no-cache -t demopress-wordpress:latest ./demo"
echo "3. Deploy launcher."
echo "4. Install/configure DemoPress Agent on template."
echo "5. Open /manage/setup."
