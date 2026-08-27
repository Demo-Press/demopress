#!/bin/sh
set -eu

echo "DemoPress 1.0 installer"
echo "======================="

command -v docker >/dev/null 2>&1 || { echo "Docker is required." >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 is required." >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "OpenSSL is required to generate deployment secrets." >&2; exit 1; }

if [ ! -f .env ]; then
  cp env/demopress.env.example .env
  echo "Created .env from env/demopress.env.example"
fi

mkdir -p data
if [ ! -f data/profile.json ]; then
  cp config/profile.example.json data/profile.json
  echo "Created data/profile.json"
fi

echo
echo "Generate strong deployment secrets with:"
echo "  ./scripts/generate-secrets.sh"
echo
echo "Next:"
echo "1. Edit .env and replace every CHANGE-ME value."
echo "2. Validate the configuration with: docker compose config"
echo "3. Build the v1 runtime with: docker build --no-cache -t demopress-wordpress:1.0 ./demo"
echo "4. Deploy docker-compose.yml."
echo "5. Configure DemoPress Agent on the golden template."
echo "6. Open /manage/setup and complete readiness checks."
