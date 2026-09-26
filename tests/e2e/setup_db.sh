#!/bin/bash
# Fresh Supabase-like database "spa" for E2E: roles, auth shim, project migrations, seed data.
set -e
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
P="psql -h ${PGHOST:-/var/tmp/pgtest} -p ${PGPORT:-5439} -U postgres -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "DROP DATABASE IF EXISTS spa WITH (FORCE)" -c "CREATE DATABASE spa"
$P -d postgres <<'SQL' 2>/dev/null || true
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticator LOGIN NOINHERIT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT anon, authenticated TO authenticator;
SQL
$P -d spa <<'SQL'
CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  phone text UNIQUE,
  phone_confirmed_at timestamptz,
  encrypted_password text,
  raw_user_meta_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
-- Same semantics as Supabase's auth.uid()
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  ), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
-- Supabase default: API roles get table privileges, RLS decides rows
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
SQL
for f in "$ROOT"/supabase/migrations/*.sql; do
  $P -d spa -f "$f" 2>&1 | grep -v NOTICE || true
done
$P -d spa <<'SQL'
INSERT INTO services (id, name, description, duration_min, price, category) VALUES
 ('11111111-0000-0000-0000-000000000001','Massage body thư giãn','Liệu trình toàn thân với tinh dầu ấm, giúp thả lỏng cơ và ngủ ngon hơn.',60,450000,'massage'),
 ('11111111-0000-0000-0000-000000000002','Massage cổ vai gáy','Giải tỏa căng cơ vùng cổ vai gáy cho dân văn phòng.',30,250000,'massage'),
 ('11111111-0000-0000-0000-000000000003','Chăm sóc da mặt (Facial)','Làm sạch sâu, tẩy tế bào chết và cấp ẩm.',60,550000,'skin'),
 ('11111111-0000-0000-0000-000000000004','Gội đầu dưỡng sinh','Gội thảo dược kết hợp massage đầu và vai.',45,200000,'hair');
INSERT INTO staff (id, name, phone, email) VALUES
 ('22222222-0000-0000-0000-000000000001','Nguyễn Thu Lan','0911000001','lan@spa.vn'),
 ('22222222-0000-0000-0000-000000000002','Trần Ngọc Mai','0911000002','mai@spa.vn'),
 ('22222222-0000-0000-0000-000000000003','Lê Minh Hòa','0911000003','hoa@spa.vn');
-- Lan & Mai: all services; Hòa: massage only
INSERT INTO staff_services (staff_id, service_id)
 SELECT s.id, v.id FROM staff s, services v
 WHERE s.name <> 'Lê Minh Hòa' OR v.category = 'massage';
-- Everyone 09:00-18:00, lunch 12-13, every day; Hòa off on Sundays
INSERT INTO staff_schedules (staff_id, day_of_week, start_time, end_time, break_start, break_end)
 SELECT s.id, d, '09:00', '18:00', '12:00', '13:00' FROM staff s, generate_series(0,6) d
 WHERE NOT (s.name = 'Lê Minh Hòa' AND d = 0);
SQL
$P -d spa <<'SQL'
UPDATE staff SET years_experience = 6, specialties = '{Cổ vai gáy,Đá nóng}', bio = 'Nhẹ tay, tỉ mỉ; 6 năm trị liệu cổ vai gáy.' WHERE name = 'Nguyễn Thu Lan';
UPDATE staff SET years_experience = 4, specialties = '{Chăm sóc da,Gội dưỡng sinh}', bio = 'Chuyên chăm sóc da mặt và gội đầu thảo dược.' WHERE name = 'Trần Ngọc Mai';
UPDATE staff SET years_experience = 3, specialties = '{Massage body}' WHERE name = 'Lê Minh Hòa';
INSERT INTO service_packages (name, service_id, sessions, price) VALUES ('Gói 5 buổi massage body', '11111111-0000-0000-0000-000000000001', 5, 1900000);
SQL
echo "DB ready"
