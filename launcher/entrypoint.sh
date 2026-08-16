#!/bin/sh
set -eu

THEME_NAME="${DEMOPRESS_THEME:-default}"
THEME_URL="${DEMOPRESS_THEME_URL:-}"
THEME_REF="${DEMOPRESS_THEME_REF:-main}"
THEME_TOKEN="${DEMOPRESS_THEME_TOKEN:-}"
THEME_ROOT="/app/themes"

# Optional runtime theme download. This keeps branded/private launcher themes
# outside the public DemoPress repository while preserving bundled themes as
# the default behaviour.
if [ -n "$THEME_URL" ]; then
  case "$THEME_NAME" in
    *[!A-Za-z0-9_-]*|'')
      echo "DemoPress: invalid DEMOPRESS_THEME value" >&2
      exit 1
      ;;
  esac

  target="$THEME_ROOT/$THEME_NAME"
  archive="$(mktemp)"
  staging="$(mktemp -d)"
  cleanup() { rm -f "$archive"; rm -rf "$staging"; }
  trap cleanup EXIT INT TERM

  # {ref} may be used in a generic archive URL, e.g. a GitHub tarball endpoint.
  url=$(printf '%s' "$THEME_URL" | sed "s/{ref}/$(printf '%s' "$THEME_REF" | sed 's/[&/]/\\&/g')/g")

  echo "DemoPress: downloading external launcher theme '$THEME_NAME'..."
  if [ -n "$THEME_TOKEN" ]; then
    curl --fail --silent --show-error --location \
      --header "Authorization: Bearer $THEME_TOKEN" \
      --header "Accept: application/vnd.github+json" \
      --output "$archive" "$url"
  else
    curl --fail --silent --show-error --location --output "$archive" "$url"
  fi

  # External themes are expected as .tar.gz/.tgz archives with a single
  # repository root directory (GitHub tarballs use this layout).
  tar -xzf "$archive" -C "$staging" --strip-components=1

  if [ ! -f "$staging/theme.json" ]; then
    echo "DemoPress: external theme archive does not contain theme.json at its root" >&2
    exit 1
  fi

  rm -rf "$target"
  mkdir -p "$target"
  cp -R "$staging"/. "$target"/
  echo "DemoPress: external launcher theme '$THEME_NAME' installed."
fi

exec node src/server.js
