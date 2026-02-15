-- ============================================
-- 008: Corrigir classificações de assets
--
-- Problema: Seeds usavam ON CONFLICT DO NOTHING,
-- então assets inseridos com tipo errado não eram corrigidos.
--
-- Esta migration:
-- 1. Corrige ETFs que estavam como FII
-- 2. Corrige Units (ações) que estavam como FII
-- 3. Desativa tickers invalidos/deslistados
-- 4. Adiciona assets faltantes
-- ============================================

-- =====================
-- 1. ETFs BR corrigidos
-- =====================
-- Esses tickers são ETFs mas podem estar como br_fii no banco
UPDATE invest_assets SET asset_type = 'br_etf' WHERE ticker IN (
  'BOVA11', 'IVVB11', 'HASH11', 'B5P211', 'BBOV11', 'BBSD11',
  'BITH11', 'BOVV11', 'BRAX11', 'DEFI11', 'DIVO11', 'ECOO11',
  'ETHE11', 'EURP11', 'FIND11', 'GOLD11', 'IMAB11', 'IRFM11',
  'LFTS11', 'MATB11', 'NASD11', 'NTNS11', 'PIBB11', 'QBTC11',
  'QETH11', 'SMAL11', 'SPXB11', 'SPXI11', 'WRLD11', 'XBOV11',
  'XFIX11', 'XINA11', 'TECK11', 'NDIV11', 'SHOT11', 'GENB11',
  'JURO11', 'CRPT11', 'META11', 'ACWI11', '5GTK11', 'ESGE11',
  'USTK11'
) AND asset_type != 'br_etf';

-- =====================
-- 2. Units (ações) corrigidas
-- =====================
-- Esses tickers terminam em 11 mas são ações (units), não FIIs
UPDATE invest_assets SET asset_type = 'br_stock' WHERE ticker IN (
  'ALUP11', 'BPAC11', 'BRBI11', 'CPLE11', 'ENGI11',
  'IGTI11', 'KLBN11', 'SANB11', 'SAPR11', 'TAEE11', 'SULA11'
) AND asset_type != 'br_stock';

-- =====================
-- 3. Tickers invalidos/deslistados
-- =====================
-- XPML12: recibo de subscrição (brapi retorna 404)
UPDATE invest_assets SET is_active = false WHERE ticker = 'XPML12';

-- BCFF11: deslistado em 2023
UPDATE invest_assets SET is_active = false WHERE ticker = 'BCFF11';

-- RBRF11: incorporado ao RBRX11
UPDATE invest_assets SET is_active = false WHERE ticker = 'RBRF11';

-- MALL11: ticker mudou para PMLL11
UPDATE invest_assets SET is_active = false WHERE ticker = 'MALL11';

-- SULA11: adquirida pela Rede D'Or, deslistada
UPDATE invest_assets SET is_active = false WHERE ticker = 'SULA11';

-- =====================
-- 4. Assets faltantes
-- =====================
INSERT INTO invest_assets (ticker, name, asset_type, currency, exchange) VALUES
  ('PMLL11', 'Patria Malls FII', 'br_fii', 'BRL', 'B3'),
  ('CPLE11', 'Copel Unit', 'br_stock', 'BRL', 'B3'),
  ('RBRX11', 'RBR Credito Imobiliario FII', 'br_fii', 'BRL', 'B3')
ON CONFLICT (ticker) DO NOTHING;
