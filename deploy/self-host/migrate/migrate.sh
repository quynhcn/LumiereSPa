#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Chuyển dữ liệu SpaFlow: Supabase Cloud  →  PostgreSQL tự host (supabase/postgres + GoTrue + PostgREST)
#
#   ./migrate.sh check     kiểm tra kết nối, so sánh cấu trúc 2 DB (không ghi gì)
#   ./migrate.sh backup    sao lưu toàn bộ DB nguồn ra file .dump (pg_dump, định dạng custom)
#   ./migrate.sh schema    tạo bảng/hàm/RLS trên DB đích bằng supabase/migrations/*.sql của dự án
#   ./migrate.sh data      XÓA dữ liệu cũ trên DB đích rồi chép: tài khoản (auth.users, auth.identities) + toàn bộ bảng public
#   ./migrate.sh verify    so số dòng + checksum từng bảng giữa 2 DB
#   ./migrate.sh all       check → backup → schema → data → verify
#
# Biến môi trường (đặt trong migrate/.env hoặc export trước khi chạy):
#   SRC_DB_URL        Supabase Cloud — Dashboard → Connect → "Session pooler" (IPv4), user postgres.<project-ref>
#   DST_DB_URL        DB mới, user postgres            (tạo schema, đọc để kiểm tra)
#   DST_ADMIN_DB_URL  DB mới, user supabase_admin      (chép dữ liệu: cần quyền tắt trigger/khóa ngoại tạm thời)
#
# Chỉ cần psql (≥ 14). Riêng "backup" cần pg_dump cùng phiên bản với Supabase (17) — nếu máy không có,
# script tự dùng Docker image postgres:17.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
[ -f "$HERE/.env" ] && set -a && . "$HERE/.env" && set +a

PSQL=(psql -X -q -v ON_ERROR_STOP=1)
AUTH_TABLES=(users identities)   # sessions / refresh tokens không chép: người dùng đăng nhập lại 1 lần
BACKUP_DIR="${BACKUP_DIR:-$HERE/backups}"

red() { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
bold() { printf '\033[1m%s\033[0m\n' "$*"; }
need() { [ -n "${!1:-}" ] || { red "Thiếu biến $1 (xem migrate/.env.example)"; exit 1; }; }

src() { "${PSQL[@]}" "$SRC_DB_URL" "$@"; }
dst() { "${PSQL[@]}" "$DST_DB_URL" "$@"; }
dsta() { "${PSQL[@]}" "${DST_ADMIN_DB_URL:-$DST_DB_URL}" "$@"; }

# Cột của bảng: $1=src|dst  $2=schema.table  $3=1 → chỉ cột ghi được (bỏ cột GENERATED)
columns() {
  local fn=$1 rel=$2 writable=${3:-0}
  "$fn" -At -c "select attname from pg_attribute
                where attrelid = to_regclass('$rel') and attnum > 0 and not attisdropped
                  $([ "$writable" = 1 ] && echo "and attgenerated = ''")
                order by attnum"
}

# Cột chung (theo thứ tự của DB đích), dạng "a","b","c"
common_columns() {
  local rel=$1 out=() s t
  mapfile -t S < <(columns src "$rel")
  mapfile -t T < <(columns dst "$rel" 1)
  for t in "${T[@]}"; do for s in "${S[@]}"; do [ "$t" = "$s" ] && out+=("\"$t\""); done; done
  (IFS=,; echo "${out[*]}")
}

public_tables() {
  dst -At -c "select tablename from pg_tables where schemaname = 'public' order by 1"
}

all_tables() {
  for t in "${AUTH_TABLES[@]}"; do echo "auth.$t"; done
  public_tables | sed 's/^/public./'
}

# ── check ────────────────────────────────────────────────────────────────────
cmd_check() {
  need SRC_DB_URL; need DST_DB_URL
  bold "1. Kết nối"
  printf '  Nguồn: %s\n' "$(src -At -c "select 'PostgreSQL ' || current_setting('server_version') || ' — ' || current_user")"
  printf '  Đích : %s\n' "$(dst -At -c "select 'PostgreSQL ' || current_setting('server_version') || ' — ' || current_user")"
  if [ -n "${DST_ADMIN_DB_URL:-}" ]; then
    printf '  Đích (admin): %s\n' "$(dsta -At -c "select current_user || case when rolsuper then ' (superuser)' else ' (KHÔNG phải superuser!)' end from pg_roles where rolname = current_user")"
  fi
  dst -At -c "select 1 from auth.users limit 0" >/dev/null 2>&1 || { red "  DB đích chưa có bảng auth.users — hãy chạy 'docker compose up -d' và đợi dịch vụ auth khởi động xong."; exit 1; }

  bold "2. Bảng public ở nguồn nhưng thiếu ở đích / cột bị thiếu"
  local problems=0 t rel missing
  if ! dst -At -c "select to_regclass('public.appointments') is not null" | grep -q t; then
    echo "  (Đích chưa có schema — chạy './migrate.sh schema' trước, rồi 'check' lại)"
  else
    while read -r t; do
      rel="public.$t"
      if [ -z "$(dst -At -c "select to_regclass('$rel')")" ]; then
        red "  ✗ Bảng $rel chỉ có ở nguồn"; problems=$((problems + 1)); continue
      fi
      missing=$(comm -23 <(columns src "$rel" | sort) <(columns dst "$rel" | sort) | paste -sd, -)
      [ -n "$missing" ] && { red "  ✗ $rel: đích thiếu cột $missing"; problems=$((problems + 1)); }
    done < <(src -At -c "select tablename from pg_tables where schemaname = 'public' order by 1")
    for t in "${AUTH_TABLES[@]}"; do
      missing=$(comm -23 <(columns src "auth.$t" | sort) <(columns dst "auth.$t" | sort) | paste -sd, -)
      [ -n "$missing" ] && echo "  ! auth.$t: đích không có cột $missing (phiên bản GoTrue khác — các cột này được bỏ qua)"
    done
    [ "$problems" = 0 ] && green "  ✓ Cấu trúc khớp" || { red "  $problems vấn đề: nguồn có thay đổi chưa nằm trong supabase/migrations. Thêm migration tương ứng rồi chạy lại."; exit 1; }
  fi

  bold "3. Số dòng ở nguồn"
  local n
  for t in "${AUTH_TABLES[@]}"; do printf '  %-28s %s\n' "auth.$t" "$(src -At -c "select count(*) from auth.$t")"; done
  while read -r t; do
    n=$(src -At -c "select count(*) from public.\"$t\"")
    printf '  %-28s %s\n' "public.$t" "$n"
  done < <(src -At -c "select tablename from pg_tables where schemaname = 'public' order by 1")
}

# ── backup ───────────────────────────────────────────────────────────────────
cmd_backup() {
  need SRC_DB_URL
  mkdir -p "$BACKUP_DIR"
  local file="$BACKUP_DIR/supabase-$(date +%Y%m%d-%H%M%S).dump"
  local major local_major
  major=$(src -At -c "select current_setting('server_version_num')::int / 10000")
  local_major=$(pg_dump --version 2>/dev/null | grep -oE '[0-9]+' | head -1 || echo 0)
  bold "Sao lưu DB nguồn (PostgreSQL $major) → $file"
  if [ "${local_major:-0}" -ge "$major" ]; then
    pg_dump "$SRC_DB_URL" -Fc --no-owner --no-privileges -f "$file"
  elif command -v docker >/dev/null; then
    docker run --rm -v "$BACKUP_DIR":/backup "postgres:$major" pg_dump "$SRC_DB_URL" -Fc --no-owner --no-privileges -f "/backup/$(basename "$file")"
  else
    red "Cần pg_dump $major (hoặc Docker). Cài postgresql-client-$major rồi chạy lại."; exit 1
  fi
  green "  ✓ $(du -h "$file" | cut -f1) — giữ file này cho tới khi hệ thống mới chạy ổn định"
}

# ── schema ───────────────────────────────────────────────────────────────────
cmd_schema() {
  need DST_DB_URL
  if dst -At -c "select to_regclass('public.appointments') is not null" | grep -q t; then
    if [ "${RESET:-0}" != 1 ]; then
      red "DB đích đã có schema SpaFlow. Muốn tạo lại từ đầu: RESET=1 ./migrate.sh schema (XÓA toàn bộ schema public)."; exit 1
    fi
    bold "RESET=1 → xóa schema public trên đích"
    dsta -c "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role; grant all on schema public to postgres;"
  fi
  bold "Chạy migration của dự án trên DB đích"
  local f
  for f in "$ROOT"/supabase/migrations/*.sql; do
    printf '  %s\n' "$(basename "$f")"
    dst -f "$f" 2>&1 | grep -v -E 'NOTICE|^$' || true
  done
  dst -c "notify pgrst, 'reload schema'"
  green "  ✓ Xong"
}

# ── data ─────────────────────────────────────────────────────────────────────
cmd_data() {
  need SRC_DB_URL; need DST_DB_URL
  local tables=() t rel cols
  mapfile -t tables < <(all_tables)
  if [ "${YES:-0}" != 1 ]; then
    read -r -p "Dữ liệu hiện có trên DB ĐÍCH (${#tables[@]} bảng, gồm tài khoản) sẽ bị XÓA và thay bằng dữ liệu nguồn. Gõ 'dong y' để tiếp tục: " ok
    [ "$ok" = "dong y" ] || { echo "Đã hủy."; exit 1; }
  fi

  bold "1. Xóa dữ liệu cũ trên đích"
  local list
  list=$(printf '%s,' "${tables[@]}"); list=${list%,}
  dsta -c "set session_replication_role = replica" -c "truncate $list cascade"

  bold "2. Chép dữ liệu (tạm tắt trigger & khóa ngoại để không sinh dữ liệu phụ, ví dụ trigger tạo khách khi thêm tài khoản)"
  for rel in "${tables[@]}"; do
    [ -n "$(src -At -c "select to_regclass('$rel')")" ] || { printf '  %-28s (không có ở nguồn — bỏ qua)\n' "$rel"; continue; }
    cols=$(common_columns "$rel")
    src -c "\\copy (select $cols from $rel) to pstdout" \
      | dsta -c "set session_replication_role = replica" -c "\\copy $rel ($cols) from pstdin"
    printf '  %-28s %s dòng\n' "$rel" "$(dst -At -c "select count(*) from $rel")"
  done

  bold "3. Đặt lại sequence"
  dsta -At -c "
    select format('select setval(%L, coalesce((select max(%I) from %I.%I), 0) + 1, false);', s.oid::regclass, a.attname, n.nspname, c.relname)
    from pg_class s
    join pg_depend d on d.objid = s.oid and d.deptype in ('a', 'i')
    join pg_class c on c.oid = d.refobjid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum = d.refobjsubid
    where s.relkind = 'S' and n.nspname = 'public'" | dsta -At >/dev/null
  dst -c "notify pgrst, 'reload schema'"
  green "  ✓ Xong. Chạy './migrate.sh verify' để đối chiếu."
}

# ── verify ───────────────────────────────────────────────────────────────────
cmd_verify() {
  need SRC_DB_URL; need DST_DB_URL
  bold "Đối chiếu số dòng + checksum nội dung (các cột chung, múi giờ UTC)"
  local bad=0 rel cols a b ca cb q
  printf '  %-28s %10s %10s  %s\n' "Bảng" "Nguồn" "Đích" "Nội dung"
  while read -r rel; do
    [ -n "$(src -At -c "select to_regclass('$rel')")" ] || continue
    cols=$(common_columns "$rel")
    q="select md5(coalesce(string_agg(r::text, '|' order by r::text), '')) from (select $cols from $rel) r"
    a=$(src -At -c "select count(*) from $rel"); b=$(dst -At -c "select count(*) from $rel")
    ca=$(src -At -c "set timezone = 'UTC'" -c "$q"); cb=$(dst -At -c "set timezone = 'UTC'" -c "$q")
    if [ "$a" = "$b" ] && [ "$ca" = "$cb" ]; then
      printf '  %-28s %10s %10s  ' "$rel" "$a" "$b"; green "khớp"
    else
      printf '  %-28s %10s %10s  ' "$rel" "$a" "$b"; red "KHÁC"; bad=$((bad + 1))
    fi
  done < <(all_tables)

  bold "Kiểm tra nghiệp vụ trên đích"
  dst -At -c "select '  Doanh thu đã thu (completed): ' || coalesce(sum(price), 0) from appointments where status = 'completed'"
  src -At -c "select '  (nguồn:                       ' || coalesce(sum(price), 0) || ')' from appointments where status = 'completed'"
  dst -At -c "select '  Trigger tạo khách khi đăng ký: ' || case when exists (select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and tgfoid = 'public.handle_new_user'::regproc) then 'có' else 'THIẾU' end"
  if [ "$bad" = 0 ]; then green "✓ Dữ liệu khớp hoàn toàn"; else red "✗ $bad bảng không khớp"; exit 1; fi
}

case "${1:-}" in
  check) cmd_check ;;
  backup) cmd_backup ;;
  schema) cmd_schema ;;
  data) cmd_data ;;
  verify) cmd_verify ;;
  all) cmd_check; cmd_backup; cmd_schema; cmd_check; cmd_data; cmd_verify ;;
  *) sed -n '2,20p' "$0"; exit 1 ;;
esac
