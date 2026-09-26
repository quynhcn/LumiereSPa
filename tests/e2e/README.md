# E2E tests (72 kịch bản)

Chạy toàn bộ luồng khách / nhân viên / admin / bảo mật trên **Postgres thật (RLS) + PostgREST**,
auth được giả lập bằng `gateway.py` (API giống Supabase Auth ở mức supabase-js cần).

Yêu cầu: PostgreSQL 15+ (psql), PostgREST 12, Python 3 + `pip install playwright psycopg2-binary pyjwt`, `playwright install chromium`.

1. Khởi động Postgres, đặt `PGHOST`/`PGPORT` nếu khác mặc định (`/var/tmp/pgtest`, `5439`), sửa `db-uri` trong `pgrst.conf` cho khớp.
2. `postgrest pgrst.conf &` và `python3 gateway.py &` (dòng đầu in ra anon key → lưu vào `anon.key`).
3. `./run.sh` — reset DB (chạy tất cả migration + seed), build app trỏ vào gateway, chạy `test_e2e.py`.
   `python3 overflow.py` kiểm tra tràn ngang trên mobile (390px).

Kết quả lần chạy cuối: **72/72 PASS**.

Gateway giả lập SMS OTP: mã luôn là `123456`. Bảng `auth.users` test có thêm cột `phone`, `phone_confirmed_at` giống Supabase.
