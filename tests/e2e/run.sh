#!/bin/bash
# Rebuild app against local backend, reset DB, run E2E
set -e
E2E=$(cd "$(dirname "$0")" && pwd); ROOT=$(cd "$E2E/../.." && pwd)
cd "$ROOT"
export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=$(cat "$E2E/anon.key") NEXT_TELEMETRY_DISABLED=1
bash $E2E/setup_db.sh > /dev/null 2>&1; sleep 2
rm -rf "$ROOT/.next/cache/fetch-cache"
if [ "$1" != "--no-build" ]; then
  npx next build > $E2E/build.log 2>&1 || { tail -30 $E2E/build.log; exit 1; }
  python3 $E2E/killport.py 3300
  sleep 1
  nohup npx next start -p 3300 > $E2E/next.log 2>&1 &
  sleep 5
fi
cd "$E2E"
rm -rf fail; timeout 900 python3 test_e2e.py 2>&1 | sed -n '/==== SUMMARY/,$p'
