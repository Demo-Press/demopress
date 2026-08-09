#!/bin/sh
set -eu
TARGET="${1:-/data/profile.json}"
SOURCE="$(dirname "$0")/../config/profile.example.json"
if [ -e "$TARGET" ]; then
  echo "Profile already exists: $TARGET"
  exit 1
fi
mkdir -p "$(dirname "$TARGET")"
cp "$SOURCE" "$TARGET"
echo "Created DemoPress profile: $TARGET"
echo "Edit it before publishing your first template."
