#!/bin/bash
set -euo pipefail
IMAGE="${DEMO_IMAGE:-demopress-wordpress:1.0}"
docker build --no-cache -t "$IMAGE" ./demo
docker images "$IMAGE"
