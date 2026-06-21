-- Fix Row Level Security (RLS) for queue_entries table

ALTER TABLE public.queue_entries ENABLE ROW LEVEL SECURITY;

-- 1. Allow anyone to view the queue
DROP POLICY IF EXISTS "Enable select for public" ON public.queue_entries;
CREATE POLICY "Enable select for public" ON public.queue_entries FOR SELECT USING (true);

-- 2. Allow authenticated users to insert entries. 
-- This covers both regular users joining the queue and admins adding walk-in customers.
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.queue_entries;
CREATE POLICY "Enable insert for authenticated users" ON public.queue_entries FOR INSERT TO authenticated WITH CHECK (true);

-- 3. Allow users to update their own entries (e.g. to cancel), and allow admins/barbers to update all entries (to mark as called/completed/absent)
DROP POLICY IF EXISTS "Enable update for users and admins" ON public.queue_entries;
CREATE POLICY "Enable update for users and admins" ON public.queue_entries FOR UPDATE USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND role IN ('admin', 'owner', 'barber')
  )
);
