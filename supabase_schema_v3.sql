-- Lot 5 Barbershop CRM Phase 2 - Commission and Payroll System
-- Supabase SQL Schema Upgrade v3

-- 1. Create Payroll Adjustments Table
CREATE TABLE public.payroll_adjustments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  barber_id uuid REFERENCES public.barbers(id) ON DELETE CASCADE,
  period text NOT NULL, -- Format: 'MM-YYYY' e.g. '04-2026'
  type text NOT NULL CHECK (type IN ('benefit', 'deduction')),
  description text NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0.00,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: We constrain description length to ensure blank descriptions aren't easily bypassed
ALTER TABLE public.payroll_adjustments ADD CONSTRAINT description_length_check CHECK (char_length(description) > 0);

ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;

-- 2. Define Row Level Security Policies
-- Owners can manage all adjustments
CREATE POLICY "Only owners can manage payroll adjustments" ON public.payroll_adjustments 
  FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'owner'));

-- Barbers can only view their own adjustments
CREATE POLICY "Barbers can view their own adjustments" ON public.payroll_adjustments 
  FOR SELECT USING (auth.uid() = barber_id);

-- Optional: To help with automated payroll generation, we create an index on (barber_id, period)
CREATE INDEX idx_payroll_adjustments_barber_period ON public.payroll_adjustments(barber_id, period);
