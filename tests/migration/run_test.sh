#!/usr/bin/env bash
# Thử script deploy/self-host/migrate/migrate.sh trên Postgres cục bộ:
#   sb_src = mô phỏng Supabase Cloud (có dữ liệu thật qua các RPC), sb_dst = mô phỏng DB tự host mới (GoTrue khác phiên bản)
# Sau khi chuyển: chạy PostgREST trên sb_dst và gọi API như web app (anon, khách, admin).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$(cd "$HERE/../.." && pwd)"
PGH=${PGHOST:-/var/tmp/pgtest}; PGP=${PGPORT:-5439}
P=(psql -X -q -v ON_ERROR_STOP=1 -h "$PGH" -p "$PGP" -U postgres)
M="$ROOT/deploy/self-host/migrate/migrate.sh"
url() { echo "postgresql://postgres@/$1?host=$PGH&port=$PGP"; }

"${P[@]}" -d postgres -c "do \$\$ begin
  create role anon nologin; exception when duplicate_object then null; end \$\$;" \
  -c "do \$\$ begin create role authenticated nologin; exception when duplicate_object then null; end \$\$;" \
  -c "do \$\$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end \$\$;" \
  -c "do \$\$ begin create role authenticator login noinherit; exception when duplicate_object then null; end \$\$;" \
  -c "grant anon, authenticated, service_role to authenticator"
for db in sb_src sb_dst; do "${P[@]}" -d postgres -c "drop database if exists $db with (force)" -c "create database $db"; done
"${P[@]}" -d sb_src -v dst_variant=0 -f "$HERE/supabase_base.sql"
"${P[@]}" -d sb_dst -v dst_variant=1 -f "$HERE/supabase_base.sql"

echo "── Dựng DB nguồn (schema dự án + dữ liệu qua RPC)"
DST_DB_URL=$(url sb_src) "$M" schema >/dev/null
"${P[@]}" -d sb_src -f "$HERE/seed_source.sql" >/dev/null

export SRC_DB_URL=$(url sb_src) DST_DB_URL=$(url sb_dst) DST_ADMIN_DB_URL=$(url sb_dst) YES=1
echo; echo "════ migrate.sh check (đích trống)"; "$M" check
echo; echo "════ migrate.sh schema";  "$M" schema
echo; echo "════ migrate.sh check";   "$M" check
echo; echo "════ migrate.sh data";    "$M" data
echo; echo "════ migrate.sh verify";  "$M" verify
echo; echo "════ chạy lại data + verify (idempotent)"; "$M" data >/dev/null && "$M" verify | tail -1

echo; echo "════ Gọi API trên DB đích qua PostgREST (như web app)"
CONF=$(mktemp)
cat > "$CONF" <<CONF
db-uri = "postgres://authenticator@/sb_dst?host=$PGH&port=$PGP"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "migration-test-secret-with-at-least-32-characters!!"
server-port = 3012
server-host = "127.0.0.1"
CONF
PGRST=${PGRST_BIN:-postgrest}
python3 "$ROOT/tests/e2e/killport.py" 3012 >/dev/null 2>&1 || true
("$PGRST" "$CONF" > /tmp/pgrst-migration.log 2>&1 &)
sleep 2
python3 - <<'PY'
import json, time, urllib.request, jwt, datetime
SECRET = 'migration-test-secret-with-at-least-32-characters!!'
B = 'http://127.0.0.1:3012'
def tok(sub):
    return jwt.encode({'sub': sub, 'role': 'authenticated', 'aud': 'authenticated', 'exp': int(time.time()) + 600}, SECRET, algorithm='HS256')
def call(method, path, token=None, body=None):
    req = urllib.request.Request(B + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Content-Type': 'application/json', **({'Authorization': 'Bearer ' + token} if token else {})})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read() or 'null')
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or 'null')
ok = lambda cond, msg: print(('  ✓ ' if cond else '  ✗ ') + msg) or cond
A, ADMIN = 'aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001'
res = []
s, d = call('GET', '/services?select=name')
res.append(ok(s == 200 and len(d) == 4, f'Khách vãng lai xem bảng giá: {len(d)} dịch vụ'))
s, d = call('GET', '/appointments?select=id')
res.append(ok(d == [], 'Khách vãng lai KHÔNG đọc được lịch hẹn (RLS)'))
s, d = call('GET', '/appointments?select=booking_code,status', tok(A))
res.append(ok(s == 200 and len(d) == 2, f'Khách A đăng nhập thấy đúng {len(d)} lịch của mình'))
s, d = call('POST', '/rpc/my_vouchers', tok(A), {})
res.append(ok(s == 200 and len(d) == 1 and d[0]['percent_off'] == 10, 'Khách A vẫn có mã quà lần sau'))
s, d = call('GET', '/appointments?select=id', tok(ADMIN))
res.append(ok(s == 200 and len(d) == 4, f'Admin thấy tất cả {len(d)} lịch'))
day = (datetime.date.today() + datetime.timedelta(days=4)).isoformat()
s, d = call('POST', '/rpc/get_available_slots', None, {'p_service_id': '11111111-0000-0000-0000-000000000002', 'p_staff_id': None, 'p_date': day})
res.append(ok(s == 200 and len(d) > 0, f'Tra giờ trống: {len(d)} khung'))
s, d = call('POST', '/rpc/book_appointment', tok(A), {'p_service_id': '11111111-0000-0000-0000-000000000002', 'p_staff_id': None, 'p_date': day,
            'p_time': d[0]['slot_time'], 'p_name': 'Nguyễn Thị A', 'p_phone': '0901111112', 'p_email': '', 'p_notes': ''})
res.append(ok(s == 200 and d[0]['booking_code'], f'Khách A đặt lịch mới trên hệ thống mới: mã {d[0].get("booking_code") if s == 200 else d}'))
import sys; sys.exit(0 if all(res) else 1)
PY
"${P[@]}" -d sb_dst -c "insert into auth.users (id, aud, role, email, raw_user_meta_data) values (gen_random_uuid(), 'authenticated', 'authenticated', 'moi@test.vn', '{\"name\":\"Khách Mới\"}')"
[ "$("${P[@]}" -d sb_dst -At -c "select count(*) from customers where email = 'moi@test.vn'")" = 1 ] && echo "  ✓ Đăng ký tài khoản mới trên hệ thống mới vẫn tự tạo hồ sơ khách" || { echo "  ✗ Trigger tạo khách không chạy"; exit 1; }
python3 "$ROOT/tests/e2e/killport.py" 3012 >/dev/null 2>&1 || true
echo "HOÀN TẤT"
