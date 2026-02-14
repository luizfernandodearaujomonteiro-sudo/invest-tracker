-- Seed: ativos comuns de renda fixa

INSERT INTO public.invest_assets (ticker, name, asset_type, currency, exchange) VALUES
  -- CDBs (CDI, IR aplica)
  ('CDB-CDI', 'CDB pos-fixado CDI', 'fixed_income', 'BRL', 'Renda Fixa'),
  ('CDB-PRE', 'CDB prefixado', 'fixed_income', 'BRL', 'Renda Fixa'),
  ('CDB-IPCA', 'CDB IPCA+', 'fixed_income', 'BRL', 'Renda Fixa'),

  -- LCI/LCA (isento de IR)
  ('LCI-CDI', 'LCI pos-fixado CDI', 'fixed_income', 'BRL', 'Renda Fixa'),
  ('LCA-CDI', 'LCA pos-fixado CDI', 'fixed_income', 'BRL', 'Renda Fixa'),
  ('LCI-PRE', 'LCI prefixado', 'fixed_income', 'BRL', 'Renda Fixa'),
  ('LCA-PRE', 'LCA prefixado', 'fixed_income', 'BRL', 'Renda Fixa'),

  -- CRI/CRA (isento de IR)
  ('CRI-IPCA', 'CRI IPCA+', 'fixed_income', 'BRL', 'Renda Fixa'),
  ('CRA-CDI', 'CRA CDI', 'fixed_income', 'BRL', 'Renda Fixa'),

  -- LC
  ('LC-CDI', 'Letra de Cambio CDI', 'fixed_income', 'BRL', 'Renda Fixa'),

  -- Tesouro Direto
  ('TD-SELIC', 'Tesouro Selic (LFT)', 'fixed_income', 'BRL', 'Tesouro Direto'),
  ('TD-IPCA', 'Tesouro IPCA+ (NTN-B)', 'fixed_income', 'BRL', 'Tesouro Direto'),
  ('TD-PRE', 'Tesouro Prefixado (LTN)', 'fixed_income', 'BRL', 'Tesouro Direto'),
  ('TD-RENDA', 'Tesouro Renda+ IPCA', 'fixed_income', 'BRL', 'Tesouro Direto')
ON CONFLICT (ticker) DO NOTHING;
