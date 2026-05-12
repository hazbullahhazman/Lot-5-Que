-- This script fixes the foreign key constraints that were pointing to the empty 'barbers' table.
-- It ensures that transactions and payroll_adjustments point to the 'profiles' table,
-- which is where all your actual user/barber data is stored.

-- 1. Fix Transactions table foreign key
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_barber_id_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_barber_id_fkey FOREIGN KEY (barber_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Fix Payroll Adjustments table foreign key
ALTER TABLE public.payroll_adjustments DROP CONSTRAINT IF EXISTS payroll_adjustments_barber_id_fkey;
ALTER TABLE public.payroll_adjustments ADD CONSTRAINT payroll_adjustments_barber_id_fkey FOREIGN KEY (barber_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. Update the RLS Policy for Transactions (if it was restrictive)
DROP POLICY IF EXISTS "Barbers and Owners can insert transactions" ON public.transactions;
CREATE POLICY "Barbers and Owners can insert transactions" ON public.transactions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Barbers and Owners can view transactions" ON public.transactions;
CREATE POLICY "Barbers and Owners can view transactions" ON public.transactions FOR SELECT USING (true);
