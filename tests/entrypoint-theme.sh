#!/bin/sh
set -eu

ROOT=$(CDPATH='' cd -- "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT INT TERM

mkdir -p "$TMP/bin" "$TMP/archive/repository/themes/wpraffle" "$TMP/archive/repository/profiles"
printf '{"name":"WPRaffle"}\n' > "$TMP/archive/repository/themes/wpraffle/theme.json"
printf 'body { color: red; }\n' > "$TMP/archive/repository/themes/wpraffle/theme.css"
printf '{"productName":"WPRaffle"}\n' > "$TMP/archive/repository/profiles/wpraffle.json"
tar -czf "$TMP/theme.tar.gz" -C "$TMP/archive" repository

cat > "$TMP/bin/curl" <<'EOF'
#!/bin/sh
set -eu
if [ "${TEST_DOWNLOAD:-success}" = "failure" ]; then
  exit 22
fi
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--output" ]; then
    cp "$TEST_ARCHIVE" "$2"
    exit 0
  fi
  shift
done
exit 2
EOF

cat > "$TMP/bin/node" <<'EOF'
#!/bin/sh
printf '%s\n%s\n' "$DEMOPRESS_THEME" "$DEMOPRESS_PROFILE" > "$TEST_RESULT"
EOF
chmod +x "$TMP/bin/curl" "$TMP/bin/node"

run_entrypoint() {
  PATH="$TMP/bin:$PATH" \
  DEMOPRESS_THEME=wpraffle \
  DEMOPRESS_THEME_URL='https://example.invalid/themes/{ref}' \
  DEMOPRESS_THEME_ROOT="$TMP/runtime" \
  DEMOPRESS_THEME_CACHE_ROOT="$TMP/cache" \
  DEMOPRESS_PROFILE=wpraffle \
  DEMOPRESS_PROFILE_ROOT="$TMP/profile-runtime" \
  DEMOPRESS_PROFILE_CACHE_ROOT="$TMP/profile-cache" \
  TEST_ARCHIVE="$TMP/theme.tar.gz" \
  TEST_RESULT="$TMP/result" \
  TEST_DOWNLOAD="$1" \
  sh "$ROOT/launcher/entrypoint.sh"
}

run_entrypoint success
test "$(sed -n '1p' "$TMP/result")" = wpraffle
test "$(sed -n '2p' "$TMP/result")" = wpraffle
test -f "$TMP/cache/wpraffle/theme.json"
test -f "$TMP/profile-cache/wpraffle.json"
test -f "$TMP/profile-runtime/wpraffle.json"

rm -rf "$TMP/runtime" "$TMP/profile-runtime"
run_entrypoint failure
test "$(sed -n '1p' "$TMP/result")" = wpraffle
test "$(sed -n '2p' "$TMP/result")" = wpraffle
test -f "$TMP/runtime/wpraffle/theme.json"
test -f "$TMP/profile-runtime/wpraffle.json"

rm -rf "$TMP/runtime" "$TMP/cache" "$TMP/profile-runtime" "$TMP/profile-cache"
run_entrypoint failure
test "$(sed -n '1p' "$TMP/result")" = default
test "$(sed -n '2p' "$TMP/result")" = default

echo "External launcher theme fallback tests passed."
