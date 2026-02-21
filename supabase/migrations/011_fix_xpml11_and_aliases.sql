-- Migration 011: Corrigir XPML11 tipo e limpar cache de tickers migrados
-- XPML11 foi auto-corrigido erroneamente para br_stock, deve ser br_fii

UPDATE invest_assets
SET asset_type = 'br_fii'
WHERE ticker = 'XPML11' AND asset_type = 'br_stock';

-- Limpar cache de preço do XPML11 e CPLE6 para forçar re-busca
DELETE FROM invest_price_cache
WHERE asset_id IN (
  SELECT id FROM invest_assets WHERE ticker IN ('XPML11', 'CPLE6')
);
