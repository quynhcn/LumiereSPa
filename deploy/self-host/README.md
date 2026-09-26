# Chuyển Lumière Spa từ Supabase Cloud sang PostgreSQL tự host

**Hướng làm:** chạy Supabase tự host (Postgres + GoTrue + PostgREST) trên máy chủ của mình. Code web app **không đổi**, chỉ đổi 2 biến môi trường. Tài khoản khách (kể cả mật khẩu) và toàn bộ dữ liệu được chuyển nguyên vẹn.

```
Trình duyệt ──► https://api.spaflow.vn (Caddy/nginx TLS) ──► gateway :8000 ─┬─ /auth/v1 → GoTrue  (đăng nhập email, SMS OTP)
                                                                           └─ /rest/v1 → PostgREST (API + RLS)
                                                                                         └─ Postgres 17 (supabase/postgres)
```

| Thư mục | Nội dung |
|---|---|
| `docker-compose.yml` | 4 container: `db`, `auth`, `rest`, `gateway`. Phiên bản image theo bản chính thức của Supabase (09/2026) |
| `nginx/default.conf.template` | Định tuyến `/auth/v1`, `/rest/v1` như Supabase; CORS chỉ cho domain web app |
| `scripts/gen-keys.mjs` | Sinh `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, mật khẩu DB |
| `migrate/migrate.sh` | Chuyển dữ liệu: `check` → `backup` → `schema` → `data` → `verify` |

Không đưa vào (web app không dùng): Studio, Realtime, Storage, Edge Functions, Analytics.

---

## Bước 1 — Dựng hệ thống mới (không ảnh hưởng hệ thống đang chạy)

Máy chủ gợi ý: Ubuntu 22.04+/24.04, 2 vCPU, 4 GB RAM, Docker + Docker Compose, Node 18+ (chỉ để sinh key), `psql` 14+.

```bash
cd deploy/self-host
cp .env.example .env
node scripts/gen-keys.mjs          # dán 4 dòng kết quả vào .env (POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY)
nano .env                          # SITE_URL, API_EXTERNAL_URL, SMTP, SMS
docker compose up -d
docker compose ps                  # 4 container "running"/"healthy"
curl http://localhost:8000/health              # ok
curl http://localhost:8000/auth/v1/health      # {"version":"v2.196.0",...}
```

**HTTPS:** trỏ `api.spaflow.vn` về máy chủ, đặt reverse proxy có TLS phía trước cổng 8000. Ví dụ với Caddy (tự lấy chứng chỉ):

```
api.spaflow.vn {
  reverse_proxy 127.0.0.1:8000
}
```

**SMS OTP** (đặt lịch không cần tài khoản), chọn 1 trong 2 cách:
- Twilio: điền `SMS_TWILIO_*` trong `.env`.
- Nhà cung cấp Việt Nam (eSMS, SpeedSMS…): bật `SMS_HOOK_ENABLED=true`, `SMS_HOOK_URI` = một endpoint HTTPS nhỏ nhận `{ user, sms: { otp } }` từ GoTrue rồi gọi API brandname; `SMS_HOOK_SECRETS` = khóa ký webhook (định dạng `v1,whsec_...`). Tài liệu: *Supabase → Auth Hooks → Send SMS Hook*.
- Chưa có nhà cung cấp: đặt `ENABLE_PHONE_SIGNUP=false`. Khách vẫn đăng nhập bằng email; đặt lịch bằng SĐT báo "Spa chưa bật xác minh qua SMS".
- Muốn thử không tốn tiền SMS: `SMS_TEST_OTP=84901234567:123456`.

## Bước 2 — Lấy thông tin kết nối

1. Supabase Dashboard → **Connect** → **Session pooler** → copy chuỗi kết nối (dạng `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres`). Mật khẩu là *Database password* (quên thì đặt lại ở Project Settings → Database).
2. Trên máy chủ mới:
   ```bash
   cd deploy/self-host/migrate
   cp .env.example .env && nano .env      # SRC_DB_URL, DST_DB_URL, DST_ADMIN_DB_URL
   chmod 600 .env
   ```

## Bước 3 — Diễn tập (không cần dừng hệ thống cũ)

```bash
./migrate.sh check     # kết nối 2 DB, số dòng từng bảng ở nguồn
./migrate.sh backup    # sao lưu Supabase ra migrate/backups/*.dump (pg_dump 17, tự dùng Docker nếu máy thiếu)
./migrate.sh schema    # tạo bảng/hàm/RLS trên DB mới từ supabase/migrations/*.sql
./migrate.sh check     # so cấu trúc: báo lỗi nếu Supabase có bảng/cột chưa nằm trong migration
./migrate.sh data      # chép dữ liệu (hỏi xác nhận, gõ: dong y)
./migrate.sh verify    # so số dòng + checksum từng bảng → "✓ Dữ liệu khớp hoàn toàn"
```

Sau đó dựng một bản web app **thử nghiệm** trỏ vào hệ thống mới:
```
NEXT_PUBLIC_SUPABASE_URL=https://api.spaflow.vn
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY trong deploy/self-host/.env>
```
Rồi kiểm tra các mục trong "Danh sách kiểm tra" bên dưới.

`data` chạy lại bao nhiêu lần cũng được: mỗi lần nó xóa dữ liệu trên DB mới rồi chép lại từ đầu.

## Bước 4 — Chuyển thật (dự kiến dừng 10–20 phút)

1. Chọn giờ vắng khách (ví dụ 22:00). Báo trước trên Zalo/fanpage; tạm ẩn nút đặt lịch nếu cần.
2. `./migrate.sh data && ./migrate.sh verify` để lấy dữ liệu mới nhất.
3. Đổi 2 biến môi trường của web app sang hệ thống mới (như bước 3) và deploy lại. Biến `NEXT_PUBLIC_*` được gắn vào lúc build, nên **phải build lại**, không chỉ restart.
4. Chạy danh sách kiểm tra.
5. **Không xóa project Supabase** trong 1–2 tuần. Có sự cố thì trả 2 biến môi trường về giá trị cũ và deploy lại là quay về hệ thống cũ. Dữ liệu phát sinh trên hệ thống mới trong thời gian đó cần chép tay.

Mọi người dùng phải **đăng nhập lại một lần**, vì phiên đăng nhập cũ ký bằng khóa của Supabase Cloud. Mật khẩu giữ nguyên.

## Danh sách kiểm tra sau khi chuyển

- [ ] Trang chủ hiện bảng giá, đội ngũ, đánh giá
- [ ] Đăng nhập email bằng một tài khoản khách cũ (mật khẩu cũ) → Tài khoản thấy lịch sử, mã quà
- [ ] Đặt lịch khi đã đăng nhập → thành công, lịch hiện ở admin
- [ ] Đặt lịch khách mới bằng SĐT + mã SMS
- [ ] Đăng nhập admin → Tổng quan, Lịch, Yêu cầu tư vấn, Ưu đãi & quà tặng
- [ ] Đổi giờ, hủy lịch, đánh giá qua link
- [ ] Form "Để lại SĐT" trên trang chủ → hiện trong admin

## Vận hành

**Sao lưu hằng ngày** (crontab của máy chủ):
```bash
0 3 * * * docker exec spaflow-db-1 pg_dump -U postgres -Fc postgres > /backup/spaflow-$(date +\%F).dump && find /backup -name 'spaflow-*.dump' -mtime +14 -delete
```
Khôi phục: `pg_restore -d <DST_ADMIN_DB_URL> --clean --if-exists file.dump`.

**Xem/sửa dữ liệu:** dùng DBeaver/pgAdmin qua SSH tunnel tới `127.0.0.1:5432`. Muốn có giao diện như Supabase Studio thì dùng bộ docker-compose đầy đủ của Supabase; script chuyển dữ liệu vẫn dùng được y hệt.

**Nhắc lịch tự động (ZNS/SMS):** Edge Function `supabase/functions/send-reminders` không nằm trong bộ tối giản này. Hàng đợi nhắc lịch thủ công trong admin vẫn hoạt động. Khi cần tự động, chạy function bằng `supabase/edge-runtime` hoặc chuyển thành cron job gọi API.

**Cập nhật về sau:** migration mới trong `supabase/migrations/` chạy bằng `psql "$DST_DB_URL" -f <file>.sql`, sau đó `psql "$DST_DB_URL" -c "notify pgrst, 'reload schema'"`.

## Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| `check` báo đích "thiếu cột …" | Trên Supabase có thay đổi làm tay (Dashboard) chưa có trong `supabase/migrations`. Viết migration cho thay đổi đó, rồi chạy `RESET=1 ./migrate.sh schema` |
| `data` báo `permission denied … session_replication_role` | `DST_ADMIN_DB_URL` phải dùng user `supabase_admin` (lệnh `check` ghi rõ "superuser") |
| `backup` báo lệch phiên bản pg_dump | Cài `postgresql-client-17` hoặc cài Docker (script tự dùng image `postgres:17`) |
| Web báo lỗi CORS | `SITE_URL` trong `.env` phải khớp chính xác domain web (có `https://`, không có `/` ở cuối). Sửa xong chạy `docker compose up -d gateway` |
| Đăng nhập báo "Invalid API key"/401 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` của web phải là `ANON_KEY` sinh cùng `JWT_SECRET` của hệ thống mới; build lại web |
| Container `auth` khởi động lỗi do cấu hình SMS | Tạm đặt `ENABLE_PHONE_SIGNUP=false`, cấu hình SMS xong bật lại |

## Script đã được kiểm thử thế nào

`tests/migration/run_test.sh` dựng 2 DB trên Postgres cục bộ:
- Một DB giả lập Supabase Cloud: schema `auth` như GoTrue, dữ liệu tạo bằng chính các RPC của app (đặt lịch, đổi giờ, hoàn thành → mã quà, đánh giá, yêu cầu tư vấn, giữ chỗ, thẻ quà tặng, tài khoản email và SĐT).
- Một DB đích có phiên bản GoTrue khác (thêm 1 cột, thiếu 1 cột).

Test chạy `check → schema → check → data → verify` (và chạy `data` lần 2), rồi gọi API qua PostgREST và nginx gateway như web app:
- Khách vãng lai chỉ xem được bảng giá (RLS chặn lịch hẹn); khách cũ thấy đúng lịch và mã quà của mình; admin thấy tất cả.
- Đặt lịch mới thành công; đăng ký mới vẫn tự tạo hồ sơ khách.
- CORS chỉ mở cho domain web.

Chưa chạy thử được với GoTrue thật và Supabase Cloud thật (môi trường thử không tải được Docker image), nên cần làm Bước 3 trước khi chuyển thật.
