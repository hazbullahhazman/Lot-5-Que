-- Lot 5 Barbershop CRM - Supabase SQL Schema
-- Run this inside your Supabase SQL Editor

-- 1. Create Profiles table (Extends Supabase Auth Auth.users)
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name text,
  email text UNIQUE NOT NULL,
  phone text,
  role text DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  referral_code text UNIQUE,
  referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn on Row Level Security for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Create queues table
CREATE TABLE public.queues (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  queue_number integer NOT NULL,
  status text DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'CALLED', 'SERVING', 'COMPLETED', 'CANCELLED', 'ABSENT')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn on Row Level Security for queues
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view queues." ON public.queues FOR SELECT USING (true);
CREATE POLICY "Authenticated users can join queue." ON public.queues FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can cancel their own queue." ON public.queues FOR UPDATE USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

-- 3. Create transactions table
CREATE TABLE public.transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  service_type text NOT NULL,
  price numeric(10,2) DEFAULT 0.00,
  status text DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'REFUNDED')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn on Row Level Security for transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view and insert transactions" ON public.transactions FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
CREATE POLICY "Users can view their own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);

-- 4. Function setup to auto-insert into profiles when an auth.user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  ref_by uuid := NULL;
  new_code text;
BEGIN
  -- Check if a referral code was provided
  IF new.raw_user_meta_data->>'referral_code' IS NOT NULL THEN
    SELECT id INTO ref_by FROM public.profiles WHERE referral_code = new.raw_user_meta_data->>'referral_code';
  END IF;

  -- Generate a random 6-character alphanumeric code
  new_code := substring(md5(random()::text) from 1 for 6);

  INSERT INTO public.profiles (id, email, name, role, referral_code, referred_by)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'name',
    COALESCE(new.raw_user_meta_data->>'role', 'user'),
    new_code,
    ref_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- We can also add a default admin on the backend using:
-- Update profiles SET role = 'admin' WHERE email = 'YOUR_ADMIN_EMAIL@domain.com';

-- 5. Backfill existing profiles with referral codes (Run this manually once if needed)
-- UPDATE public.profiles SET referral_code = substring(md5(random()::text) from 1 for 6) WHERE referral_code IS NULL;
