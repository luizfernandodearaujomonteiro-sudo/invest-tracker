-- Add 'fund' to asset type enum
ALTER TYPE invest_asset_type ADD VALUE IF NOT EXISTS 'fund';

-- Add CNPJ column to invest_assets for fund identification
ALTER TABLE public.invest_assets ADD COLUMN IF NOT EXISTS cnpj VARCHAR(20);

-- Index for looking up funds by CNPJ
CREATE INDEX IF NOT EXISTS idx_invest_assets_cnpj ON public.invest_assets(cnpj) WHERE cnpj IS NOT NULL;

-- Fund registry cache (CVM cadastro - synced from settings)
CREATE TABLE IF NOT EXISTS public.invest_fund_registry (
  cnpj VARCHAR(20) PRIMARY KEY,
  name TEXT NOT NULL,
  classe TEXT,
  gestor TEXT,
  admin TEXT,
  synced_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS (read for all authenticated users)
ALTER TABLE public.invest_fund_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fund registry readable by authenticated users"
  ON public.invest_fund_registry
  FOR SELECT TO authenticated
  USING (true);
