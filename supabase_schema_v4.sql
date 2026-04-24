-- Lot 5 Barbershop CRM Phase 2 - Auth and Barber Link
-- Supabase SQL Schema Upgrade v4

-- 1. Add barber_id to profiles table
DO $$ 
BEGIN
    ALTER TABLE public.profiles ADD COLUMN barber_id uuid REFERENCES public.barbers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN END; $$;

-- 2. Optional: Add an index to speed up lookups
CREATE INDEX IF NOT EXISTS idx_profiles_barber_id ON public.profiles(barber_id);
