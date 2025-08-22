-- Prune unused columns from pricing_config for simplified pricing (1 credit = 1 summary)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'pricing_config' AND column_name = 'input_cost_per_1k'
  ) THEN
    ALTER TABLE public.pricing_config DROP COLUMN IF EXISTS input_cost_per_1k;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'pricing_config' AND column_name = 'output_cost_per_1k'
  ) THEN
    ALTER TABLE public.pricing_config DROP COLUMN IF EXISTS output_cost_per_1k;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'pricing_config' AND column_name = 'markup_percentage'
  ) THEN
    ALTER TABLE public.pricing_config DROP COLUMN IF EXISTS markup_percentage;
  END IF;
END $$;


