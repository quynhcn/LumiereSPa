-- ============================================================
-- SPAFLOW FULL DATABASE & DATA EXPORT FOR ADMINER / POSTGRESQL
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Khởi tạo schema auth tương thích
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  phone text UNIQUE,
  phone_confirmed_at timestamptz,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$ LANGUAGE sql STABLE;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$ LANGUAGE sql STABLE;

-- ── File: 20260923084838_create_spafow_schema.sql ──────────────────────────────────────
/*
# SpaFlow — Core Schema

Creates the full database schema for the SpaFlow spa booking and operations management system.

## Tables
1. `services` — Spa services (name, description, duration, price, category, image, status)
2. `staff` — Staff members (name, phone, email, avatar, status, role)
3. `staff_services` — Junction: which staff can perform which services
4. `staff_schedules` — Recurring weekly working hours per staff (day_of_week, start, end, break_start, break_end)
5. `staff_time_off` — Date-specific time off / leave
6. `customers` — Customer profiles (name, phone, email, notes)
7. `appointments` — Booking records (customer, staff, service, start/end times, status, booking code, price/duration snapshot)
8. `appointment_logs` — Audit trail of appointment status changes

## Enums
- `appointment_status`: pending, confirmed, checked_in, in_service, completed, cancelled, no_show

## Security
- RLS enabled on all tables.
- All tables allow anon + authenticated CRUD (single-tenant, no-auth app — booking is public, admin views are shared).

## Business Rules Encoded
- BR-04: Unique exclusion constraint prevents overlapping active appointments for the same staff member.
- BR-05: Cancelled appointments don't occupy slots (excluded from constraint).
- BR-10: Price and duration are snapshotted on the appointment at booking time.
- BR-11: The exclusion constraint + a unique partial index on booking_code prevent double-booking at the DB level.
*/

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM (
    'pending', 'confirmed', 'checked_in', 'in_service', 'completed', 'cancelled', 'no_show'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SERVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  duration_min integer NOT NULL CHECK (duration_min > 0),
  price integer NOT NULL CHECK (price >= 0),
  category text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_services" ON services;
CREATE POLICY "anon_select_services" ON services FOR SELECT
  TO PUBLIC USING (true);
DROP POLICY IF EXISTS "anon_insert_services" ON services;
CREATE POLICY "anon_insert_services" ON services FOR INSERT
  TO PUBLIC WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_services" ON services;
CREATE POLICY "anon_update_services" ON services FOR UPDATE
  TO PUBLIC USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_services" ON services;
CREATE POLICY "anon_delete_services" ON services FOR DELETE
  TO PUBLIC USING (true);

-- ============================================================
-- STAFF
-- ============================================================
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  avatar_url text,
  role text NOT NULL DEFAULT 'therapist',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_staff" ON staff;
CREATE POLICY "anon_select_staff" ON staff FOR SELECT
  TO PUBLIC USING (true);
DROP POLICY IF EXISTS "anon_insert_staff" ON staff;
CREATE POLICY "anon_insert_staff" ON staff FOR INSERT
  TO PUBLIC WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_staff" ON staff;
CREATE POLICY "anon_update_staff" ON staff FOR UPDATE
  TO PUBLIC USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_staff" ON staff;
CREATE POLICY "anon_delete_staff" ON staff FOR DELETE
  TO PUBLIC USING (true);

-- ============================================================
-- STAFF_SERVICES (junction)
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  UNIQUE (staff_id, service_id)
);

ALTER TABLE staff_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_staff_services" ON staff_services;
CREATE POLICY "anon_select_staff_services" ON staff_services FOR SELECT
  TO PUBLIC USING (true);
DROP POLICY IF EXISTS "anon_insert_staff_services" ON staff_services;
CREATE POLICY "anon_insert_staff_services" ON staff_services FOR INSERT
  TO PUBLIC WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_staff_services" ON staff_services;
CREATE POLICY "anon_update_staff_services" ON staff_services FOR UPDATE
  TO PUBLIC USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_staff_services" ON staff_services;
CREATE POLICY "anon_delete_staff_services" ON staff_services FOR DELETE
  TO PUBLIC USING (true);

-- ============================================================
-- STAFF_SCHEDULES (recurring weekly hours)
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  break_start time,
  break_end time,
  CHECK (end_time > start_time),
  CHECK (break_start IS NULL OR (break_end IS NOT NULL AND break_end > break_start))
);

ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_staff_schedules" ON staff_schedules;
CREATE POLICY "anon_select_staff_schedules" ON staff_schedules FOR SELECT
  TO PUBLIC USING (true);
DROP POLICY IF EXISTS "anon_insert_staff_schedules" ON staff_schedules;
CREATE POLICY "anon_insert_staff_schedules" ON staff_schedules FOR INSERT
  TO PUBLIC WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_staff_schedules" ON staff_schedules;
CREATE POLICY "anon_update_staff_schedules" ON staff_schedules FOR UPDATE
  TO PUBLIC USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_staff_schedules" ON staff_schedules;
CREATE POLICY "anon_delete_staff_schedules" ON staff_schedules FOR DELETE
  TO PUBLIC USING (true);

-- ============================================================
-- STAFF_TIME_OFF (date-specific leave)
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date date NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE staff_time_off ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_staff_time_off" ON staff_time_off;
CREATE POLICY "anon_select_staff_time_off" ON staff_time_off FOR SELECT
  TO PUBLIC USING (true);
DROP POLICY IF EXISTS "anon_insert_staff_time_off" ON staff_time_off;
CREATE POLICY "anon_insert_staff_time_off" ON staff_time_off FOR INSERT
  TO PUBLIC WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_staff_time_off" ON staff_time_off;
CREATE POLICY "anon_update_staff_time_off" ON staff_time_off FOR UPDATE
  TO PUBLIC USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_staff_time_off" ON staff_time_off;
CREATE POLICY "anon_delete_staff_time_off" ON staff_time_off FOR DELETE
  TO PUBLIC USING (true);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_customers" ON customers;
CREATE POLICY "anon_select_customers" ON customers FOR SELECT
  TO PUBLIC USING (true);
DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT
  TO PUBLIC WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_customers" ON customers;
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE
  TO PUBLIC USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_customers" ON customers;
CREATE POLICY "anon_delete_customers" ON customers FOR DELETE
  TO PUBLIC USING (true);

-- ============================================================
-- APPOINTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code text UNIQUE NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status appointment_status NOT NULL DEFAULT 'confirmed',
  price integer NOT NULL,
  duration_min integer NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (end_time > start_time)
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_appointments" ON appointments;
CREATE POLICY "anon_select_appointments" ON appointments FOR SELECT
  TO PUBLIC USING (true);
DROP POLICY IF EXISTS "anon_insert_appointments" ON appointments;
CREATE POLICY "anon_insert_appointments" ON appointments FOR INSERT
  TO PUBLIC WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_appointments" ON appointments;
CREATE POLICY "anon_update_appointments" ON appointments FOR UPDATE
  TO PUBLIC USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_appointments" ON appointments;
CREATE POLICY "anon_delete_appointments" ON appointments FOR DELETE
  TO PUBLIC USING (true);

-- ============================================================
-- APPOINTMENT_LOGS (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS appointment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  old_status appointment_status,
  new_status appointment_status,
  changed_by text,
  changed_at timestamptz DEFAULT now()
);

ALTER TABLE appointment_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_appointment_logs" ON appointment_logs;
CREATE POLICY "anon_select_appointment_logs" ON appointment_logs FOR SELECT
  TO PUBLIC USING (true);
DROP POLICY IF EXISTS "anon_insert_appointment_logs" ON appointment_logs;
CREATE POLICY "anon_insert_appointment_logs" ON appointment_logs FOR INSERT
  TO PUBLIC WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_appointment_logs" ON appointment_logs;
CREATE POLICY "anon_update_appointment_logs" ON appointment_logs FOR UPDATE
  TO PUBLIC USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_appointment_logs" ON appointment_logs;
CREATE POLICY "anon_delete_appointment_logs" ON appointment_logs FOR DELETE
  TO PUBLIC USING (true);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_appointments_staff_time ON appointments (staff_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_appointments_customer ON appointments (customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments (status);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments (start_time);
CREATE INDEX IF NOT EXISTS idx_staff_services_staff ON staff_services (staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_services_service ON staff_services (service_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff ON staff_schedules (staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_time_off_staff_date ON staff_time_off (staff_id, date);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone);

-- ============================================================
-- EXCLUSION CONSTRAINT (BR-04: no overlapping active appointments)
-- Prevents double-booking at the database level.
-- Only applies to non-cancelled, non-completed, non-no_show appointments.
-- ============================================================
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS btree_gist;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE appointments
  ADD CONSTRAINT no_overlapping_appointments
  EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (status NOT IN ('cancelled', 'completed', 'no_show'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TRIGGER: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_services_updated ON services;
CREATE TRIGGER trg_services_updated BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_staff_updated ON staff;
CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_customers_updated ON customers;
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_appointments_updated ON appointments;
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TRIGGER: auto-log appointment status changes
-- ============================================================
CREATE OR REPLACE FUNCTION log_appointment_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO appointment_logs (appointment_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, current_setting('app.current_user', true));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_appointments_log ON appointments;
CREATE TRIGGER trg_appointments_log AFTER UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION log_appointment_change();

-- ── File: 20260923092623_add_user_id_to_customers.sql ──────────────────────────────────────
/*
# Add user_id to customers for auth integration

1. Modified Tables
- `customers`: add `user_id` (uuid, nullable, references auth.users ON DELETE SET NULL)
  - This links a customer profile to a Supabase auth user account.
  - Nullable because existing demo customers have no auth account, and the public booking flow may create customers before they register.
  - Added a unique constraint on (user_id) so each auth user maps to exactly one customer profile.

2. Security Changes
- RLS already enabled on customers (anon + authenticated CRUD).
- No policy changes needed — the existing `TO PUBLIC` policies still apply.
- The booking flow will now check for an authenticated session before creating appointments.
- When a signed-in user books, the system will find/create their customer profile by phone and link user_id.

3. Important Notes
- The `user_id` column is nullable to avoid breaking existing demo data.
- Future inserts from authenticated users will set user_id via the app code.
- The unique index on user_id prevents duplicate customer profiles per auth account.
*/

ALTER TABLE customers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_user_id ON customers (user_id) WHERE user_id IS NOT NULL;


-- ── File: 20260924040018_create_profiles_table.sql ──────────────────────────────────────
/*
# Create profiles table for role-based access

1. New Tables
- `profiles`
  - `id` (uuid, primary key, references auth.users)
  - `email` (text, copied from auth.users)
  - `role` (text, NOT NULL, default 'customer' — values: 'admin', 'staff', 'customer')
  - `staff_id` (uuid, nullable, references staff(id) — links a staff profile to an auth account)
  - `created_at` (timestamptz)

2. Security
- RLS enabled on profiles.
- SELECT: TO PUBLIC — users can read their own profile.
- INSERT: TO PUBLIC — users can insert their own profile (id = auth.uid()).
- UPDATE: TO PUBLIC — users can update their own profile.
- DELETE: TO PUBLIC — users can delete their own profile.

3. Trigger
- `handle_new_user` trigger on auth.users: auto-inserts a profile row with role='customer'
  when a new auth user signs up. This ensures every auth user has a profile.

4. Important Notes
- The trigger auto-creates a 'customer' profile for every new signup.
- Admin can manually change role to 'admin' or 'staff' via SQL or admin UI.
- When role is 'staff', the `staff_id` column links to the staff table record.
- The sign-in flow reads the role and redirects: admin→/admin, staff→/staff, customer→/account.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'staff', 'customer')),
  staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO PUBLIC USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO PUBLIC WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO PUBLIC USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO PUBLIC USING (auth.uid() = id);

-- Also allow anon to read profiles by id (needed for staff lookup during booking)
-- Actually, we don't want anon to read profiles. Only authenticated.

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'customer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ── File: 20260925000000_security_and_booking_rpc.sql ──────────────────────────────────────
/*
# Security hardening + server-side booking

1. Role helpers: app_role(), app_staff_id(), is_admin() (SECURITY DEFINER, no RLS recursion).
2. Profiles: users can only READ their own row (no self role escalation). Admin can read all.
3. RLS rewritten by role (replaces every "anon_*" full-CRUD policy):
   - Catalog (services, staff, staff_services, staff_schedules, staff_time_off): public read, admin write.
   - customers: owner (user_id = auth.uid()) or admin/staff read; owner/admin update; admin insert/delete.
   - appointments: owner / assigned staff / admin read; staff (own) + admin update; admin insert/delete.
     Customers create appointments ONLY through book_appointment().
   - appointment_logs: admin read; written only by trigger.
4. handle_new_user also creates the linked customers row from signup metadata.
5. RPC get_available_slots(service, staff|null, date): slot list computed in DB (spa time zone),
   no customer PII exposed, one round-trip.
6. RPC book_appointment(...): price/duration from DB, customer resolved by auth.uid(),
   staff auto-assigned if null, relies on exclusion constraint for race safety.

Spa time zone: Asia/Ho_Chi_Minh (UTC+7).
*/

-- ============================================================
-- 1. ROLE HELPERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.app_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    ELSE COALESCE((SELECT role FROM profiles WHERE id = auth.uid()), 'customer')
  END;
$$;

CREATE OR REPLACE FUNCTION public.app_staff_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT staff_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = 'admin', false);
$$;

-- ============================================================
-- 2. DROP OLD OPEN POLICIES
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND (policyname LIKE 'anon\_%' OR tablename = 'profiles'
           OR policyname LIKE 'catalog\_%' OR policyname LIKE 'customers\_%'
           OR policyname LIKE 'appointments\_%' OR policyname LIKE 'logs\_%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ============================================================
-- 3. PROFILES — read-only for the owner, admin sees all
-- ============================================================
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO PUBLIC
  USING (id = auth.uid() OR public.is_admin());
-- No INSERT/UPDATE/DELETE policies: rows are created by trigger, roles changed via SQL/admin only.

-- ============================================================
-- 4. CATALOG TABLES — public read, admin write
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['services','staff','staff_services','staff_schedules','staff_time_off'] LOOP
    EXECUTE format('CREATE POLICY "catalog_select_%1$s" ON %1$I FOR SELECT TO PUBLIC USING (true)', t);
    EXECUTE format('CREATE POLICY "catalog_admin_write_%1$s" ON %1$I FOR ALL TO PUBLIC USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
  END LOOP;
END $$;

-- ============================================================
-- 5. CUSTOMERS
-- ============================================================
CREATE POLICY "customers_select" ON customers FOR SELECT TO PUBLIC
  USING (user_id = auth.uid() OR public.app_role() IN ('admin', 'staff'));
CREATE POLICY "customers_update" ON customers FOR UPDATE TO PUBLIC
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "customers_insert" ON customers FOR INSERT TO PUBLIC
  WITH CHECK (public.is_admin());
CREATE POLICY "customers_delete" ON customers FOR DELETE TO PUBLIC
  USING (public.is_admin());

-- ============================================================
-- 6. APPOINTMENTS
-- ============================================================
CREATE POLICY "appointments_select" ON appointments FOR SELECT TO PUBLIC
  USING (
    public.is_admin()
    OR (public.app_role() = 'staff' AND staff_id = public.app_staff_id())
    OR customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
  );
CREATE POLICY "appointments_update" ON appointments FOR UPDATE TO PUBLIC
  USING (public.is_admin() OR (public.app_role() = 'staff' AND staff_id = public.app_staff_id()))
  WITH CHECK (public.is_admin() OR (public.app_role() = 'staff' AND staff_id = public.app_staff_id()));
CREATE POLICY "appointments_insert" ON appointments FOR INSERT TO PUBLIC
  WITH CHECK (public.is_admin());
CREATE POLICY "appointments_delete" ON appointments FOR DELETE TO PUBLIC
  USING (public.is_admin());

-- ============================================================
-- 7. APPOINTMENT LOGS — admin read, trigger write
-- ============================================================
CREATE POLICY "logs_select" ON appointment_logs FOR SELECT TO PUBLIC
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION log_appointment_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO appointment_logs (appointment_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status,
            COALESCE((SELECT email FROM profiles WHERE id = auth.uid()), auth.uid()::text));
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 8. SIGNUP TRIGGER — profile + linked customer row
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'customer')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO customers (name, phone, email, user_id)
  VALUES (
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''), split_part(NEW.email, '@', 1)),
    COALESCE(trim(NEW.raw_user_meta_data->>'phone'), ''),
    NEW.email,
    NEW.id
  )
  ON CONFLICT (user_id) WHERE user_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 9. RPC: available slots (30-minute grid, spa local time)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_service_id uuid,
  p_staff_id uuid,
  p_date date
)
RETURNS TABLE (slot_time text, staff_count int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH svc AS (
    SELECT make_interval(mins => duration_min) AS dur
    FROM services WHERE id = p_service_id AND is_active
  ),
  eligible AS (
    SELECT s.id
    FROM staff s
    JOIN staff_services ss ON ss.staff_id = s.id AND ss.service_id = p_service_id
    WHERE s.is_active
      AND (p_staff_id IS NULL OR s.id = p_staff_id)
      AND NOT EXISTS (SELECT 1 FROM staff_time_off t WHERE t.staff_id = s.id AND t.date = p_date)
  ),
  candidates AS (
    SELECT e.id AS staff_id, gs AS local_start, gs + svc.dur AS local_end,
           sc.break_start, sc.break_end
    FROM eligible e
    JOIN staff_schedules sc ON sc.staff_id = e.id AND sc.day_of_week = extract(dow FROM p_date)::int
    CROSS JOIN svc
    CROSS JOIN LATERAL generate_series(
      p_date + sc.start_time,
      p_date + sc.end_time - svc.dur,
      interval '30 minutes'
    ) AS gs
  )
  SELECT to_char(c.local_start, 'HH24:MI') AS slot_time,
         count(DISTINCT c.staff_id)::int AS staff_count
  FROM candidates c
  WHERE (c.local_start AT TIME ZONE 'Asia/Ho_Chi_Minh') > now()
    AND (c.break_start IS NULL
         OR NOT (c.local_start::time < c.break_end AND c.local_end::time > c.break_start))
    AND NOT EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.staff_id = c.staff_id
        AND a.status NOT IN ('cancelled', 'completed', 'no_show')
        AND a.start_time < (c.local_end AT TIME ZONE 'Asia/Ho_Chi_Minh')
        AND a.end_time > (c.local_start AT TIME ZONE 'Asia/Ho_Chi_Minh')
    )
  GROUP BY 1
  ORDER BY 1;
$$;

-- ============================================================
-- 10. RPC: book appointment
-- ============================================================
CREATE OR REPLACE FUNCTION public.book_appointment(
  p_service_id uuid,
  p_staff_id uuid,          -- NULL = any staff
  p_date date,              -- spa local date
  p_time text,              -- 'HH:MM' spa local time
  p_name text,
  p_phone text,
  p_email text,
  p_notes text
)
RETURNS TABLE (booking_code text, staff_id uuid, staff_name text, start_time timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_uid uuid := auth.uid();
  v_svc services%ROWTYPE;
  v_customer uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_staff record;
  v_code text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF coalesce(trim(p_name), '') = '' OR length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) < 9 THEN
    RAISE EXCEPTION 'INVALID_CUSTOMER';
  END IF;
  IF p_date > (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 60 THEN
    RAISE EXCEPTION 'DATE_TOO_FAR';
  END IF;

  SELECT * INTO v_svc FROM services WHERE id = p_service_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERVICE_NOT_FOUND';
  END IF;

  v_start := (p_date + p_time::time) AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_end := v_start + make_interval(mins => v_svc.duration_min);

  IF public.app_role() IN ('admin', 'staff') THEN
    -- Front desk booking on behalf of a (walk-in / phone) customer: match by phone, else create.
    SELECT id INTO v_customer FROM customers
    WHERE phone = trim(p_phone)
    ORDER BY (user_id IS NULL), created_at
    LIMIT 1;
    IF v_customer IS NULL THEN
      INSERT INTO customers (name, phone, email)
      VALUES (trim(p_name), trim(p_phone), nullif(trim(p_email), ''))
      RETURNING id INTO v_customer;
    END IF;
  -- Customer booking: always the caller's own profile (never matched by phone)
  ELSE
    SELECT id INTO v_customer FROM customers WHERE user_id = v_uid;
    IF v_customer IS NULL THEN
      INSERT INTO customers (name, phone, email, user_id)
      VALUES (trim(p_name), trim(p_phone), nullif(trim(p_email), ''), v_uid)
      RETURNING id INTO v_customer;
    ELSE
      UPDATE customers
      SET name = trim(p_name), phone = trim(p_phone), email = nullif(trim(p_email), '')
      WHERE id = v_customer;
    END IF;
  END IF;

  FOR v_staff IN
    SELECT s.id, s.name
    FROM staff s
    WHERE (p_staff_id IS NULL OR s.id = p_staff_id)
      AND EXISTS (
        SELECT 1 FROM public.get_available_slots(p_service_id, s.id, p_date) g
        WHERE g.slot_time = to_char(p_time::time, 'HH24:MI')
      )
    ORDER BY (
      SELECT count(*) FROM appointments a
      WHERE a.staff_id = s.id
        AND a.status NOT IN ('cancelled', 'no_show')
        AND (a.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = p_date
    ), s.name
  LOOP
    BEGIN
      INSERT INTO appointments (customer_id, staff_id, service_id, start_time, end_time,
                                status, price, duration_min, notes)
      VALUES (v_customer, v_staff.id, p_service_id, v_start, v_end,
              'confirmed', v_svc.price, v_svc.duration_min, nullif(trim(p_notes), ''))
      RETURNING appointments.booking_code INTO v_code;

      RETURN QUERY SELECT v_code, v_staff.id, v_staff.name, v_start;
      RETURN;
    EXCEPTION WHEN exclusion_violation THEN
      -- Taken concurrently: try next eligible staff
      NULL;
    END;
  END LOOP;

  RAISE EXCEPTION 'SLOT_UNAVAILABLE';
END;
$$;

REVOKE ALL ON FUNCTION public.book_appointment(uuid, uuid, date, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_appointment(uuid, uuid, date, text, text, text, text, text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid, uuid, date) TO PUBLIC;


-- ── File: 20260925010000_hide_team_accounts_from_customers.sql ──────────────────────────────────────
/*
# Team accounts are not customers

handle_new_user creates a customers row for every signup (role is only assigned afterwards).
When an account becomes admin/staff, remove that auto-created customer row
(only if it has no appointments), so team members do not appear in the admin "Khách hàng" list.
*/

CREATE OR REPLACE FUNCTION public.cleanup_team_customer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role IN ('admin', 'staff') AND OLD.role IS DISTINCT FROM NEW.role THEN
    DELETE FROM customers c
    WHERE c.user_id = NEW.id
      AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.customer_id = c.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_role_changed ON profiles;
CREATE TRIGGER trg_profiles_role_changed
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_team_customer();

-- One-time cleanup for accounts that are already admin/staff
DELETE FROM customers c
USING profiles p
WHERE p.id = c.user_id
  AND p.role IN ('admin', 'staff')
  AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.customer_id = c.id);


-- ── File: 20260925020000_customer_self_cancel.sql ──────────────────────────────────────
/*
# Customers can cancel their own upcoming appointment

RPC cancel_my_appointment(p_id):
- only the customer who owns the appointment (customers.user_id = auth.uid())
- only while status is pending/confirmed
- only up to 2 hours before start (keep in sync with SITE.cancelBeforeHours in lib/site-config.ts)
Errors: NOT_FOUND, NOT_CANCELLABLE, TOO_LATE
*/

CREATE OR REPLACE FUNCTION public.cancel_my_appointment(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status appointment_status;
  v_start timestamptz;
BEGIN
  SELECT a.status, a.start_time INTO v_status, v_start
  FROM appointments a
  JOIN customers c ON c.id = a.customer_id
  WHERE a.id = p_id AND c.user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  IF v_status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'NOT_CANCELLABLE';
  END IF;
  IF v_start < now() + interval '2 hours' THEN
    RAISE EXCEPTION 'TOO_LATE';
  END IF;

  UPDATE appointments SET status = 'cancelled' WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_my_appointment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_appointment(uuid) TO PUBLIC;


-- ── File: 20260926000000_growth_features.sql ──────────────────────────────────────
/*
# Growth features

1. app_settings            — first-visit discount (%) switch, editable by admin, readable by everyone
2. services.includes / compare_at_price — combos ("Massage + gội 90'") with crossed-out price
3. staff.bio / specialties / years_experience — therapist profiles on the landing page
4. service_packages        — multi-session packages (e.g. 5 buổi) shown on the landing page
5. gift_cards              — admin-issued codes: value cards (trừ tiền) or session cards (trừ buổi)
6. appointments            — list_price, discount_amount, gift_card_id, gift_amount, source, reminded_at
7. reviews                 — 1 review per completed appointment, submitted by its owner
8. leads                   — "để lại SĐT, spa gọi tư vấn" (anon insert via RPC, admin handles)
9. RPCs                    — booking_quote, book_appointment (now with discount + gift code),
                             submit_review, get_public_reviews, get_review_summary, create_lead
10. Trigger                — cancelling an appointment refunds the gift card balance / session

Revenue semantics: appointments.price = amount charged for the service AFTER the first-visit discount
(gift_amount is the part of it paid with a prepaid card). Existing revenue code keeps working.
*/

-- ============================================================
-- 1. SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  first_visit_enabled boolean NOT NULL DEFAULT true,
  first_visit_discount_pct int NOT NULL DEFAULT 10 CHECK (first_visit_discount_pct BETWEEN 0 AND 50),
  updated_at timestamptz DEFAULT now()
);
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_select" ON app_settings;
CREATE POLICY "settings_select" ON app_settings FOR SELECT TO PUBLIC USING (true);
DROP POLICY IF EXISTS "settings_admin_update" ON app_settings;
CREATE POLICY "settings_admin_update" ON app_settings FOR UPDATE TO PUBLIC
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 2-3. SERVICES & STAFF EXTRA COLUMNS
-- ============================================================
ALTER TABLE services ADD COLUMN IF NOT EXISTS includes text[] NOT NULL DEFAULT '{}';
ALTER TABLE services ADD COLUMN IF NOT EXISTS compare_at_price integer CHECK (compare_at_price IS NULL OR compare_at_price >= 0);

ALTER TABLE staff ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS specialties text[] NOT NULL DEFAULT '{}';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS years_experience integer CHECK (years_experience IS NULL OR years_experience >= 0);

-- ============================================================
-- 4. PACKAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  sessions integer NOT NULL CHECK (sessions >= 2),
  price integer NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE service_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "packages_select" ON service_packages;
CREATE POLICY "packages_select" ON service_packages FOR SELECT TO PUBLIC USING (true);
DROP POLICY IF EXISTS "packages_admin_write" ON service_packages;
CREATE POLICY "packages_admin_write" ON service_packages FOR ALL TO PUBLIC
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 5. GIFT CARDS (value or sessions)
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_email() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT email FROM profiles WHERE id = auth.uid();
$$;

CREATE TABLE IF NOT EXISTS gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL DEFAULT ('SF' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))),
  kind text NOT NULL CHECK (kind IN ('value', 'sessions')),
  initial_value integer CHECK (initial_value IS NULL OR initial_value > 0),
  balance integer CHECK (balance IS NULL OR balance >= 0),
  service_id uuid REFERENCES services(id) ON DELETE RESTRICT,
  package_id uuid REFERENCES service_packages(id) ON DELETE SET NULL,
  sessions_total integer CHECK (sessions_total IS NULL OR sessions_total > 0),
  sessions_left integer CHECK (sessions_left IS NULL OR sessions_left >= 0),
  buyer_name text,
  recipient_name text,
  recipient_phone text,
  note text,
  expires_at date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by text DEFAULT public.current_email(),
  CHECK (
    (kind = 'value' AND initial_value IS NOT NULL AND balance IS NOT NULL)
    OR (kind = 'sessions' AND service_id IS NOT NULL AND sessions_total IS NOT NULL AND sessions_left IS NOT NULL)
  )
);
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gift_admin_all" ON gift_cards;
CREATE POLICY "gift_admin_all" ON gift_cards FOR ALL TO PUBLIC
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 6. APPOINTMENT COLUMNS
-- ============================================================
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS list_price integer;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS discount_amount integer NOT NULL DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS gift_card_id uuid REFERENCES gift_cards(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS gift_amount integer NOT NULL DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'online';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminded_at timestamptz;
UPDATE appointments SET list_price = price + discount_amount WHERE list_price IS NULL;

-- ============================================================
-- 7. REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR length(comment) <= 1000),
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reviews_select" ON reviews;
CREATE POLICY "reviews_select" ON reviews FOR SELECT TO PUBLIC
  USING (public.is_admin() OR customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "reviews_admin_update" ON reviews;
CREATE POLICY "reviews_admin_update" ON reviews FOR UPDATE TO PUBLIC
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "reviews_admin_delete" ON reviews;
CREATE POLICY "reviews_admin_delete" ON reviews FOR DELETE TO PUBLIC USING (public.is_admin());

-- ============================================================
-- 8. LEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  interest text,
  note text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'booked', 'closed')),
  created_at timestamptz DEFAULT now(),
  handled_at timestamptz,
  handled_by text
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status, created_at DESC);
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads_admin_all" ON leads;
CREATE POLICY "leads_admin_all" ON leads FOR ALL TO PUBLIC
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 9. PRICING (shared by quote + booking)
-- ============================================================
CREATE OR REPLACE FUNCTION public._digits(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT regexp_replace(coalesce(p, ''), '\D', '', 'g') $$;

/*
  Computes the price of one booking.
  p_first_visit_ok: only true for customers booking online for themselves.
  p_lock: lock the gift card row (FOR UPDATE) when called from book_appointment.
  gift_error: NULL when the code is fine / absent, otherwise a machine code.
*/
CREATE OR REPLACE FUNCTION public._price_booking(
  p_service_id uuid, p_customer_id uuid, p_phone text, p_gift_code text, p_first_visit_ok boolean, p_lock boolean
)
RETURNS TABLE (list_price int, discount_amount int, discount_pct int, gift_card_id uuid, gift_amount int, gift_kind text, gift_error text, total int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_price int;
  v_set app_settings%ROWTYPE;
  v_disc int := 0;
  v_pct int := 0;
  v_card gift_cards%ROWTYPE;
  v_gift int := 0;
  v_err text := NULL;
  v_phone text := public._digits(p_phone);
BEGIN
  SELECT price INTO v_price FROM services WHERE id = p_service_id AND is_active;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'SERVICE_NOT_FOUND';
  END IF;

  -- First online visit: no earlier non-cancelled appointment for this customer or this phone number
  SELECT * INTO v_set FROM app_settings WHERE id = 1;
  IF p_first_visit_ok AND v_set.first_visit_enabled AND v_set.first_visit_discount_pct > 0
     AND NOT EXISTS (
       SELECT 1 FROM appointments a JOIN customers c ON c.id = a.customer_id
       WHERE a.status <> 'cancelled'
         AND (c.id = p_customer_id OR (length(v_phone) >= 9 AND public._digits(c.phone) = v_phone))
     ) THEN
    v_pct := v_set.first_visit_discount_pct;
    v_disc := round(v_price * v_pct / 100.0 / 1000) * 1000; -- round to 1.000 ₫
  END IF;

  IF nullif(trim(p_gift_code), '') IS NOT NULL THEN
    IF p_lock THEN
      SELECT * INTO v_card FROM gift_cards WHERE code = upper(trim(p_gift_code)) FOR UPDATE;
    ELSE
      SELECT * INTO v_card FROM gift_cards WHERE code = upper(trim(p_gift_code));
    END IF;

    IF v_card.id IS NULL THEN
      v_err := 'GIFT_NOT_FOUND';
    ELSIF NOT v_card.is_active THEN
      v_err := 'GIFT_INACTIVE';
    ELSIF v_card.expires_at IS NOT NULL AND v_card.expires_at < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
      v_err := 'GIFT_EXPIRED';
    ELSIF v_card.kind = 'value' AND v_card.balance <= 0 THEN
      v_err := 'GIFT_EMPTY';
    ELSIF v_card.kind = 'sessions' AND v_card.sessions_left <= 0 THEN
      v_err := 'GIFT_EMPTY';
    ELSIF v_card.kind = 'sessions' AND v_card.service_id <> p_service_id THEN
      v_err := 'GIFT_WRONG_SERVICE';
    ELSIF v_card.kind = 'sessions' THEN
      -- A session card pays the whole service; the first-visit discount does not stack with it
      v_disc := 0; v_pct := 0;
      v_gift := v_price;
    ELSE
      v_gift := least(v_card.balance, v_price - v_disc);
    END IF;
  END IF;

  RETURN QUERY SELECT v_price, v_disc, v_pct,
    CASE WHEN v_err IS NULL AND v_gift > 0 THEN v_card.id END,
    CASE WHEN v_err IS NULL THEN v_gift ELSE 0 END,
    CASE WHEN v_err IS NULL THEN v_card.kind END,
    v_err,
    v_price - v_disc - CASE WHEN v_err IS NULL THEN v_gift ELSE 0 END;
END;
$$;
REVOKE ALL ON FUNCTION public._price_booking(uuid, uuid, text, text, boolean, boolean) FROM PUBLIC, anon, authenticated;

-- Quote shown in the booking summary before confirming
CREATE OR REPLACE FUNCTION public.booking_quote(p_service_id uuid, p_phone text, p_gift_code text DEFAULT NULL)
RETURNS TABLE (list_price int, discount_amount int, discount_pct int, gift_amount int, gift_kind text, gift_error text, total int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_front boolean := public.app_role() IN ('admin', 'staff');
  v_customer uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT v_front THEN
    SELECT id INTO v_customer FROM customers WHERE user_id = auth.uid();
  END IF;
  RETURN QUERY
    SELECT q.list_price, q.discount_amount, q.discount_pct, q.gift_amount, q.gift_kind, q.gift_error, q.total
    FROM public._price_booking(p_service_id, v_customer, CASE WHEN v_front THEN NULL ELSE p_phone END, p_gift_code, NOT v_front, false) q;
END;
$$;
REVOKE ALL ON FUNCTION public.booking_quote(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booking_quote(uuid, text, text) TO PUBLIC;

-- ============================================================
-- 10. BOOK APPOINTMENT (replaces the version without discount / gift code)
-- ============================================================
DROP FUNCTION IF EXISTS public.book_appointment(uuid, uuid, date, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.book_appointment(
  p_service_id uuid,
  p_staff_id uuid,
  p_date date,
  p_time text,
  p_name text,
  p_phone text,
  p_email text,
  p_notes text,
  p_gift_code text DEFAULT NULL
)
RETURNS TABLE (booking_code text, staff_id uuid, staff_name text, start_time timestamptz,
               list_price int, discount_amount int, gift_amount int, total int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_uid uuid := auth.uid();
  v_front boolean := public.app_role() IN ('admin', 'staff');
  v_svc services%ROWTYPE;
  v_customer uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_staff record;
  v_code text;
  v_q record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF coalesce(trim(p_name), '') = '' OR length(public._digits(p_phone)) < 9 THEN
    RAISE EXCEPTION 'INVALID_CUSTOMER';
  END IF;
  IF p_date > (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 60 THEN
    RAISE EXCEPTION 'DATE_TOO_FAR';
  END IF;

  SELECT * INTO v_svc FROM services WHERE id = p_service_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERVICE_NOT_FOUND';
  END IF;

  v_start := (p_date + p_time::time) AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_end := v_start + make_interval(mins => v_svc.duration_min);

  IF v_front THEN
    -- Front desk booking on behalf of a walk-in / phone customer: match by phone, else create.
    SELECT id INTO v_customer FROM customers
    WHERE public._digits(phone) = public._digits(p_phone)
    ORDER BY (user_id IS NULL), created_at
    LIMIT 1;
    IF v_customer IS NULL THEN
      INSERT INTO customers (name, phone, email)
      VALUES (trim(p_name), trim(p_phone), nullif(trim(p_email), ''))
      RETURNING id INTO v_customer;
    END IF;
  ELSE
    SELECT id INTO v_customer FROM customers WHERE user_id = v_uid;
  END IF;

  -- Price before creating / updating the customer row so "first visit" is evaluated correctly
  SELECT * INTO v_q FROM public._price_booking(p_service_id, v_customer, p_phone, p_gift_code, NOT v_front, true);
  IF v_q.gift_error IS NOT NULL THEN
    RAISE EXCEPTION '%', v_q.gift_error;
  END IF;

  IF NOT v_front THEN
    IF v_customer IS NULL THEN
      INSERT INTO customers (name, phone, email, user_id)
      VALUES (trim(p_name), trim(p_phone), nullif(trim(p_email), ''), v_uid)
      RETURNING id INTO v_customer;
    ELSE
      UPDATE customers
      SET name = trim(p_name), phone = trim(p_phone), email = nullif(trim(p_email), '')
      WHERE id = v_customer;
    END IF;
  END IF;

  FOR v_staff IN
    SELECT s.id, s.name
    FROM staff s
    WHERE (p_staff_id IS NULL OR s.id = p_staff_id)
      AND EXISTS (
        SELECT 1 FROM public.get_available_slots(p_service_id, s.id, p_date) g
        WHERE g.slot_time = to_char(p_time::time, 'HH24:MI')
      )
    ORDER BY (
      SELECT count(*) FROM appointments a
      WHERE a.staff_id = s.id
        AND a.status NOT IN ('cancelled', 'no_show')
        AND (a.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = p_date
    ), s.name
  LOOP
    BEGIN
      INSERT INTO appointments (customer_id, staff_id, service_id, start_time, end_time, status,
                                price, list_price, discount_amount, gift_card_id, gift_amount,
                                duration_min, notes, source)
      VALUES (v_customer, v_staff.id, p_service_id, v_start, v_end, 'confirmed',
              v_q.list_price - v_q.discount_amount, v_q.list_price, v_q.discount_amount, v_q.gift_card_id, v_q.gift_amount,
              v_svc.duration_min, nullif(trim(p_notes), ''), CASE WHEN v_front THEN 'front_desk' ELSE 'online' END)
      RETURNING appointments.booking_code INTO v_code;

      IF v_q.gift_card_id IS NOT NULL THEN
        UPDATE gift_cards
        SET balance = CASE WHEN kind = 'value' THEN balance - v_q.gift_amount ELSE balance END,
            sessions_left = CASE WHEN kind = 'sessions' THEN sessions_left - 1 ELSE sessions_left END
        WHERE id = v_q.gift_card_id;
      END IF;

      RETURN QUERY SELECT v_code, v_staff.id, v_staff.name, v_start,
                          v_q.list_price, v_q.discount_amount, v_q.gift_amount, v_q.total;
      RETURN;
    EXCEPTION WHEN exclusion_violation THEN
      NULL; -- taken concurrently: try the next eligible staff member
    END;
  END LOOP;

  RAISE EXCEPTION 'SLOT_UNAVAILABLE';
END;
$$;
REVOKE ALL ON FUNCTION public.book_appointment(uuid, uuid, date, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_appointment(uuid, uuid, date, text, text, text, text, text, text) TO PUBLIC;

-- Refund the gift card when a paid-by-card appointment is cancelled
CREATE OR REPLACE FUNCTION public.refund_gift_on_cancel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' AND NEW.gift_card_id IS NOT NULL AND NEW.gift_amount > 0 THEN
    UPDATE gift_cards
    SET balance = CASE WHEN kind = 'value' THEN balance + NEW.gift_amount ELSE balance END,
        sessions_left = CASE WHEN kind = 'sessions' THEN least(sessions_left + 1, sessions_total) ELSE sessions_left END
    WHERE id = NEW.gift_card_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_appointments_gift_refund ON appointments;
CREATE TRIGGER trg_appointments_gift_refund AFTER UPDATE OF status ON appointments
  FOR EACH ROW EXECUTE FUNCTION public.refund_gift_on_cancel();

-- ============================================================
-- 11. REVIEWS RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_review(p_appointment_id uuid, p_rating int, p_comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_apt record;
BEGIN
  SELECT a.id, a.status, a.customer_id, a.service_id, a.staff_id INTO v_apt
  FROM appointments a JOIN customers c ON c.id = a.customer_id
  WHERE a.id = p_appointment_id AND c.user_id = auth.uid();
  IF v_apt.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_apt.status <> 'completed' THEN RAISE EXCEPTION 'NOT_COMPLETED'; END IF;
  IF p_rating NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'INVALID_RATING'; END IF;
  INSERT INTO reviews (appointment_id, customer_id, service_id, staff_id, rating, comment)
  VALUES (v_apt.id, v_apt.customer_id, v_apt.service_id, v_apt.staff_id, p_rating, nullif(left(trim(p_comment), 1000), ''))
  ON CONFLICT (appointment_id) DO NOTHING;
  IF NOT FOUND THEN RAISE EXCEPTION 'ALREADY_REVIEWED'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_review(uuid, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_review(uuid, int, text) TO PUBLIC;

-- Public: only first name (given name = last word in Vietnamese) + service; never phone / full name
CREATE OR REPLACE FUNCTION public.get_public_reviews(p_limit int DEFAULT 6)
RETURNS TABLE (id uuid, rating int, comment text, author text, service_name text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.rating, r.comment,
         regexp_replace(trim(c.name), '^.*\s', ''),
         s.name, r.created_at
  FROM reviews r
  JOIN customers c ON c.id = r.customer_id
  LEFT JOIN services s ON s.id = r.service_id
  WHERE r.is_published AND r.comment IS NOT NULL
  ORDER BY r.rating DESC, r.created_at DESC
  LIMIT least(greatest(p_limit, 1), 20);
$$;

CREATE OR REPLACE FUNCTION public.get_review_summary()
RETURNS TABLE (average numeric, total int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT round(avg(rating)::numeric, 1), count(*)::int FROM reviews WHERE is_published;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_reviews(int) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_review_summary() TO PUBLIC;

-- ============================================================
-- 12. LEADS RPC (public form)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_lead(p_name text, p_phone text, p_interest text DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_phone text := public._digits(p_phone);
BEGIN
  IF coalesce(trim(p_name), '') = '' OR v_phone !~ '^(0|84)\d{8,10}$' THEN
    RAISE EXCEPTION 'INVALID_LEAD';
  END IF;
  -- Basic abuse guard for a public form
  IF (SELECT count(*) FROM leads WHERE created_at > now() - interval '10 minutes') >= 30 THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;
  -- Same phone asked again within a day: update the open request instead of duplicating it
  SELECT id INTO v_id FROM leads
  WHERE public._digits(phone) = v_phone AND status = 'new' AND created_at > now() - interval '1 day'
  ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NOT NULL THEN
    UPDATE leads SET interest = coalesce(nullif(trim(p_interest), ''), interest),
                     note = coalesce(nullif(left(trim(p_note), 500), ''), note)
    WHERE id = v_id;
    RETURN v_id;
  END IF;
  INSERT INTO leads (name, phone, interest, note)
  VALUES (left(trim(p_name), 100), trim(p_phone), nullif(left(trim(p_interest), 100), ''), nullif(left(trim(p_note), 500), ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_lead(text, text, text, text) TO PUBLIC;


-- ── File: 20260927000000_package_pricing.sql ──────────────────────────────────────
/*
# Package pricing for session cards + discount reason

A session card sold from a package (e.g. 5 buổi massage body = 1.900.000 ₫) used to book each session at the
full list price (450.000 ₫), overstating revenue. Now:
- gift_cards.session_value = package price / sessions, filled automatically when a card is issued from a package
- booking with that card records the saving as a discount with discount_reason = 'package', so
  appointments.price = 380.000 ₫ (the real revenue), all of it prepaid by the card (customer pays 0 at the spa)
- appointments.discount_reason = 'first_visit' | 'package' so the UI labels discounts correctly
*/

ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS session_value integer CHECK (session_value IS NULL OR session_value >= 0);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS discount_reason text CHECK (discount_reason IS NULL OR discount_reason IN ('first_visit', 'package'));
UPDATE appointments SET discount_reason = 'first_visit' WHERE discount_amount > 0 AND discount_reason IS NULL;

CREATE OR REPLACE FUNCTION public.gift_card_session_value()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'sessions' AND NEW.session_value IS NULL AND NEW.package_id IS NOT NULL THEN
    SELECT round(price::numeric / sessions) INTO NEW.session_value FROM service_packages WHERE id = NEW.package_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_gift_cards_session_value ON gift_cards;
CREATE TRIGGER trg_gift_cards_session_value BEFORE INSERT OR UPDATE OF package_id ON gift_cards
  FOR EACH ROW EXECUTE FUNCTION public.gift_card_session_value();
UPDATE gift_cards g SET session_value = round(p.price::numeric / p.sessions)
FROM service_packages p WHERE p.id = g.package_id AND g.kind = 'sessions' AND g.session_value IS NULL;

-- Return types change → drop and recreate
DROP FUNCTION IF EXISTS public.booking_quote(uuid, text, text);
DROP FUNCTION IF EXISTS public.book_appointment(uuid, uuid, date, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public._price_booking(uuid, uuid, text, text, boolean, boolean);


CREATE OR REPLACE FUNCTION public._price_booking(
  p_service_id uuid, p_customer_id uuid, p_phone text, p_gift_code text, p_first_visit_ok boolean, p_lock boolean
)
RETURNS TABLE (list_price int, discount_amount int, discount_pct int, discount_reason text, gift_card_id uuid, gift_amount int, gift_kind text, gift_error text, total int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_price int;
  v_set app_settings%ROWTYPE;
  v_disc int := 0;
  v_pct int := 0;
  v_reason text := NULL;
  v_card gift_cards%ROWTYPE;
  v_gift int := 0;
  v_err text := NULL;
  v_phone text := public._digits(p_phone);
BEGIN
  SELECT price INTO v_price FROM services WHERE id = p_service_id AND is_active;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'SERVICE_NOT_FOUND';
  END IF;

  -- First online visit: no earlier non-cancelled appointment for this customer or this phone number
  SELECT * INTO v_set FROM app_settings WHERE id = 1;
  IF p_first_visit_ok AND v_set.first_visit_enabled AND v_set.first_visit_discount_pct > 0
     AND NOT EXISTS (
       SELECT 1 FROM appointments a JOIN customers c ON c.id = a.customer_id
       WHERE a.status <> 'cancelled'
         AND (c.id = p_customer_id OR (length(v_phone) >= 9 AND public._digits(c.phone) = v_phone))
     ) THEN
    v_pct := v_set.first_visit_discount_pct;
    v_disc := round(v_price * v_pct / 100.0 / 1000) * 1000; -- round to 1.000 ₫
    v_reason := 'first_visit';
  END IF;

  IF nullif(trim(p_gift_code), '') IS NOT NULL THEN
    IF p_lock THEN
      SELECT * INTO v_card FROM gift_cards WHERE code = upper(trim(p_gift_code)) FOR UPDATE;
    ELSE
      SELECT * INTO v_card FROM gift_cards WHERE code = upper(trim(p_gift_code));
    END IF;

    IF v_card.id IS NULL THEN
      v_err := 'GIFT_NOT_FOUND';
    ELSIF NOT v_card.is_active THEN
      v_err := 'GIFT_INACTIVE';
    ELSIF v_card.expires_at IS NOT NULL AND v_card.expires_at < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
      v_err := 'GIFT_EXPIRED';
    ELSIF v_card.kind = 'value' AND v_card.balance <= 0 THEN
      v_err := 'GIFT_EMPTY';
    ELSIF v_card.kind = 'sessions' AND v_card.sessions_left <= 0 THEN
      v_err := 'GIFT_EMPTY';
    ELSIF v_card.kind = 'sessions' AND v_card.service_id <> p_service_id THEN
      v_err := 'GIFT_WRONG_SERVICE';
    ELSIF v_card.kind = 'sessions' THEN
      -- A session card pays the whole service; the first-visit discount does not stack with it.
      -- Sold as a package (cheaper per session): the saving is recorded as a package discount so
      -- appointments.price = what the customer actually paid for this session (correct revenue).
      v_pct := 0;
      IF v_card.session_value IS NOT NULL AND v_card.session_value < v_price THEN
        v_disc := v_price - v_card.session_value; v_reason := 'package';
      ELSE
        v_disc := 0; v_reason := NULL;
      END IF;
      v_gift := v_price - v_disc;
    ELSE
      v_gift := least(v_card.balance, v_price - v_disc);
    END IF;
  END IF;

  RETURN QUERY SELECT v_price, v_disc, v_pct, CASE WHEN v_disc > 0 THEN v_reason END,
    CASE WHEN v_err IS NULL AND v_gift > 0 THEN v_card.id END,
    CASE WHEN v_err IS NULL THEN v_gift ELSE 0 END,
    CASE WHEN v_err IS NULL THEN v_card.kind END,
    v_err,
    v_price - v_disc - CASE WHEN v_err IS NULL THEN v_gift ELSE 0 END;
END;
$$;
REVOKE ALL ON FUNCTION public._price_booking(uuid, uuid, text, text, boolean, boolean) FROM PUBLIC, anon, authenticated;


CREATE OR REPLACE FUNCTION public.booking_quote(p_service_id uuid, p_phone text, p_gift_code text DEFAULT NULL)
RETURNS TABLE (list_price int, discount_amount int, discount_pct int, discount_reason text, gift_amount int, gift_kind text, gift_error text, total int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_front boolean := public.app_role() IN ('admin', 'staff');
  v_customer uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT v_front THEN
    SELECT id INTO v_customer FROM customers WHERE user_id = auth.uid();
  END IF;
  RETURN QUERY
    SELECT q.list_price, q.discount_amount, q.discount_pct, q.discount_reason, q.gift_amount, q.gift_kind, q.gift_error, q.total
    FROM public._price_booking(p_service_id, v_customer, CASE WHEN v_front THEN NULL ELSE p_phone END, p_gift_code, NOT v_front, false) q;
END;
$$;
REVOKE ALL ON FUNCTION public.booking_quote(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booking_quote(uuid, text, text) TO PUBLIC;


CREATE OR REPLACE FUNCTION public.book_appointment(
  p_service_id uuid,
  p_staff_id uuid,
  p_date date,
  p_time text,
  p_name text,
  p_phone text,
  p_email text,
  p_notes text,
  p_gift_code text DEFAULT NULL
)
RETURNS TABLE (booking_code text, staff_id uuid, staff_name text, start_time timestamptz,
               list_price int, discount_amount int, discount_reason text, gift_amount int, total int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_uid uuid := auth.uid();
  v_front boolean := public.app_role() IN ('admin', 'staff');
  v_svc services%ROWTYPE;
  v_customer uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_staff record;
  v_code text;
  v_q record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF coalesce(trim(p_name), '') = '' OR length(public._digits(p_phone)) < 9 THEN
    RAISE EXCEPTION 'INVALID_CUSTOMER';
  END IF;
  IF p_date > (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 60 THEN
    RAISE EXCEPTION 'DATE_TOO_FAR';
  END IF;

  SELECT * INTO v_svc FROM services WHERE id = p_service_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERVICE_NOT_FOUND';
  END IF;

  v_start := (p_date + p_time::time) AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_end := v_start + make_interval(mins => v_svc.duration_min);

  IF v_front THEN
    -- Front desk booking on behalf of a walk-in / phone customer: match by phone, else create.
    SELECT id INTO v_customer FROM customers
    WHERE public._digits(phone) = public._digits(p_phone)
    ORDER BY (user_id IS NULL), created_at
    LIMIT 1;
    IF v_customer IS NULL THEN
      INSERT INTO customers (name, phone, email)
      VALUES (trim(p_name), trim(p_phone), nullif(trim(p_email), ''))
      RETURNING id INTO v_customer;
    END IF;
  ELSE
    SELECT id INTO v_customer FROM customers WHERE user_id = v_uid;
  END IF;

  -- Price before creating / updating the customer row so "first visit" is evaluated correctly
  SELECT * INTO v_q FROM public._price_booking(p_service_id, v_customer, p_phone, p_gift_code, NOT v_front, true);
  IF v_q.gift_error IS NOT NULL THEN
    RAISE EXCEPTION '%', v_q.gift_error;
  END IF;

  IF NOT v_front THEN
    IF v_customer IS NULL THEN
      INSERT INTO customers (name, phone, email, user_id)
      VALUES (trim(p_name), trim(p_phone), nullif(trim(p_email), ''), v_uid)
      RETURNING id INTO v_customer;
    ELSE
      UPDATE customers
      SET name = trim(p_name), phone = trim(p_phone), email = nullif(trim(p_email), '')
      WHERE id = v_customer;
    END IF;
  END IF;

  FOR v_staff IN
    SELECT s.id, s.name
    FROM staff s
    WHERE (p_staff_id IS NULL OR s.id = p_staff_id)
      AND EXISTS (
        SELECT 1 FROM public.get_available_slots(p_service_id, s.id, p_date) g
        WHERE g.slot_time = to_char(p_time::time, 'HH24:MI')
      )
    ORDER BY (
      SELECT count(*) FROM appointments a
      WHERE a.staff_id = s.id
        AND a.status NOT IN ('cancelled', 'no_show')
        AND (a.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = p_date
    ), s.name
  LOOP
    BEGIN
      INSERT INTO appointments (customer_id, staff_id, service_id, start_time, end_time, status,
                                price, list_price, discount_amount, discount_reason, gift_card_id, gift_amount,
                                duration_min, notes, source)
      VALUES (v_customer, v_staff.id, p_service_id, v_start, v_end, 'confirmed',
              v_q.list_price - v_q.discount_amount, v_q.list_price, v_q.discount_amount, v_q.discount_reason, v_q.gift_card_id, v_q.gift_amount,
              v_svc.duration_min, nullif(trim(p_notes), ''), CASE WHEN v_front THEN 'front_desk' ELSE 'online' END)
      RETURNING appointments.booking_code INTO v_code;

      IF v_q.gift_card_id IS NOT NULL THEN
        UPDATE gift_cards
        SET balance = CASE WHEN kind = 'value' THEN balance - v_q.gift_amount ELSE balance END,
            sessions_left = CASE WHEN kind = 'sessions' THEN sessions_left - 1 ELSE sessions_left END
        WHERE id = v_q.gift_card_id;
      END IF;

      RETURN QUERY SELECT v_code, v_staff.id, v_staff.name, v_start,
                          v_q.list_price, v_q.discount_amount, v_q.discount_reason, v_q.gift_amount, v_q.total;
      RETURN;
    EXCEPTION WHEN exclusion_violation THEN
      NULL; -- taken concurrently: try the next eligible staff member
    END;
  END LOOP;

  RAISE EXCEPTION 'SLOT_UNAVAILABLE';
END;
$$;
REVOKE ALL ON FUNCTION public.book_appointment(uuid, uuid, date, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_appointment(uuid, uuid, date, text, text, text, text, text, text) TO PUBLIC;



-- ── File: 20260928000000_conversion_logic.sql ──────────────────────────────────────
/*
# Conversion logic (vòng 8)

1. Guest booking with phone OTP — handle_new_user supports phone-only accounts and takes over the
   walk-in customer row the front desk created for the same (verified) number.
2. Slot holds — hold_slot() keeps the chosen time for 10 minutes while the guest fills in the form / OTP.
   get_available_slots() ignores the caller's own hold (p_holder) and can ignore one appointment (reschedule).
3. Reschedule — reschedule_appointment(): customer (≥ 2h before, max 2 times) or admin; keeps code, price, card.
4. Return-visit voucher — a completed appointment issues a personal "giảm X% lần sau" code (gift_cards kind 'percent').
5. Review requests — tokenised review link (no login) + review_requests queue for the front desk.
6. No-show guard — customers with ≥ N no-shows get 'pending' (spa confirms by phone) instead of 'confirmed'.
7. Front-desk first-visit discount — optional p_apply_first_visit for bookings made on behalf of a customer.
*/

-- ============================================================
-- SETTINGS
-- ============================================================
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS return_visit_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS return_visit_pct int NOT NULL DEFAULT 10 CHECK (return_visit_pct BETWEEN 1 AND 50);
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS return_visit_days int NOT NULL DEFAULT 30 CHECK (return_visit_days BETWEEN 1 AND 365);
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS no_show_threshold int NOT NULL DEFAULT 2 CHECK (no_show_threshold BETWEEN 0 AND 10); -- 0 = off

-- ============================================================
-- 1. PHONE (OTP) ACCOUNTS
-- ============================================================
/* Supabase stores auth.users.phone as E.164 digits without '+', e.g. 84901234567 → shown as 0901234567. */
CREATE OR REPLACE FUNCTION public._vn_phone(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN public._digits(p) ~ '^84\d{9,10}$' THEN '0' || substr(public._digits(p), 3) ELSE public._digits(p) END
$$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_phone text := nullif(public._vn_phone(NEW.phone), '');
  v_claimed uuid;
BEGIN
  INSERT INTO profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'customer')
  ON CONFLICT (id) DO NOTHING;

  -- Phone account: take over the walk-in customer created by the front desk for this number
  -- (only the owner of the number can ever get a session for this auth user, so history stays private).
  IF v_phone IS NOT NULL THEN
    UPDATE customers SET user_id = NEW.id
    WHERE id = (SELECT id FROM customers
                WHERE user_id IS NULL AND public._vn_phone(phone) = v_phone
                ORDER BY created_at LIMIT 1)
    RETURNING id INTO v_claimed;
    IF v_claimed IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO customers (name, phone, email, user_id)
  VALUES (
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''), NULLIF(split_part(NEW.email, '@', 1), ''), 'Khách'),
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'phone'), ''), v_phone, ''),
    NEW.email,
    NEW.id
  )
  ON CONFLICT (user_id) WHERE user_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. SLOT HOLDS
-- ============================================================
CREATE TABLE IF NOT EXISTS slot_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holder uuid NOT NULL,                 -- random id kept by the browser tab
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  client_ip text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_slot_holds_staff ON slot_holds (staff_id, start_time);
CREATE INDEX IF NOT EXISTS idx_slot_holds_holder ON slot_holds (holder);
ALTER TABLE slot_holds ENABLE ROW LEVEL SECURITY; -- no policies: RPC access only

DROP FUNCTION IF EXISTS public.get_available_slots(uuid, uuid, date);
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_service_id uuid,
  p_staff_id uuid,
  p_date date,
  p_holder uuid DEFAULT NULL,             -- the caller's own hold does not block them
  p_ignore_appointment uuid DEFAULT NULL  -- rescheduling: the appointment being moved does not block itself
)
RETURNS TABLE (slot_time text, staff_count int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH svc AS (
    SELECT make_interval(mins => duration_min) AS dur
    FROM services WHERE id = p_service_id AND is_active
  ),
  eligible AS (
    SELECT s.id
    FROM staff s
    JOIN staff_services ss ON ss.staff_id = s.id AND ss.service_id = p_service_id
    WHERE s.is_active
      AND (p_staff_id IS NULL OR s.id = p_staff_id)
      AND NOT EXISTS (SELECT 1 FROM staff_time_off t WHERE t.staff_id = s.id AND t.date = p_date)
  ),
  candidates AS (
    SELECT e.id AS staff_id, gs AS local_start, gs + svc.dur AS local_end,
           sc.break_start, sc.break_end
    FROM eligible e
    JOIN staff_schedules sc ON sc.staff_id = e.id AND sc.day_of_week = extract(dow FROM p_date)::int
    CROSS JOIN svc
    CROSS JOIN LATERAL generate_series(
      p_date + sc.start_time,
      p_date + sc.end_time - svc.dur,
      interval '30 minutes'
    ) AS gs
  )
  SELECT to_char(c.local_start, 'HH24:MI') AS slot_time,
         count(DISTINCT c.staff_id)::int AS staff_count
  FROM candidates c
  WHERE (c.local_start AT TIME ZONE 'Asia/Ho_Chi_Minh') > now()
    AND (c.break_start IS NULL
         OR NOT (c.local_start::time < c.break_end AND c.local_end::time > c.break_start))
    AND NOT EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.staff_id = c.staff_id
        AND a.status NOT IN ('cancelled', 'completed', 'no_show')
        AND a.id IS DISTINCT FROM p_ignore_appointment
        AND a.start_time < (c.local_end AT TIME ZONE 'Asia/Ho_Chi_Minh')
        AND a.end_time > (c.local_start AT TIME ZONE 'Asia/Ho_Chi_Minh')
    )
    AND NOT EXISTS (
      SELECT 1 FROM slot_holds h
      WHERE h.staff_id = c.staff_id
        AND h.expires_at > now()
        AND h.holder IS DISTINCT FROM p_holder
        AND h.start_time < (c.local_end AT TIME ZONE 'Asia/Ho_Chi_Minh')
        AND h.end_time > (c.local_start AT TIME ZONE 'Asia/Ho_Chi_Minh')
    )
  GROUP BY 1
  ORDER BY 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid, uuid, date, uuid, uuid) TO PUBLIC;

/*
  Hold a slot for 10 minutes (best effort — the UI ignores errors).
  Abuse guard: max 3 active holds per client IP, 200 overall.
*/
CREATE OR REPLACE FUNCTION public.hold_slot(p_service_id uuid, p_staff_id uuid, p_date date, p_time text, p_holder uuid)
RETURNS TABLE (staff_id uuid, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_ip text := nullif(trim(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1)), '');
  v_dur int;
  v_start timestamptz;
  v_staff uuid;
  v_exp timestamptz := now() + interval '10 minutes';
BEGIN
  IF p_holder IS NULL THEN RAISE EXCEPTION 'INVALID_HOLDER'; END IF;
  DELETE FROM slot_holds WHERE holder = p_holder OR slot_holds.expires_at < now() - interval '1 hour';

  IF (SELECT count(*) FROM slot_holds h WHERE h.expires_at > now()) >= 200
     OR (v_ip IS NOT NULL AND (SELECT count(*) FROM slot_holds h WHERE h.client_ip = v_ip AND h.expires_at > now()) >= 3) THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  SELECT duration_min INTO v_dur FROM services WHERE id = p_service_id AND is_active;
  IF v_dur IS NULL THEN RAISE EXCEPTION 'SERVICE_NOT_FOUND'; END IF;
  v_start := (p_date + p_time::time) AT TIME ZONE 'Asia/Ho_Chi_Minh';

  SELECT s.id INTO v_staff
  FROM staff s
  WHERE (p_staff_id IS NULL OR s.id = p_staff_id)
    AND EXISTS (SELECT 1 FROM public.get_available_slots(p_service_id, s.id, p_date, p_holder) g
                WHERE g.slot_time = to_char(p_time::time, 'HH24:MI'))
  ORDER BY (SELECT count(*) FROM appointments a
            WHERE a.staff_id = s.id AND a.status NOT IN ('cancelled', 'no_show')
              AND (a.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = p_date), s.name
  LIMIT 1;
  IF v_staff IS NULL THEN RAISE EXCEPTION 'SLOT_UNAVAILABLE'; END IF;

  INSERT INTO slot_holds (holder, staff_id, service_id, start_time, end_time, expires_at, client_ip)
  VALUES (p_holder, v_staff, p_service_id, v_start, v_start + make_interval(mins => v_dur), v_exp, v_ip);
  RETURN QUERY SELECT v_staff, v_exp;
END;
$$;
GRANT EXECUTE ON FUNCTION public.hold_slot(uuid, uuid, date, text, uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION public.release_hold(p_holder uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM slot_holds WHERE holder = p_holder;
$$;
GRANT EXECUTE ON FUNCTION public.release_hold(uuid) TO PUBLIC;

-- ============================================================
-- 3. RESCHEDULE
-- ============================================================
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reschedule_count int NOT NULL DEFAULT 0;
ALTER TABLE appointment_logs ADD COLUMN IF NOT EXISTS note text;

CREATE OR REPLACE FUNCTION public.reschedule_appointment(p_id uuid, p_date date, p_time text, p_staff_id uuid DEFAULT NULL)
RETURNS TABLE (start_time timestamptz, staff_id uuid, staff_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_admin boolean := public.is_admin();
  v_apt appointments%ROWTYPE;
  v_owner uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_staff record;
BEGIN
  SELECT a.* INTO v_apt FROM appointments a WHERE a.id = p_id;
  SELECT c.user_id INTO v_owner FROM customers c WHERE c.id = v_apt.customer_id;
  IF v_apt.id IS NULL OR NOT (v_admin OR (auth.uid() IS NOT NULL AND v_owner = auth.uid())) THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  IF v_apt.status NOT IN ('pending', 'confirmed') THEN RAISE EXCEPTION 'NOT_RESCHEDULABLE'; END IF;
  IF NOT v_admin THEN
    IF v_apt.start_time < now() + interval '2 hours' THEN RAISE EXCEPTION 'TOO_LATE'; END IF;
    IF v_apt.reschedule_count >= 2 THEN RAISE EXCEPTION 'RESCHEDULE_LIMIT'; END IF;
  END IF;
  IF p_date > (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 60 THEN RAISE EXCEPTION 'DATE_TOO_FAR'; END IF;

  v_start := (p_date + p_time::time) AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_end := v_start + make_interval(mins => v_apt.duration_min);

  FOR v_staff IN
    SELECT s.id, s.name FROM staff s
    WHERE (p_staff_id IS NULL OR s.id = p_staff_id)
      AND EXISTS (SELECT 1 FROM public.get_available_slots(v_apt.service_id, s.id, p_date, NULL, p_id) g
                  WHERE g.slot_time = to_char(p_time::time, 'HH24:MI'))
    ORDER BY (s.id = v_apt.staff_id) DESC, s.name  -- keep the same therapist when possible
  LOOP
    BEGIN
      UPDATE appointments
      SET start_time = v_start, end_time = v_end, staff_id = v_staff.id,
          reminded_at = NULL, reschedule_count = reschedule_count + 1
      WHERE id = p_id;
      INSERT INTO appointment_logs (appointment_id, old_status, new_status, changed_by, note)
      VALUES (p_id, v_apt.status, v_apt.status,
              COALESCE((SELECT email FROM profiles WHERE id = auth.uid()), auth.uid()::text),
              'Đổi giờ: ' || to_char(v_apt.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM')
                || ' → ' || to_char(v_start AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM')
                || CASE WHEN v_staff.id <> v_apt.staff_id THEN ' (' || v_staff.name || ')' ELSE '' END);
      RETURN QUERY SELECT v_start, v_staff.id, v_staff.name;
      RETURN;
    EXCEPTION WHEN exclusion_violation THEN
      NULL;
    END;
  END LOOP;
  RAISE EXCEPTION 'SLOT_UNAVAILABLE';
END;
$$;
REVOKE ALL ON FUNCTION public.reschedule_appointment(uuid, date, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment(uuid, date, text, uuid) TO PUBLIC;

-- ============================================================
-- 4. RETURN-VISIT VOUCHERS (gift_cards kind 'percent')
-- ============================================================
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS percent_off int CHECK (percent_off IS NULL OR percent_off BETWEEN 1 AND 100);
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS source_appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL;
ALTER TABLE gift_cards DROP CONSTRAINT IF EXISTS gift_cards_kind_check;
ALTER TABLE gift_cards ADD CONSTRAINT gift_cards_kind_check CHECK (kind IN ('value', 'sessions', 'percent'));
ALTER TABLE gift_cards DROP CONSTRAINT IF EXISTS gift_cards_check;
ALTER TABLE gift_cards ADD CONSTRAINT gift_cards_check CHECK (
  (kind = 'value' AND initial_value IS NOT NULL AND balance IS NOT NULL)
  OR (kind = 'sessions' AND service_id IS NOT NULL AND sessions_total IS NOT NULL AND sessions_left IS NOT NULL)
  OR (kind = 'percent' AND percent_off IS NOT NULL AND sessions_total IS NOT NULL AND sessions_left IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_gift_cards_customer ON gift_cards (customer_id) WHERE customer_id IS NOT NULL;

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_discount_reason_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_discount_reason_check
  CHECK (discount_reason IS NULL OR discount_reason IN ('first_visit', 'package', 'return_visit'));

CREATE OR REPLACE FUNCTION public.issue_return_voucher()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_set app_settings%ROWTYPE;
  v_c customers%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
BEGIN
  SELECT * INTO v_set FROM app_settings WHERE id = 1;
  IF NOT v_set.return_visit_enabled THEN RETURN NEW; END IF;
  -- one open voucher per customer at a time
  IF EXISTS (SELECT 1 FROM gift_cards g WHERE g.customer_id = NEW.customer_id AND g.kind = 'percent'
             AND g.is_active AND g.sessions_left > 0 AND (g.expires_at IS NULL OR g.expires_at >= v_today)) THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_c FROM customers WHERE id = NEW.customer_id;
  INSERT INTO gift_cards (kind, percent_off, sessions_total, sessions_left, customer_id, recipient_name, recipient_phone,
                          expires_at, note, source_appointment_id, created_by)
  VALUES ('percent', v_set.return_visit_pct, 1, 1, NEW.customer_id, v_c.name, v_c.phone,
          v_today + v_set.return_visit_days, 'Quà cảm ơn sau buổi hẹn — tự động', NEW.id, 'Tự động');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_appointments_return_voucher ON appointments;
CREATE TRIGGER trg_appointments_return_voucher AFTER UPDATE OF status ON appointments
  FOR EACH ROW WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION public.issue_return_voucher();

-- Refund on cancel: value → balance back; sessions / percent → one use back
CREATE OR REPLACE FUNCTION public.refund_gift_on_cancel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' AND NEW.gift_card_id IS NOT NULL THEN
    UPDATE gift_cards
    SET balance = CASE WHEN kind = 'value' THEN balance + NEW.gift_amount ELSE balance END,
        sessions_left = CASE WHEN kind IN ('sessions', 'percent') THEN least(sessions_left + 1, sessions_total) ELSE sessions_left END
    WHERE id = NEW.gift_card_id;
  END IF;
  RETURN NEW;
END;
$$;

/* The signed-in customer's own active cards and vouchers (issued to them, or to their verified phone number). */
CREATE OR REPLACE FUNCTION public.my_vouchers()
RETURNS TABLE (code text, kind text, percent_off int, balance int, sessions_left int, service_name text, expires_at date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT c.id AS customer_id,
           (SELECT public._vn_phone(u.phone) FROM auth.users u WHERE u.id = auth.uid() AND u.phone_confirmed_at IS NOT NULL) AS phone
    FROM customers c WHERE c.user_id = auth.uid()
  )
  SELECT g.code, g.kind, g.percent_off, g.balance, g.sessions_left, s.name, g.expires_at
  FROM gift_cards g
  CROSS JOIN me
  LEFT JOIN services s ON s.id = g.service_id
  WHERE g.is_active
    AND (g.expires_at IS NULL OR g.expires_at >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
    AND ((g.kind = 'value' AND g.balance > 0) OR (g.kind <> 'value' AND g.sessions_left > 0))
    AND (g.customer_id = me.customer_id OR (me.phone IS NOT NULL AND public._vn_phone(g.recipient_phone) = me.phone))
  ORDER BY g.expires_at NULLS LAST;
$$;
REVOKE ALL ON FUNCTION public.my_vouchers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_vouchers() TO PUBLIC;

-- ============================================================
-- PRICING + BOOKING (percent vouchers, front-desk first visit, holds, no-show guard)
-- ============================================================
DROP FUNCTION IF EXISTS public.booking_quote(uuid, text, text);
DROP FUNCTION IF EXISTS public.book_appointment(uuid, uuid, date, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public._price_booking(uuid, uuid, text, text, boolean, boolean);

CREATE OR REPLACE FUNCTION public._price_booking(
  p_service_id uuid, p_customer_id uuid, p_phone text, p_gift_code text, p_first_visit_ok boolean, p_lock boolean
)
RETURNS TABLE (list_price int, discount_amount int, discount_pct int, discount_reason text, gift_card_id uuid,
               gift_amount int, gift_kind text, gift_error text, total int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_price int;
  v_set app_settings%ROWTYPE;
  v_disc int := 0;
  v_pct int := 0;
  v_reason text := NULL;
  v_card gift_cards%ROWTYPE;
  v_use_card boolean := false;
  v_gift int := 0;
  v_err text := NULL;
  v_tmp int;
  v_phone text := public._vn_phone(p_phone);
BEGIN
  SELECT price INTO v_price FROM services WHERE id = p_service_id AND is_active;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'SERVICE_NOT_FOUND';
  END IF;

  -- First visit: no earlier non-cancelled appointment for this customer or this phone number
  SELECT * INTO v_set FROM app_settings WHERE id = 1;
  IF p_first_visit_ok AND v_set.first_visit_enabled AND v_set.first_visit_discount_pct > 0
     AND NOT EXISTS (
       SELECT 1 FROM appointments a JOIN customers c ON c.id = a.customer_id
       WHERE a.status <> 'cancelled'
         AND (c.id = p_customer_id OR (length(v_phone) >= 9 AND public._vn_phone(c.phone) = v_phone))
     ) THEN
    v_pct := v_set.first_visit_discount_pct;
    v_disc := round(v_price * v_pct / 100.0 / 1000) * 1000; -- round to 1.000 ₫
    v_reason := 'first_visit';
  END IF;

  IF nullif(trim(p_gift_code), '') IS NOT NULL THEN
    IF p_lock THEN
      SELECT * INTO v_card FROM gift_cards WHERE code = upper(trim(p_gift_code)) FOR UPDATE;
    ELSE
      SELECT * INTO v_card FROM gift_cards WHERE code = upper(trim(p_gift_code));
    END IF;

    IF v_card.id IS NULL THEN
      v_err := 'GIFT_NOT_FOUND';
    ELSIF NOT v_card.is_active THEN
      v_err := 'GIFT_INACTIVE';
    ELSIF v_card.expires_at IS NOT NULL AND v_card.expires_at < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
      v_err := 'GIFT_EXPIRED';
    ELSIF v_card.kind = 'value' AND v_card.balance <= 0 THEN
      v_err := 'GIFT_EMPTY';
    ELSIF v_card.kind IN ('sessions', 'percent') AND v_card.sessions_left <= 0 THEN
      v_err := 'GIFT_EMPTY';
    ELSIF v_card.kind = 'sessions' AND v_card.service_id <> p_service_id THEN
      v_err := 'GIFT_WRONG_SERVICE';
    ELSIF v_card.kind = 'percent' AND v_card.customer_id IS NOT NULL
          AND v_card.customer_id IS DISTINCT FROM p_customer_id
          AND public._vn_phone(v_card.recipient_phone) IS DISTINCT FROM v_phone THEN
      v_err := 'GIFT_NOT_YOURS'; -- personal voucher
    ELSIF v_card.kind = 'sessions' THEN
      -- A session card pays the whole service; the first-visit discount does not stack with it.
      -- Sold as a package: the saving is a package discount so price = what was actually paid.
      v_pct := 0;
      IF v_card.session_value IS NOT NULL AND v_card.session_value < v_price THEN
        v_disc := v_price - v_card.session_value; v_reason := 'package';
      ELSE
        v_disc := 0; v_reason := NULL;
      END IF;
      v_gift := v_price - v_disc;
      v_use_card := true;
    ELSIF v_card.kind = 'percent' THEN
      -- Does not stack with the first-visit discount: the bigger one wins (the voucher stays unused otherwise)
      v_tmp := round(v_price * v_card.percent_off / 100.0 / 1000) * 1000;
      IF v_tmp > v_disc THEN
        v_disc := v_tmp; v_pct := v_card.percent_off; v_reason := 'return_visit'; v_use_card := true;
      END IF;
    ELSE
      v_gift := least(v_card.balance, v_price - v_disc);
      v_use_card := v_gift > 0;
    END IF;
  END IF;

  RETURN QUERY SELECT v_price, v_disc, v_pct, CASE WHEN v_disc > 0 THEN v_reason END,
    CASE WHEN v_err IS NULL AND v_use_card THEN v_card.id END,
    CASE WHEN v_err IS NULL THEN v_gift ELSE 0 END,
    CASE WHEN v_err IS NULL THEN v_card.kind END,
    v_err,
    v_price - v_disc - CASE WHEN v_err IS NULL THEN v_gift ELSE 0 END;
END;
$$;
REVOKE ALL ON FUNCTION public._price_booking(uuid, uuid, text, text, boolean, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.booking_quote(
  p_service_id uuid, p_phone text, p_gift_code text DEFAULT NULL, p_apply_first_visit boolean DEFAULT false
)
RETURNS TABLE (list_price int, discount_amount int, discount_pct int, discount_reason text, gift_amount int,
               gift_kind text, gift_error text, total int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_front boolean := public.app_role() IN ('admin', 'staff');
  v_customer uuid;
BEGIN
  -- Guests (not verified yet) get the list price + gift code check; the first-visit discount is
  -- decided at booking time, after the phone number is verified (no probing of who is a customer).
  IF auth.uid() IS NULL THEN
    RETURN QUERY
      SELECT q.list_price, q.discount_amount, q.discount_pct, q.discount_reason, q.gift_amount, q.gift_kind, q.gift_error, q.total
      FROM public._price_booking(p_service_id, NULL, p_phone, p_gift_code, false, false) q;
    RETURN;
  END IF;
  IF v_front THEN
    SELECT id INTO v_customer FROM customers WHERE public._vn_phone(phone) = public._vn_phone(p_phone)
    ORDER BY (user_id IS NULL), created_at LIMIT 1;
  ELSE
    SELECT id INTO v_customer FROM customers WHERE user_id = auth.uid();
  END IF;
  RETURN QUERY
    SELECT q.list_price, q.discount_amount, q.discount_pct, q.discount_reason, q.gift_amount, q.gift_kind, q.gift_error, q.total
    FROM public._price_booking(p_service_id, v_customer, p_phone, p_gift_code, NOT v_front OR p_apply_first_visit, false) q;
END;
$$;
GRANT EXECUTE ON FUNCTION public.booking_quote(uuid, text, text, boolean) TO PUBLIC;

CREATE OR REPLACE FUNCTION public.book_appointment(
  p_service_id uuid,
  p_staff_id uuid,
  p_date date,
  p_time text,
  p_name text,
  p_phone text,
  p_email text,
  p_notes text,
  p_gift_code text DEFAULT NULL,
  p_holder uuid DEFAULT NULL,
  p_apply_first_visit boolean DEFAULT false
)
RETURNS TABLE (booking_code text, staff_id uuid, staff_name text, start_time timestamptz, status text,
               list_price int, discount_amount int, discount_reason text, gift_amount int, total int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_uid uuid := auth.uid();
  v_front boolean := public.app_role() IN ('admin', 'staff');
  v_svc services%ROWTYPE;
  v_set app_settings%ROWTYPE;
  v_customer uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_staff record;
  v_code text;
  v_q record;
  v_status appointment_status := 'confirmed';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF coalesce(trim(p_name), '') = '' OR length(public._digits(p_phone)) < 9 THEN
    RAISE EXCEPTION 'INVALID_CUSTOMER';
  END IF;
  IF p_date > (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 60 THEN
    RAISE EXCEPTION 'DATE_TOO_FAR';
  END IF;

  SELECT * INTO v_svc FROM services WHERE id = p_service_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERVICE_NOT_FOUND';
  END IF;

  v_start := (p_date + p_time::time) AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_end := v_start + make_interval(mins => v_svc.duration_min);

  IF v_front THEN
    -- Front desk booking on behalf of a walk-in / phone customer: match by phone, else create.
    SELECT id INTO v_customer FROM customers
    WHERE public._vn_phone(phone) = public._vn_phone(p_phone)
    ORDER BY (user_id IS NULL), created_at
    LIMIT 1;
    IF v_customer IS NULL THEN
      INSERT INTO customers (name, phone, email)
      VALUES (trim(p_name), trim(p_phone), nullif(trim(p_email), ''))
      RETURNING id INTO v_customer;
    END IF;
  ELSE
    SELECT id INTO v_customer FROM customers WHERE user_id = v_uid;
  END IF;

  -- Price before creating / updating the customer row so "first visit" is evaluated correctly
  SELECT * INTO v_q FROM public._price_booking(p_service_id, v_customer, p_phone, p_gift_code, NOT v_front OR p_apply_first_visit, true);
  IF v_q.gift_error IS NOT NULL THEN
    RAISE EXCEPTION '%', v_q.gift_error;
  END IF;

  IF NOT v_front THEN
    IF v_customer IS NULL THEN
      INSERT INTO customers (name, phone, email, user_id)
      VALUES (trim(p_name), trim(p_phone), nullif(trim(p_email), ''), v_uid)
      RETURNING id INTO v_customer;
    ELSE
      UPDATE customers
      SET name = trim(p_name), phone = trim(p_phone), email = coalesce(nullif(trim(p_email), ''), email)
      WHERE id = v_customer;
    END IF;

    -- No-show guard: repeat no-shows book as 'pending' — the spa confirms by phone first
    SELECT * INTO v_set FROM app_settings WHERE id = 1;
    IF v_set.no_show_threshold > 0 AND (
      SELECT count(*) FROM appointments a JOIN customers c ON c.id = a.customer_id
      WHERE a.status = 'no_show'
        AND (c.id = v_customer OR public._vn_phone(c.phone) = public._vn_phone(p_phone))
    ) >= v_set.no_show_threshold THEN
      v_status := 'pending';
    END IF;
  END IF;

  FOR v_staff IN
    SELECT s.id, s.name
    FROM staff s
    WHERE (p_staff_id IS NULL OR s.id = p_staff_id)
      AND EXISTS (
        SELECT 1 FROM public.get_available_slots(p_service_id, s.id, p_date, p_holder) g
        WHERE g.slot_time = to_char(p_time::time, 'HH24:MI')
      )
    ORDER BY
      -- the therapist held for this browser tab first
      EXISTS (SELECT 1 FROM slot_holds h WHERE h.holder = p_holder AND h.staff_id = s.id
              AND h.start_time = v_start AND h.expires_at > now()) DESC,
      (SELECT count(*) FROM appointments a
       WHERE a.staff_id = s.id
         AND a.status NOT IN ('cancelled', 'no_show')
         AND (a.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = p_date),
      s.name
  LOOP
    BEGIN
      INSERT INTO appointments (customer_id, staff_id, service_id, start_time, end_time, status,
                                price, list_price, discount_amount, discount_reason, gift_card_id, gift_amount,
                                duration_min, notes, source)
      VALUES (v_customer, v_staff.id, p_service_id, v_start, v_end, v_status,
              v_q.list_price - v_q.discount_amount, v_q.list_price, v_q.discount_amount, v_q.discount_reason,
              v_q.gift_card_id, v_q.gift_amount,
              v_svc.duration_min, nullif(trim(p_notes), ''), CASE WHEN v_front THEN 'front_desk' ELSE 'online' END)
      RETURNING appointments.booking_code INTO v_code;

      IF v_q.gift_card_id IS NOT NULL THEN
        UPDATE gift_cards
        SET balance = CASE WHEN kind = 'value' THEN balance - v_q.gift_amount ELSE balance END,
            sessions_left = CASE WHEN kind IN ('sessions', 'percent') THEN sessions_left - 1 ELSE sessions_left END
        WHERE id = v_q.gift_card_id;
      END IF;
      IF p_holder IS NOT NULL THEN
        DELETE FROM slot_holds WHERE holder = p_holder;
      END IF;

      RETURN QUERY SELECT v_code, v_staff.id, v_staff.name, v_start, v_status::text,
                          v_q.list_price, v_q.discount_amount, v_q.discount_reason, v_q.gift_amount, v_q.total;
      RETURN;
    EXCEPTION WHEN exclusion_violation THEN
      NULL; -- taken concurrently: try the next eligible staff member
    END;
  END LOOP;

  RAISE EXCEPTION 'SLOT_UNAVAILABLE';
END;
$$;
REVOKE ALL ON FUNCTION public.book_appointment(uuid, uuid, date, text, text, text, text, text, text, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_appointment(uuid, uuid, date, text, text, text, text, text, text, uuid, boolean) TO PUBLIC;

-- ============================================================
-- 5. REVIEW REQUESTS (link without login)
-- ============================================================
CREATE TABLE IF NOT EXISTS review_requests (
  appointment_id uuid PRIMARY KEY REFERENCES appointments(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);
ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "review_requests_admin_all" ON review_requests;
CREATE POLICY "review_requests_admin_all" ON review_requests FOR ALL TO PUBLIC
  USING (public.is_admin()) WITH CHECK (public.is_admin());

/* Admin: get (or create) the review link token for a completed appointment. */
CREATE OR REPLACE FUNCTION public.review_request_token(p_appointment_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_token uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  INSERT INTO review_requests (appointment_id) VALUES (p_appointment_id) ON CONFLICT (appointment_id) DO NOTHING;
  SELECT token INTO v_token FROM review_requests WHERE appointment_id = p_appointment_id;
  RETURN v_token;
END;
$$;
REVOKE ALL ON FUNCTION public.review_request_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_request_token(uuid) TO PUBLIC;

/* Public (token): what the review page shows — given name only, plus the thank-you voucher. */
CREATE OR REPLACE FUNCTION public.get_review_invite(p_token uuid)
RETURNS TABLE (given_name text, service_name text, staff_name text, visit_date date, can_review boolean,
               reviewed boolean, voucher_code text, voucher_pct int, voucher_expires date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT regexp_replace(trim(c.name), '^.*\s', ''), s.name, st.name,
         (a.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
         a.status = 'completed' AND a.start_time > now() - interval '30 days',
         EXISTS (SELECT 1 FROM reviews r WHERE r.appointment_id = a.id),
         g.code, g.percent_off, g.expires_at
  FROM review_requests rr
  JOIN appointments a ON a.id = rr.appointment_id
  JOIN customers c ON c.id = a.customer_id
  LEFT JOIN services s ON s.id = a.service_id
  LEFT JOIN staff st ON st.id = a.staff_id
  LEFT JOIN LATERAL (
    SELECT g.code, g.percent_off, g.expires_at FROM gift_cards g
    WHERE g.source_appointment_id = a.id AND g.kind = 'percent' AND g.is_active AND g.sessions_left > 0
    LIMIT 1
  ) g ON true
  WHERE rr.token = p_token;
$$;
GRANT EXECUTE ON FUNCTION public.get_review_invite(uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION public.submit_review_by_token(p_token uuid, p_rating int, p_comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_apt record;
BEGIN
  SELECT a.id, a.status, a.customer_id, a.service_id, a.staff_id, a.start_time INTO v_apt
  FROM review_requests rr JOIN appointments a ON a.id = rr.appointment_id
  WHERE rr.token = p_token;
  IF v_apt.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_apt.status <> 'completed' THEN RAISE EXCEPTION 'NOT_COMPLETED'; END IF;
  IF v_apt.start_time < now() - interval '30 days' THEN RAISE EXCEPTION 'EXPIRED'; END IF;
  IF p_rating NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'INVALID_RATING'; END IF;
  INSERT INTO reviews (appointment_id, customer_id, service_id, staff_id, rating, comment)
  VALUES (v_apt.id, v_apt.customer_id, v_apt.service_id, v_apt.staff_id, p_rating, nullif(left(trim(p_comment), 1000), ''))
  ON CONFLICT (appointment_id) DO NOTHING;
  IF NOT FOUND THEN RAISE EXCEPTION 'ALREADY_REVIEWED'; END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_review_by_token(uuid, int, text) TO PUBLIC;


-- Tạm thời tắt triggers khi nạp dữ liệu lịch sử
SET session_replication_role = replica;

-- ── DATA: services (5 rows) ─────────────────
INSERT INTO services ("id", "name", "description", "duration_min", "price", "category", "image_url", "is_active", "created_at", "updated_at") VALUES ('e74979ff-2b4b-41fe-9a05-d38ada8b4d87', 'Massage Body Toàn Thân', 'Massage toàn thân giúp thư giãn cơ bắp, giảm stress và cải thiện tuần hoàn máu.', 60, 350000, 'Massage', NULL, TRUE, '2026-09-23T08:49:04.862763+00:00', '2026-09-23T08:49:04.862763+00:00') ON CONFLICT DO NOTHING;
INSERT INTO services ("id", "name", "description", "duration_min", "price", "category", "image_url", "is_active", "created_at", "updated_at") VALUES ('3eeec249-031e-4c6f-b85a-ef369a23cb7d', 'Massage Cổ Vai Gáy', 'Giảm đau mỏi cổ vai gáy, phù hợp người làm việc văn phòng.', 30, 180000, 'Massage', NULL, TRUE, '2026-09-23T08:49:04.862763+00:00', '2026-09-23T08:49:04.862763+00:00') ON CONFLICT DO NOTHING;
INSERT INTO services ("id", "name", "description", "duration_min", "price", "category", "image_url", "is_active", "created_at", "updated_at") VALUES ('b941ab04-b6af-4fb2-a77c-52581a40196c', 'Chăm Sóc Da Mặt (Facial)', 'Làm sạch sâu, dưỡng ẩm và phục hồi da mặt.', 45, 250000, 'Skincare', NULL, TRUE, '2026-09-23T08:49:04.862763+00:00', '2026-09-23T08:49:04.862763+00:00') ON CONFLICT DO NOTHING;
INSERT INTO services ("id", "name", "description", "duration_min", "price", "category", "image_url", "is_active", "created_at", "updated_at") VALUES ('a0d117ef-1ee0-48d5-8267-34bda92545c6', 'Gội Đầu Dưỡng Sinh', 'Gội đầu kết hợp massage da đầu và cổ, giúp giảm căng thẳng.', 30, 150000, 'Hair Care', NULL, TRUE, '2026-09-23T08:49:04.862763+00:00', '2026-09-23T08:49:04.862763+00:00') ON CONFLICT DO NOTHING;
INSERT INTO services ("id", "name", "description", "duration_min", "price", "category", "image_url", "is_active", "created_at", "updated_at") VALUES ('bee7b8c8-b5ca-4c49-843f-4b252bf86c50', 'Body Scrub Tế Bào Chết', 'Tẩy tế bào chết toàn thân, làm sáng và mịn da.', 45, 280000, 'Body Care', NULL, TRUE, '2026-09-23T08:49:04.862763+00:00', '2026-09-23T08:49:04.862763+00:00') ON CONFLICT DO NOTHING;

-- ── DATA: staff (4 rows) ─────────────────
INSERT INTO staff ("id", "name", "phone", "email", "avatar_url", "role", "is_active", "created_at", "updated_at") VALUES ('a045c995-e737-449c-a04d-ccb571b87e00', 'Nguyễn Thị Lan', '0901234567', 'lan@spaflow.vn', NULL, 'therapist', TRUE, '2026-09-23T08:49:04.862763+00:00', '2026-09-23T08:49:04.862763+00:00') ON CONFLICT DO NOTHING;
INSERT INTO staff ("id", "name", "phone", "email", "avatar_url", "role", "is_active", "created_at", "updated_at") VALUES ('f0dc7a1b-7926-4e94-ab78-b963f7cc28cc', 'Trần Thị Mai', '0902345678', 'mai@spaflow.vn', NULL, 'therapist', TRUE, '2026-09-23T08:49:04.862763+00:00', '2026-09-23T08:49:04.862763+00:00') ON CONFLICT DO NOTHING;
INSERT INTO staff ("id", "name", "phone", "email", "avatar_url", "role", "is_active", "created_at", "updated_at") VALUES ('c5e7e25f-fe79-4ccd-9a93-4b880c945deb', 'Lê Thị Hồng', '0903456789', 'hong@spaflow.vn', NULL, 'therapist', TRUE, '2026-09-23T08:49:04.862763+00:00', '2026-09-23T08:49:04.862763+00:00') ON CONFLICT DO NOTHING;
INSERT INTO staff ("id", "name", "phone", "email", "avatar_url", "role", "is_active", "created_at", "updated_at") VALUES ('29b9f92c-19ce-426c-8c37-132692792f10', 'Phạm Văn Nam', '0904567890', 'nam@spaflow.vn', NULL, 'therapist', TRUE, '2026-09-23T08:49:04.862763+00:00', '2026-09-23T08:49:04.862763+00:00') ON CONFLICT DO NOTHING;

-- ── DATA: staff_services (14 rows) ─────────────────
INSERT INTO staff_services ("id", "staff_id", "service_id") VALUES ('00ce7a89-b333-4a00-93fc-d5ebd978bc02', 'a045c995-e737-449c-a04d-ccb571b87e00', 'e74979ff-2b4b-41fe-9a05-d38ada8b4d87') ON CONFLICT DO NOTHING;
INSERT INTO staff_services ("id", "staff_id", "service_id") VALUES ('7a9e9e48-87a9-4cfd-9afd-e88400617bee', 'a045c995-e737-449c-a04d-ccb571b87e00', '3eeec249-031e-4c6f-b85a-ef369a23cb7d') ON CONFLICT DO NOTHING;
INSERT INTO staff_services ("id", "staff_id", "service_id") VALUES ('6fa3bda8-7104-479f-9baa-ca7bfb29fb93', 'a045c995-e737-449c-a04d-ccb571b87e00', 'a0d117ef-1ee0-48d5-8267-34bda92545c6') ON CONFLICT DO NOTHING;
INSERT INTO staff_services ("id", "staff_id", "service_id") VALUES ('e30e30c4-d68a-4a1c-9ff3-094abc5bb89e', 'f0dc7a1b-7926-4e94-ab78-b963f7cc28cc', 'b941ab04-b6af-4fb2-a77c-52581a40196c') ON CONFLICT DO NOTHING;
INSERT INTO staff_services ("id", "staff_id", "service_id") VALUES ('df1c0a63-dac2-41b1-af5d-936234be0d0b', 'f0dc7a1b-7926-4e94-ab78-b963f7cc28cc', 'a0d117ef-1ee0-48d5-8267-34bda92545c6') ON CONFLICT DO NOTHING;
INSERT INTO staff_services ("id", "staff_id", "service_id") VALUES ('55b73737-9d4f-4bcf-bc94-5cecd55c6324', 'f0dc7a1b-7926-4e94-ab78-b963f7cc28cc', 'bee7b8c8-b5ca-4c49-843f-4b252bf86c50') ON CONFLICT DO NOTHING;
INSERT INTO staff_services ("id", "staff_id", "service_id") VALUES ('8ad14c9a-605f-408c-8520-5e006b304c22', 'c5e7e25f-fe79-4ccd-9a93-4b880c945deb', 'e74979ff-2b4b-41fe-9a05-d38ada8b4d87') ON CONFLICT DO NOTHING;
INSERT INTO staff_services ("id", "staff_id", "service_id") VALUES ('16f3c185-57f0-42ff-9eaf-1f031cd1b1bc', 'c5e7e25f-fe79-4ccd-9a93-4b880c945deb', 'b941ab04-b6af-4fb2-a77c-52581a40196c') ON CONFLICT DO NOTHING;
INSERT INTO staff_services ("id", "staff_id", "service_id") VALUES ('36257e12-0152-4afd-b381-f6a3d1ff8f0f', 'c5e7e25f-fe79-4ccd-9a93-4b880c945deb', 'a0d117ef-1ee0-48d5-8267-34bda92545c6') ON CONFLICT DO NOTHING;
INSERT INTO staff_services ("id", "staff_id", "service_id") VALUES ('91b4b8c0-badd-448c-8816-7084fd512f3b', '29b9f92c-19ce-426c-8c37-132692792f10', 'e74979ff-2b4b-41fe-9a05-d38ada8b4d87') ON CONFLICT DO NOTHING;
INSERT INTO staff_services ("id", "staff_id", "service_id") VALUES ('e70d9161-0dd5-4f5f-b659-5aae895be675', '29b9f92c-19ce-426c-8c37-132692792f10', '3eeec249-031e-4c6f-b85a-ef369a23cb7d') ON CONFLICT DO NOTHING;
INSERT INTO staff_services ("id", "staff_id", "service_id") VALUES ('3fdc8fec-8c50-468c-baf1-b7a102095433', '29b9f92c-19ce-426c-8c37-132692792f10', 'bee7b8c8-b5ca-4c49-843f-4b252bf86c50') ON CONFLICT DO NOTHING;
INSERT INTO staff_services ("id", "staff_id", "service_id") VALUES ('e790e04b-c733-406b-b937-7a945a1d7b8d', 'c5e7e25f-fe79-4ccd-9a93-4b880c945deb', 'bee7b8c8-b5ca-4c49-843f-4b252bf86c50') ON CONFLICT DO NOTHING;
INSERT INTO staff_services ("id", "staff_id", "service_id") VALUES ('3ce92706-31f1-4b6b-81e1-cc9e2a230334', 'c5e7e25f-fe79-4ccd-9a93-4b880c945deb', '3eeec249-031e-4c6f-b85a-ef369a23cb7d') ON CONFLICT DO NOTHING;

-- ── DATA: customers (8 rows) ─────────────────
INSERT INTO customers ("id", "name", "phone", "email", "notes", "created_at", "updated_at", "user_id") VALUES ('cb6ab00f-2657-43ef-b001-88fa78ab9182', 'Minh Anh', '0987654321', 'minhanh@example.com', 'Khách quen, thích massage nhẹ nhàng', '2026-09-23T08:49:04.862763+00:00', '2026-09-23T08:49:04.862763+00:00', NULL) ON CONFLICT DO NOTHING;
INSERT INTO customers ("id", "name", "phone", "email", "notes", "created_at", "updated_at", "user_id") VALUES ('e18f2a10-0450-41a7-b242-fc604a6934fb', 'Trần Bình', '0971234567', 'tranbinh@example.com', 'Dị ứng ứng với tinh dầu sả', '2026-09-23T08:49:04.862763+00:00', '2026-09-23T08:49:04.862763+00:00', NULL) ON CONFLICT DO NOTHING;
INSERT INTO customers ("id", "name", "phone", "email", "notes", "created_at", "updated_at", "user_id") VALUES ('ea6c19e1-1e57-467e-ae5d-f71240564cbd', 'Lê Cam', '0962345678', NULL, NULL, '2026-09-23T08:49:04.862763+00:00', '2026-09-23T08:49:04.862763+00:00', NULL) ON CONFLICT DO NOTHING;
INSERT INTO customers ("id", "name", "phone", "email", "notes", "created_at", "updated_at", "user_id") VALUES ('ac3eeb31-a873-48c0-828b-3f8fc25eba82', 'Hoàng Dung', '0953456789', 'hoangdung@example.com', NULL, '2026-09-23T08:49:04.862763+00:00', '2026-09-23T08:49:04.862763+00:00', NULL) ON CONFLICT DO NOTHING;
INSERT INTO customers ("id", "name", "phone", "email", "notes", "created_at", "updated_at", "user_id") VALUES ('84272765-66da-45c5-963d-d912b1161d34', 'Vũ Anh', '0944567890', NULL, 'Ưu tiên nhân viên nữ', '2026-09-23T08:49:04.862763+00:00', '2026-09-23T08:49:04.862763+00:00', NULL) ON CONFLICT DO NOTHING;
INSERT INTO customers ("id", "name", "phone", "email", "notes", "created_at", "updated_at", "user_id") VALUES ('913bd91c-8ca4-4b58-b5cf-1d728fe067b0', 'abv', '0909090090', 'quynhcn9548@gmail.com', NULL, '2026-09-23T09:08:19.398485+00:00', '2026-09-23T09:08:19.398485+00:00', NULL) ON CONFLICT DO NOTHING;
INSERT INTO customers ("id", "name", "phone", "email", "notes", "created_at", "updated_at", "user_id") VALUES ('9a7baf60-982c-4bd4-8e29-8cb367153942', 'mmmm', '090998089', 'quynhcn9548@gmail.com', NULL, '2026-09-23T09:18:25.888728+00:00', '2026-09-23T09:18:25.888728+00:00', NULL) ON CONFLICT DO NOTHING;
INSERT INTO customers ("id", "name", "phone", "email", "notes", "created_at", "updated_at", "user_id") VALUES ('58db5020-b024-458e-acb5-621b8058a108', 'Nguyễn Văn Test', '0901234567', 'test@spaflow.vn', NULL, '2026-09-23T09:54:20.191794+00:00', '2026-09-24T02:47:35.557975+00:00', '1307a9f8-3478-4b9c-ae38-5ad7bf00d44c') ON CONFLICT DO NOTHING;

-- ── DATA: appointments (7 rows) ─────────────────
INSERT INTO appointments ("id", "booking_code", "customer_id", "staff_id", "service_id", "start_time", "end_time", "status", "price", "duration_min", "notes", "created_at", "updated_at") VALUES ('7cf64edf-081d-484b-964f-00392b87c35e', '66C75DEF', 'cb6ab00f-2657-43ef-b001-88fa78ab9182', 'a045c995-e737-449c-a04d-ccb571b87e00', 'e74979ff-2b4b-41fe-9a05-d38ada8b4d87', '2026-09-23T02:00:00+00:00', '2026-09-23T03:00:00+00:00', 'confirmed', 350000, 60, 'Khách đặt trước', '2026-09-23T08:49:13.976071+00:00', '2026-09-23T08:49:13.976071+00:00') ON CONFLICT DO NOTHING;
INSERT INTO appointments ("id", "booking_code", "customer_id", "staff_id", "service_id", "start_time", "end_time", "status", "price", "duration_min", "notes", "created_at", "updated_at") VALUES ('ae8f8172-c491-4bbf-b563-694d52ca1944', '8946FD07', 'e18f2a10-0450-41a7-b242-fc604a6934fb', '29b9f92c-19ce-426c-8c37-132692792f10', '3eeec249-031e-4c6f-b85a-ef369a23cb7d', '2026-09-23T03:30:00+00:00', '2026-09-23T04:00:00+00:00', 'confirmed', 180000, 30, NULL, '2026-09-23T08:49:13.976071+00:00', '2026-09-23T08:49:13.976071+00:00') ON CONFLICT DO NOTHING;
INSERT INTO appointments ("id", "booking_code", "customer_id", "staff_id", "service_id", "start_time", "end_time", "status", "price", "duration_min", "notes", "created_at", "updated_at") VALUES ('68cd5ec1-4117-4c63-89eb-5f83c240ab3d', '0154CC8C', 'ea6c19e1-1e57-467e-ae5d-f71240564cbd', 'f0dc7a1b-7926-4e94-ab78-b963f7cc28cc', 'b941ab04-b6af-4fb2-a77c-52581a40196c', '2026-09-23T05:00:00+00:00', '2026-09-23T05:45:00+00:00', 'pending', 250000, 45, NULL, '2026-09-23T08:49:13.976071+00:00', '2026-09-23T08:49:13.976071+00:00') ON CONFLICT DO NOTHING;
INSERT INTO appointments ("id", "booking_code", "customer_id", "staff_id", "service_id", "start_time", "end_time", "status", "price", "duration_min", "notes", "created_at", "updated_at") VALUES ('77f131f6-b8c9-4f62-8978-5d979e73e2aa', 'B307A7E2', 'ac3eeb31-a873-48c0-828b-3f8fc25eba82', 'c5e7e25f-fe79-4ccd-9a93-4b880c945deb', 'e74979ff-2b4b-41fe-9a05-d38ada8b4d87', '2026-09-22T10:00:00+00:00', '2026-09-22T11:00:00+00:00', 'completed', 350000, 60, NULL, '2026-09-23T08:49:13.976071+00:00', '2026-09-23T08:49:13.976071+00:00') ON CONFLICT DO NOTHING;
INSERT INTO appointments ("id", "booking_code", "customer_id", "staff_id", "service_id", "start_time", "end_time", "status", "price", "duration_min", "notes", "created_at", "updated_at") VALUES ('8ded306c-a85b-4057-9e18-1b672a877ebd', 'F1511C05', '84272765-66da-45c5-963d-d912b1161d34', 'a045c995-e737-449c-a04d-ccb571b87e00', 'a0d117ef-1ee0-48d5-8267-34bda92545c6', '2026-09-21T14:00:00+00:00', '2026-09-21T14:30:00+00:00', 'completed', 150000, 30, NULL, '2026-09-23T08:49:13.976071+00:00', '2026-09-23T08:49:13.976071+00:00') ON CONFLICT DO NOTHING;
INSERT INTO appointments ("id", "booking_code", "customer_id", "staff_id", "service_id", "start_time", "end_time", "status", "price", "duration_min", "notes", "created_at", "updated_at") VALUES ('cc16e817-293e-4a35-a1f1-75a0cc4721c8', 'D70F1002', '913bd91c-8ca4-4b58-b5cf-1d728fe067b0', '29b9f92c-19ce-426c-8c37-132692792f10', 'bee7b8c8-b5ca-4c49-843f-4b252bf86c50', '2026-09-23T09:30:00+00:00', '2026-09-23T10:15:00+00:00', 'confirmed', 280000, 45, 'nnnnnnn', '2026-09-23T09:08:19.685308+00:00', '2026-09-23T09:08:19.685308+00:00') ON CONFLICT DO NOTHING;
INSERT INTO appointments ("id", "booking_code", "customer_id", "staff_id", "service_id", "start_time", "end_time", "status", "price", "duration_min", "notes", "created_at", "updated_at") VALUES ('8e2253f5-181f-4f4e-b0ec-e64dd53355c8', 'BF33D6E0', '58db5020-b024-458e-acb5-621b8058a108', 'a045c995-e737-449c-a04d-ccb571b87e00', 'e74979ff-2b4b-41fe-9a05-d38ada8b4d87', '2026-09-25T01:00:00+00:00', '2026-09-25T02:00:00+00:00', 'confirmed', 350000, 60, NULL, '2026-09-24T02:47:35.926424+00:00', '2026-09-24T02:47:35.926424+00:00') ON CONFLICT DO NOTHING;

-- Bật lại triggers
SET session_replication_role = DEFAULT;
