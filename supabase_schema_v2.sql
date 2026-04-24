-- Lot 5 Barbershop CRM Phase 2 - Supabase SQL Schema Upgrade
-- Run this inside your Supabase SQL Editor to upgrade from Phase 1

-- 1. Modify Profiles Table Roles
-- Note: PostgreSQL doesn't allow altering an existing CHECK constraint easily, 
-- so we drop the old one and add the new one.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin', 'owner', 'barber'));

-- Map existing 'admin' to 'owner' (Optional, mostly for new structure compliance)
UPDATE public.profiles SET role = 'owner' WHERE role = 'admin';

-- 2. Create Barbers Table
CREATE TABLE public.barbers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  username text UNIQUE NOT NULL,
  role text DEFAULT 'barber' CHECK (role IN ('barber', 'owner')),
  active boolean DEFAULT true,
  commission_rate numeric(4,2) DEFAULT 0.50, -- 50%
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active barbers." ON public.barbers FOR SELECT USING (true);
CREATE POLICY "Only owners can modify barbers." ON public.barbers FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'owner'));

-- 3. Create Pricing Config Table
CREATE TABLE public.pricing_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  service_type text UNIQUE NOT NULL,
  base_price numeric(10,2) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view pricing." ON public.pricing_config FOR SELECT USING (true);
CREATE POLICY "Only owners can modify pricing." ON public.pricing_config FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'owner'));

-- Insert default pricing values
INSERT INTO public.pricing_config (service_type, base_price) VALUES
  ('Student', 15.00),
  ('Staff / Outsider', 18.00),
  ('Palapes', 10.00),
  ('OKU / Warga Emas', 10.00),
  ('Highschool', 12.00);

-- 4. Create Addon Items Table
CREATE TABLE public.addon_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  price numeric(10,2) NOT NULL,
  active boolean DEFAULT true
);

ALTER TABLE public.addon_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view addons." ON public.addon_items FOR SELECT USING (true);
CREATE POLICY "Only owners can modify addons." ON public.addon_items FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'owner'));

-- Insert default addon values
INSERT INTO public.addon_items (name, price) VALUES
  ('Moustache Trim', 3.00),
  ('Beard Trim', 5.00),
  ('Hair Wash', 10.00),
  ('Hair Colour', 30.00),
  ('Design / Pattern', 5.00);

-- 5. UPGRADE Transactions Table
-- We add new columns to the existing transactions table safely.
DO $$ 
BEGIN
    ALTER TABLE public.transactions ADD COLUMN queue_number text;
EXCEPTION WHEN duplicate_column THEN END; $$;

DO $$ 
BEGIN
    ALTER TABLE public.transactions ADD COLUMN customer_name text;
EXCEPTION WHEN duplicate_column THEN END; $$;

DO $$ 
BEGIN
    ALTER TABLE public.transactions ADD COLUMN customer_id text;
EXCEPTION WHEN duplicate_column THEN END; $$;

DO $$ 
BEGIN
    ALTER TABLE public.transactions ADD COLUMN items jsonb DEFAULT '[]'::jsonb;
EXCEPTION WHEN duplicate_column THEN END; $$;

DO $$ 
BEGIN
    ALTER TABLE public.transactions ADD COLUMN subtotal numeric(10,2) DEFAULT 0.00;
EXCEPTION WHEN duplicate_column THEN END; $$;

DO $$ 
BEGIN
    ALTER TABLE public.transactions ADD COLUMN tips numeric(10,2) DEFAULT 0.00;
EXCEPTION WHEN duplicate_column THEN END; $$;

DO $$ 
BEGIN
    ALTER TABLE public.transactions ADD COLUMN total numeric(10,2) DEFAULT 0.00;
EXCEPTION WHEN duplicate_column THEN END; $$;

DO $$ 
BEGIN
    ALTER TABLE public.transactions ADD COLUMN payment_method text CHECK (payment_method IN ('cash', 'qr'));
EXCEPTION WHEN duplicate_column THEN END; $$;

DO $$ 
BEGIN
    ALTER TABLE public.transactions ADD COLUMN barber_id uuid REFERENCES public.barbers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN END; $$;

DO $$ 
BEGIN
    ALTER TABLE public.transactions ADD COLUMN barber_name text;
EXCEPTION WHEN duplicate_column THEN END; $$;

DO $$ 
BEGIN
    ALTER TABLE public.transactions ADD COLUMN commission_amount numeric(10,2) DEFAULT 0.00;
EXCEPTION WHEN duplicate_column THEN END; $$;

-- Update Transactions RLS to let barbers insert
DROP POLICY IF EXISTS "Admins can view and insert transactions" ON public.transactions;
CREATE POLICY "Barbers and Owners can insert transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('owner', 'barber', 'admin')));
CREATE POLICY "Barbers and Owners can view transactions" ON public.transactions FOR SELECT USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('owner', 'barber', 'admin')) OR auth.uid() = user_id);
