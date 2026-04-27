-- Lot 5 Barbershop CRM - Final Missing Tables & Columns Sync
-- This script safely creates any missing tables (like transactions and barbers)

-- 1. Create Barbers Table
CREATE TABLE IF NOT EXISTS public.barbers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  username text UNIQUE NOT NULL,
  role text DEFAULT 'barber' CHECK (role IN ('barber', 'owner')),
  active boolean DEFAULT true,
  commission_rate numeric(4,2) DEFAULT 0.50,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Transactions Table (The Master Ledger)
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name text,
  customer_id text,
  queue_number text,
  service_type text NOT NULL,
  items jsonb DEFAULT '[]'::jsonb,
  subtotal numeric(10,2) DEFAULT 0.00,
  tips numeric(10,2) DEFAULT 0.00,
  total numeric(10,2) DEFAULT 0.00,
  payment_method text CHECK (payment_method IN ('cash', 'qr')),
  barber_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  barber_name text,
  commission_amount numeric(10,2) DEFAULT 0.00,
  status text DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'REFUNDED')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Payroll Adjustments Table (For Additions/Deductions)
CREATE TABLE IF NOT EXISTS public.payroll_adjustments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  barber_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text CHECK (type IN ('benefit', 'deduction')),
  description text NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Safely set RLS Policies for these tables
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view barbers" ON public.barbers;
CREATE POLICY "Public view barbers" ON public.barbers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Barbers and Owners can insert transactions" ON public.transactions;
CREATE POLICY "Barbers and Owners can insert transactions" ON public.transactions FOR INSERT WITH CHECK (true); -- Allowing all authenticated users to log for now

DROP POLICY IF EXISTS "Public view transactions" ON public.transactions;
CREATE POLICY "Public view transactions" ON public.transactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner view payroll" ON public.payroll_adjustments;
CREATE POLICY "Owner view payroll" ON public.payroll_adjustments FOR ALL USING (true);
