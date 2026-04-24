-- Supabase Schema Migration v5
-- Target: Extend pricing_config and addon_items for dynamic commission tracking

-- Step 1: Add new columns to pricing_config
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pricing_config' AND column_name='commission_type') THEN
        ALTER TABLE public.pricing_config ADD COLUMN commission_type text DEFAULT 'fixed' CHECK (commission_type IN ('fixed', 'percentage'));
        ALTER TABLE public.pricing_config ADD COLUMN barber_cut numeric(10,2) DEFAULT 0.00;
    END IF;
END $$;

-- Step 2: Add new columns to addon_items
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='addon_items' AND column_name='commission_type') THEN
        ALTER TABLE public.addon_items ADD COLUMN commission_type text DEFAULT 'percentage' CHECK (commission_type IN ('fixed', 'percentage'));
        ALTER TABLE public.addon_items ADD COLUMN barber_cut numeric(10,2) DEFAULT 50.00; -- Default 50%
    END IF;
END $$;

-- Step 3: Seed initial pricing values (Upsert)
INSERT INTO public.pricing_config (service_type, base_price, commission_type, barber_cut)
VALUES 
    ('Student', 15.00, 'fixed', 10.00),
    ('Staff / Outsider', 18.00, 'fixed', 10.00),
    ('Palapes', 10.00, 'fixed', 8.00),
    ('OKU / Warga Emas', 10.00, 'fixed', 8.00),
    ('Highschool', 12.00, 'fixed', 8.00)
ON CONFLICT (service_type) 
DO UPDATE SET 
    base_price = EXCLUDED.base_price, 
    commission_type = EXCLUDED.commission_type, 
    barber_cut = EXCLUDED.barber_cut;

-- Step 4: Add basic RLS policies if not exist (Owner only management for pricing_config and addon_items)
-- Assuming they are already managed in v2/v3, but just in case:
ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addon_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access for pricing_config" ON public.pricing_config;
CREATE POLICY "Public read access for pricing_config" ON public.pricing_config FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner all access for pricing_config" ON public.pricing_config;
CREATE POLICY "Owner all access for pricing_config" ON public.pricing_config FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'owner')
);

DROP POLICY IF EXISTS "Public read access for addon_items" ON public.addon_items;
CREATE POLICY "Public read access for addon_items" ON public.addon_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner all access for addon_items" ON public.addon_items;
CREATE POLICY "Owner all access for addon_items" ON public.addon_items FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'owner')
);
