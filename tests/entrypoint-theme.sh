#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT INT TERM

mkdir -p "$TMP/bin" "$TMP/archive/repository/themes/wpraffle"
printf '{"name":"WPRaffle"}\n' > "$TMP/archive/repository/themes/wpraffle/theme.json"
printf 'body { color: red; }\n' > "$TMP/archive/repository/themes/wpraffle/theme.css"
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
printf '%s\n' "$DEMOPRESS_THEME" > "$TEST_RESULT"
EOF
chmod +x "$TMP/bin/curl" "$TMP/bin/node"

run_entrypoint() {
  PATH="$TMP/bin:$PATH" \
  DEMOPRESS_THEME=wpraffle \
  DEMOPRESS_THEME_URL=https://example.invalid/themes/{ref} \
  DEMOPRESS_THEME_ROOT="$TMP/runtime" \
  DEMOPRESS_THEME_CACHE_ROOT="$TMP/cache" \
  TEST_ARCHIVE="$TMP/theme.tar.gz" \
  TEST_RESULT="$TMP/result" \
  TEST_DOWNLOAD="$1" \
  sh "$ROOT/launcher/entrypoint.sh"
}

run_entrypoint success
test "$(cat "$TMP/result")" = wpraffle
test -f "$TMP/cache/wpraffle/theme.json"

rm -rf "$TMP/runtime"
run_entrypoint failure
test "$(cat "$TMP/result")" = wpraffle
test -f "$TMP/runtime/wpraffle/theme.json"

rm -rf "$TMP/runtime" "$TMP/cache"
run_entrypoint failure
test "$(cat "$TMP/result")" = default

echo "External launcher theme fallback tests passed."
