# Báo Cáo Phân Tích & Kế Hoạch Chuyển Đổi Kiến Trúc (Supabase → Node.js + PostgreSQL)

## 1. Phân Tích Hiện Trạng (As-Is)
Hiện tại, hệ thống Lumiere Spa đang được xây dựng theo kiến trúc **Serverless** gắn chặt (tightly-coupled) với hệ sinh thái Supabase:
- **Frontend**: Next.js (App Router) với React, Tailwind CSS.
- **Backend / API**: Gần như không có Backend truyền thống. Frontend sử dụng `@supabase/supabase-js` để gọi trực tiếp (Direct DB Access) lên Supabase.
- **Authentication**: Dùng Supabase Auth (GoTrue API) quản lý người dùng, JWT, OTP.
- **Database & Security**: Dùng Supabase PostgreSQL. Logic bảo mật được giao phó hoàn toàn cho **Row Level Security (RLS)** dưới database. Logic nghiệp vụ phức tạp (như tính giá vé, chống trùng lịch hẹn) được viết bằng **PostgreSQL RPC (Stored Procedures)** (ví dụ: `book_appointment`, `_price_booking`).

**Khó khăn cốt lõi khi loại bỏ Supabase:**
1. Mất toàn bộ hệ thống xác thực (Auth). Phải tự xây hệ thống cấp phát và xác thực JWT.
2. Mất RLS bảo vệ data. Phải dời toàn bộ logic kiểm tra quyền (Authorization) từ Database lên tầng Backend (API/Services).
3. Phải dịch mã SQL Stored Procedures (plpgsql) thành code TypeScript chạy trên Backend.

---

## 2. Đề Xuất Kiến Trúc Mới (To-Be)
Để giữ lại toàn bộ giao diện (UI/UX) và tích hợp hoàn hảo với Next.js mà không làm phân mảnh hệ thống, em đề xuất kiến trúc **Next.js Fullstack Monolith** kết hợp **Prisma ORM**:

- **Frontend (FE)**: Giữ nguyên Next.js App Router (Client Components & Server Components), UI, Tailwind. Thay vì gọi `supabase.from()`, FE sẽ gọi API nội bộ bằng `fetch()` hoặc `Server Actions`.
- **Backend (BE)**: Sử dụng chính hệ thống **Route Handlers (`app/api/...`)** của Next.js làm REST API. Cấu trúc BE nội bộ bao gồm:
  - `Controllers`: Các file `route.ts` xử lý Request/Response.
  - `Services` (`lib/services/`): Chứa logic nghiệp vụ (thay thế cho Stored Procedures).
  - `Middlewares` (`middleware.ts`): Xử lý phân quyền (JWT verification, Role checking).
  - `Validation` (`lib/validations/`): Dùng thư viện **Zod** để validate dữ liệu đầu vào.
- **Database (DB)**: PostgreSQL thuần (Mắt Bão).
  - **ORM**: Dùng **Prisma** (`prisma/schema.prisma`) để thiết kế DB, tự động tạo Migration và sinh Type an toàn cho TypeScript.
  - **Authentication**: Tự build JWT Authentication (Lưu token trong HttpOnly Cookies để bảo mật).

### Cấu trúc thư mục mới đề xuất:
```text
/app
  /api              <-- BE: Chứa toàn bộ API (auth, appointments, services, v.v.)
  /(routes)         <-- FE: Các trang giao diện giữ nguyên
/components         <-- FE: Chứa UI components
/lib
  /db               <-- BE: Khởi tạo Prisma Client
  /services         <-- BE: Business logic (BookingService, AuthService...)
  /utils            <-- FE/BE: Các hàm tiện ích
/prisma
  schema.prisma     <-- DB: Toàn bộ thiết kế database (thay thế supabase/migrations)
```

---

## 3. Kế Hoạch Triển Khai (Migration Plan)

Do đây là quá trình thay máu toàn bộ ứng dụng (rewrite hoàn toàn phần lõi data), việc triển khai sẽ được chia làm 5 Giai đoạn (Phases) để đảm bảo an toàn và không làm hỏng tính năng:

### Giai đoạn 1: Thiết lập Database & Prisma (Dự kiến: Sẵn sàng)
- Cài đặt `prisma`, `@prisma/client`.
- Phân tích các file SQL của Supabase và viết lại thành file định nghĩa `schema.prisma`.
- Định nghĩa các quan hệ (Relationships) giữa Users, Profiles, Staff, Customers, Appointments, v.v.
- Thiết lập `.env` trỏ tới PostgreSQL của Mắt Bão.
- Chạy `npx prisma db push` để tạo bảng.

### Giai đoạn 2: Xây dựng Core Backend (Auth & Middlewares)
- Cài đặt thư viện `jose` hoặc `jsonwebtoken` để tạo/kiểm tra JWT Token, `bcryptjs` để hash mật khẩu (thay thế `auth.users` của Supabase).
- Xây dựng API `/api/auth/register`, `/api/auth/login`, `/api/auth/me`.
- Cập nhật file `middleware.ts` của Next.js để block các route yêu cầu quyền admin/staff nếu JWT không hợp lệ.
- Viết lại Context `lib/auth-context.tsx` để lấy User từ API nội bộ thay vì Supabase.

### Giai đoạn 3: Dịch mã Business Logic (Services)
- Xây dựng `BookingService.ts`: Dịch logic của hàm `book_appointment` (Check trùng lịch, kiểm tra nhân viên trống, áp dụng ưu đãi, giảm số lượng thẻ quà tặng) từ PL/pgSQL sang TypeScript transaction của Prisma.
- Xây dựng `PriceService.ts`: Dịch logic tính giá động.
- Xây dựng `CatalogService.ts`: Quản lý danh mục dịch vụ, staff, package.

### Giai đoạn 4: Thay thế API trên Frontend (Integration)
- Quét toàn bộ source code tìm các chuỗi `supabase.from(...)` và `supabase.rpc(...)`.
- Viết các API tương ứng (VD: `/api/appointments`, `/api/customers`).
- Đổi các components trên Frontend sang gọi API nội bộ bằng `fetch`.
- Đảm bảo các luồng lấy dữ liệu, tạo dữ liệu, phân trang, lọc hoạt động chính xác.

### Giai đoạn 5: Testing & Dọn dẹp
- Kiểm tra toàn bộ luồng E2E: Đăng ký -> Lễ tân tạo lịch -> KTV xác nhận -> Khách hàng xem lịch sử.
- Xóa bỏ hoàn toàn SDK `@supabase/supabase-js`.
- Xóa bỏ thư mục `supabase/`.
- Cập nhật file README và Scripts.

---

**Ghi chú của Kiến Trúc Sư:** 
Quá trình này yêu cầu thay đổi hàng ngàn dòng code. Để đảm bảo an toàn cao nhất, em sẽ tiến hành **Giai đoạn 1 & 2** (Thiết lập Prisma + Xây dựng Authentication) trước tiên. Sau khi hệ thống xác thực mới chạy ổn định, chúng ta mới chuyển sang dịch logic nghiệp vụ (Giai đoạn 3).
