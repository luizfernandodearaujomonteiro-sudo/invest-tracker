-- 009: Adicionar campos de snapshot para renda fixa
-- Permite importar posicao existente com valor atual da corretora
-- O sistema calcula rendimento "pra frente" a partir do snapshot

ALTER TABLE invest_holdings
  ADD COLUMN IF NOT EXISTS snapshot_value DECIMAL(18,8),
  ADD COLUMN IF NOT EXISTS snapshot_date DATE;

COMMENT ON COLUMN invest_holdings.snapshot_value IS 'Valor da posicao no momento da importacao (ex: R$ 34.918,94 da XP)';
COMMENT ON COLUMN invest_holdings.snapshot_date IS 'Data em que o snapshot foi registrado';
