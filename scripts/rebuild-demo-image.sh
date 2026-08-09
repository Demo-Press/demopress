#!/bin/bash
set -euo pipefail
docker build --no-cache -t demopress-wordpress:latest ./demo
docker images demopress-wordpress:latest
