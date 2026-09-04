#!/bin/sh
set -eu

THEME_NAME="${DEMOPRESS_THEME:-default}"
THEME_URL="${DEMOPRESS_THEME_URL:-}"
THEME_REF="${DEMOPRESS_THEME_REF:-main}"
THEME_TOKEN="${DEMOPRESS_THEME_TOKEN:-}"
THEME_ROOT="${DEMOPRESS_THEME_ROOT:-/app/themes}"
THEME_CACHE_ROOT="${DEMOPRESS_THEME_CACHE_ROOT:-/data/themes}"

use_cached_or_default_theme() {
  cached="$THEME_CACHE_ROOT/$THEME_NAME"
  target="$THEME_ROOT/$THEME_NAME"

  if [ -f "$cached/theme.json" ]; then
    rm -rf "$target"
    mkdir -p "$target"
    cp -R "$cached"/. "$target"/
    echo "DemoPress: using cached external launcher theme '$THEME_NAME'." >&2
    return
  fi

  echo "DemoPress: external launcher theme '$THEME_NAME' is unavailable; using bundled default theme." >&2
  DEMOPRESS_THEME=default
  export DEMOPRESS_THEME
}

# Optional runtime theme download. This keeps branded/private launcher themes
# outside the DemoPress repository while preserving bundled themes as the
# default behaviour.
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
    download_status=0
    curl --fail --silent --show-error --location \
      --header "Authorization: Bearer $THEME_TOKEN" \
      --header "Accept: application/vnd.github+json" \
      --output "$archive" "$url" || download_status=$?
  else
    download_status=0
    curl --fail --silent --show-error --location --output "$archive" "$url" || download_status=$?
  fi

  if [ "$download_status" -ne 0 ]; then
    echo "DemoPress: external launcher theme download failed (curl exit $download_status)." >&2
    use_cached_or_default_theme
    exec node src/server.js
  fi

  # GitHub tarballs contain one generated repository root. A shared themes
  # repository stores each theme at themes/<name>; a theme-only archive may
  # retain theme.json at its root for backwards compatibility.
  if ! tar -xzf "$archive" -C "$staging" --strip-components=1; then
    echo "DemoPress: external launcher theme archive is invalid." >&2
    use_cached_or_default_theme
    exec node src/server.js
  fi
  source_dir="$staging/themes/$THEME_NAME"
  if [ ! -f "$source_dir/theme.json" ] && [ -f "$staging/theme.json" ]; then
    source_dir="$staging"
  fi

  if [ ! -f "$source_dir/theme.json" ]; then
    echo "DemoPress: external archive does not contain themes/$THEME_NAME/theme.json or root theme.json." >&2
    use_cached_or_default_theme
    exec node src/server.js
  fi

  cache="$THEME_CACHE_ROOT/$THEME_NAME"
  cache_next="$THEME_CACHE_ROOT/.$THEME_NAME.next"
  mkdir -p "$THEME_CACHE_ROOT"
  rm -rf "$cache_next"
  mkdir -p "$cache_next"
  cp -R "$source_dir"/. "$cache_next"/
  rm -rf "$cache"
  mv "$cache_next" "$cache"

  rm -rf "$target"
  mkdir -p "$target"
  cp -R "$cache"/. "$target"/
  echo "DemoPress: external launcher theme '$THEME_NAME' installed."
fi

exec node src/server.js
