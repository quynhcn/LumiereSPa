-- ============================================================
-- Fix P0: Phone hijack via unverified phone modification
-- ============================================================

-- 1. Add phone_verified column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;

-- 2. Unique index on verified phones for users (prevents attackers from claiming a verified phone)
CREATE UNIQUE INDEX IF NOT EXISTS customers_verified_phone_idx 
ON customers (public._vn_phone(phone)) 
WHERE phone_verified = true AND user_id IS NOT NULL;

-- 3. Trigger to auto-update phone_verified when a customer record is created/updated
CREATE OR REPLACE FUNCTION public.check_phone_verified()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    -- Check if auth.users has verified this phone
    IF EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = NEW.user_id 
        AND phone_confirmed_at IS NOT NULL
        AND public._vn_phone(phone) = public._vn_phone(NEW.phone)
    ) THEN
      NEW.phone_verified := true;
    ELSE
      NEW.phone_verified := false;
    END IF;
  ELSE
    -- Walk-in customers are not verified by OTP, but they also cannot log in
    NEW.phone_verified := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_phone_verified ON customers;
CREATE TRIGGER trg_check_phone_verified
BEFORE INSERT OR UPDATE OF phone, user_id ON customers
FOR EACH ROW EXECUTE FUNCTION public.check_phone_verified();

-- 4. Retroactively mark existing verified customers
UPDATE customers c
SET phone_verified = true
FROM auth.users u
WHERE c.user_id = u.id 
  AND u.phone_confirmed_at IS NOT NULL 
  AND public._vn_phone(c.phone) = public._vn_phone(u.phone);

-- 5. Revoke RLS update on phone for customers
DROP POLICY IF EXISTS "customers_update" ON customers;
CREATE POLICY "customers_update" ON customers FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (
    -- Customers cannot change their own phone; admins can.
    (user_id = auth.uid() AND phone = (SELECT phone FROM customers WHERE id = customers.id))
    OR public.is_admin()
  );

-- 6. Update booking_quote to only match verified or walk-in accounts
CREATE OR REPLACE FUNCTION public.booking_quote(
  p_service_id uuid,
  p_phone text,
  p_gift_code text DEFAULT NULL,
  p_apply_first_visit boolean DEFAULT false
)
RETURNS TABLE (list_price int, discount_amount int, discount_pct int, discount_reason text, gift_amount int, gift_kind text, gift_error text, total int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_front boolean := public.app_role() IN ('admin', 'staff');
  v_customer uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY
      SELECT q.list_price, q.discount_amount, q.discount_pct, q.discount_reason, q.gift_amount, q.gift_kind, q.gift_error, q.total
      FROM public._price_booking(p_service_id, NULL, p_phone, p_gift_code, false, false) q;
    RETURN;
  END IF;
  
  IF v_front THEN
    SELECT id INTO v_customer FROM customers 
    WHERE public._vn_phone(phone) = public._vn_phone(p_phone)
      AND (user_id IS NULL OR phone_verified = true)
    ORDER BY (user_id IS NULL), created_at LIMIT 1;
  ELSE
    SELECT id INTO v_customer FROM customers WHERE user_id = auth.uid();
  END IF;
  
  RETURN QUERY
    SELECT q.list_price, q.discount_amount, q.discount_pct, q.discount_reason, q.gift_amount, q.gift_kind, q.gift_error, q.total
    FROM public._price_booking(p_service_id, v_customer, p_phone, p_gift_code, NOT v_front OR p_apply_first_visit, false) q;
END;
$$;
GRANT EXECUTE ON FUNCTION public.booking_quote(uuid, text, text, boolean) TO anon, authenticated;

-- 7. Update book_appointment to only match verified or walk-in accounts, and block phone takeover
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
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF coalesce(trim(p_name), '') = '' OR length(public._digits(p_phone)) < 9 THEN RAISE EXCEPTION 'INVALID_CUSTOMER'; END IF;
  IF p_date > (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 60 THEN RAISE EXCEPTION 'DATE_TOO_FAR'; END IF;

  SELECT * INTO v_svc FROM services WHERE id = p_service_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'SERVICE_NOT_FOUND'; END IF;

  v_start := (p_date + p_time::time) AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_end := v_start + make_interval(mins => v_svc.duration_min);

  IF v_front THEN
    SELECT id INTO v_customer FROM customers
    WHERE public._vn_phone(phone) = public._vn_phone(p_phone)
      AND (user_id IS NULL OR phone_verified = true)
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

  SELECT * INTO v_q FROM public._price_booking(p_service_id, v_customer, p_phone, p_gift_code, NOT v_front OR p_apply_first_visit, true);
  IF v_q.gift_error IS NOT NULL THEN RAISE EXCEPTION '%', v_q.gift_error; END IF;

  IF NOT v_front THEN
    IF v_customer IS NULL THEN
      INSERT INTO customers (name, phone, email, user_id)
      VALUES (trim(p_name), trim(p_phone), nullif(trim(p_email), ''), v_uid)
      RETURNING id INTO v_customer;
    ELSE
      -- Avoid updating phone if already verified
      UPDATE customers
      SET name = trim(p_name), 
          phone = CASE WHEN phone_verified THEN phone ELSE trim(p_phone) END,
          email = coalesce(nullif(trim(p_email), ''), email)
      WHERE id = v_customer;
    END IF;

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
      EXISTS (SELECT 1 FROM slot_holds h WHERE h.holder = p_holder AND h.staff_id = s.id
              AND h.start_time = v_start AND h.expires_at > now()) DESC,
      (SELECT count(*) FROM appointments a
       WHERE a.staff_id = s.id
         AND a.status NOT IN ('cancelled', 'no_show')
         AND (a.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = p_date),
      s.name
  LOOP
    BEGIN
      INSERT INTO appointments (customer_id, staff_id, service_id, start_time, end_time, status, price, list_price, discount_amount, discount_reason, gift_card_id, gift_amount, duration_min, notes, source)
      VALUES (v_customer, v_staff.id, p_service_id, v_start, v_end, v_status, v_q.list_price - v_q.discount_amount, v_q.list_price, v_q.discount_amount, v_q.discount_reason, v_q.gift_card_id, v_q.gift_amount, v_svc.duration_min, nullif(trim(p_notes), ''), CASE WHEN v_front THEN 'front_desk' ELSE 'online' END)
      RETURNING appointments.booking_code INTO v_code;

      IF v_q.gift_card_id IS NOT NULL THEN
        UPDATE gift_cards
        SET balance = CASE WHEN kind = 'value' THEN balance - v_q.gift_amount ELSE balance END,
            sessions_left = CASE WHEN kind IN ('sessions', 'percent') THEN sessions_left - 1 ELSE sessions_left END
        WHERE id = v_q.gift_card_id;
      END IF;

      RETURN QUERY SELECT v_code, v_staff.id, v_staff.name, v_start, v_status::text, v_q.list_price, v_q.discount_amount, v_q.discount_reason, v_q.gift_amount, v_q.total;
      RETURN;
    EXCEPTION WHEN exclusion_violation THEN
      CONTINUE;
    END;
  END LOOP;
  RAISE EXCEPTION 'SLOT_UNAVAILABLE';
END;
$$;
