#!/bin/sh
set -eu
printf 'ADMIN_PASSWORD=%s
' "$(openssl rand -base64 36 | tr -d '
')"
printf 'INTERNAL_TEMPLATE_TOKEN=%s
' "$(openssl rand -hex 32)"
printf 'TEMPLATE_DB_PASSWORD=%s
' "$(openssl rand -hex 24)"
printf 'TEMPLATE_DB_ROOT_PASSWORD=%s
' "$(openssl rand -hex 24)"
