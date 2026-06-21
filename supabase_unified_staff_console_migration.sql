-- Unified Staff Console migration for Lot 5 Barbershop
-- Run this once in Supabase SQL Editor before using the upgraded POS workflow live.

-- 1. Queue entry shape and statuses
ALTER TABLE public.queue_entries
  ADD COLUMN IF NOT EXISTS entry_type text DEFAULT 'walk_in',
  ADD COLUMN IF NOT EXISTS assigned_barber_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS service_type text,
  ADD COLUMN IF NOT EXISTS remark text;

UPDATE public.queue_entries
SET entry_type = CASE WHEN booked_time IS NULL THEN 'walk_in' ELSE 'booking' END
WHERE entry_type IS NULL;

ALTER TABLE public.queue_entries
  DROP CONSTRAINT IF EXISTS queue_entries_entry_type_check;

ALTER TABLE public.queue_entries
  ADD CONSTRAINT queue_entries_entry_type_check CHECK (entry_type IN ('walk_in', 'booking'));

DO $$
DECLARE
  status_check_name text;
BEGIN
  SELECT conname INTO status_check_name
  FROM pg_constraint
  WHERE conrelid = 'public.queue_entries'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%'
  LIMIT 1;

  IF status_check_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.queue_entries DROP CONSTRAINT %I', status_check_name);
  END IF;
END $$;

ALTER TABLE public.queue_entries
  ADD CONSTRAINT queue_entries_status_check
  CHECK (status IN ('WAITING', 'NOTIFIED', 'CALLED', 'IN_CHAIR', 'HOLD', 'PAYMENT_PENDING', 'COMPLETED', 'ABSENT', 'CANCELLED'));

CREATE INDEX IF NOT EXISTS idx_queue_entries_active_type ON public.queue_entries(entry_type, status, queue_number);
CREATE INDEX IF NOT EXISTS idx_queue_entries_booked_time ON public.queue_entries(booked_time) WHERE booked_time IS NOT NULL;

-- 2. Safe daily walk-in number allocator
CREATE OR REPLACE FUNCTION public.join_walk_in_queue(
  p_customer_name text,
  p_phone_number text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_service_type text DEFAULT NULL,
  p_remark text DEFAULT NULL
)
RETURNS public.queue_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number integer;
  inserted_entry public.queue_entries;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('lot5_walk_in_queue_' || current_date::text));

  SELECT COALESCE(MAX(queue_number), 0) + 1
  INTO next_number
  FROM public.queue_entries
  WHERE entry_type = 'walk_in'
    AND joined_at >= date_trunc('day', now())
    AND joined_at < date_trunc('day', now()) + interval '1 day';

  INSERT INTO public.queue_entries (
    user_id,
    customer_name,
    phone_number,
    queue_number,
    status,
    entry_type,
    service_type,
    remark
  )
  VALUES (
    COALESCE(p_user_id, auth.uid()),
    p_customer_name,
    p_phone_number,
    next_number,
    'WAITING',
    'walk_in',
    p_service_type,
    p_remark
  )
  RETURNING * INTO inserted_entry;

  RETURN inserted_entry;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_walk_in_queue(text, text, uuid, text, text) TO authenticated;

-- 3. Capture phone number during signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  ref_by uuid := NULL;
  new_code text;
BEGIN
  IF new.raw_user_meta_data->>'referral_code' IS NOT NULL THEN
    SELECT id INTO ref_by FROM public.profiles WHERE referral_code = new.raw_user_meta_data->>'referral_code';
  END IF;

  new_code := substring(md5(random()::text) from 1 for 6);

  INSERT INTO public.profiles (id, email, name, phone, role, referral_code, referred_by)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'phone',
    COALESCE(new.raw_user_meta_data->>'role', 'user'),
    new_code,
    ref_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RLS policies
ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable select for public" ON public.queue_entries;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.queue_entries;
DROP POLICY IF EXISTS "Enable update for users and admins" ON public.queue_entries;
DROP POLICY IF EXISTS "Queue select active public and own" ON public.queue_entries;
DROP POLICY IF EXISTS "Queue insert own or staff" ON public.queue_entries;
DROP POLICY IF EXISTS "Queue update own cancel or staff manage" ON public.queue_entries;

CREATE POLICY "Queue select active public and own"
ON public.queue_entries
FOR SELECT
USING (
  status IN ('WAITING', 'NOTIFIED', 'CALLED', 'IN_CHAIR', 'HOLD', 'PAYMENT_PENDING')
  OR auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND role IN ('admin', 'owner', 'barber'))
);

CREATE POLICY "Queue insert own or staff"
ON public.queue_entries
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR user_id IS NULL
  OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND role IN ('admin', 'owner', 'barber'))
);

CREATE POLICY "Queue update own cancel or staff manage"
ON public.queue_entries
FOR UPDATE
USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND role IN ('admin', 'owner', 'barber'))
)
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND role IN ('admin', 'owner', 'barber'))
);

DROP POLICY IF EXISTS "Barbers and Owners can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Barbers and Owners can view transactions" ON public.transactions;
DROP POLICY IF EXISTS "Public view transactions" ON public.transactions;
DROP POLICY IF EXISTS "Staff insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Staff and owners view transactions" ON public.transactions;

CREATE POLICY "Staff insert transactions"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND role IN ('admin', 'owner', 'barber'))
);

CREATE POLICY "Staff and owners view transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR barber_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND role IN ('admin', 'owner', 'barber'))
);

DROP POLICY IF EXISTS "Owner view payroll" ON public.payroll_adjustments;
DROP POLICY IF EXISTS "Only owners can manage payroll adjustments" ON public.payroll_adjustments;
DROP POLICY IF EXISTS "Barbers can view their own adjustments" ON public.payroll_adjustments;
DROP POLICY IF EXISTS "Owner manage payroll and barber view own" ON public.payroll_adjustments;

CREATE POLICY "Owner manage payroll and barber view own"
ON public.payroll_adjustments
FOR ALL
TO authenticated
USING (
  barber_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND role = 'owner')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND role = 'owner')
);
