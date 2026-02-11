-- =============================================
-- Seed: Popular Assets
-- =============================================

-- Brazilian Stocks
INSERT INTO public.assets (ticker, name, asset_type, currency, exchange) VALUES
  ('PETR4', 'Petrobras PN', 'br_stock', 'BRL', 'B3'),
  ('VALE3', 'Vale ON', 'br_stock', 'BRL', 'B3'),
  ('ITUB4', 'Itau Unibanco PN', 'br_stock', 'BRL', 'B3'),
  ('BBDC4', 'Bradesco PN', 'br_stock', 'BRL', 'B3'),
  ('ABEV3', 'Ambev ON', 'br_stock', 'BRL', 'B3'),
  ('WEGE3', 'WEG ON', 'br_stock', 'BRL', 'B3'),
  ('RENT3', 'Localiza ON', 'br_stock', 'BRL', 'B3'),
  ('BBAS3', 'Banco do Brasil ON', 'br_stock', 'BRL', 'B3'),
  ('MGLU3', 'Magazine Luiza ON', 'br_stock', 'BRL', 'B3'),
  ('SUZB3', 'Suzano ON', 'br_stock', 'BRL', 'B3'),
  ('B3SA3', 'B3 ON', 'br_stock', 'BRL', 'B3'),
  ('ELET3', 'Eletrobras ON', 'br_stock', 'BRL', 'B3'),
  ('JBSS3', 'JBS ON', 'br_stock', 'BRL', 'B3'),
  ('ITSA4', 'Itausa PN', 'br_stock', 'BRL', 'B3'),
  ('RADL3', 'Raia Drogasil ON', 'br_stock', 'BRL', 'B3')
ON CONFLICT (ticker) DO NOTHING;

-- Brazilian FIIs
INSERT INTO public.assets (ticker, name, asset_type, currency, exchange) VALUES
  ('HGLG11', 'CGHG Logistica FII', 'br_fii', 'BRL', 'B3'),
  ('XPML11', 'XP Malls FII', 'br_fii', 'BRL', 'B3'),
  ('KNRI11', 'Kinea Renda Imobiliaria FII', 'br_fii', 'BRL', 'B3'),
  ('MXRF11', 'Maxi Renda FII', 'br_fii', 'BRL', 'B3'),
  ('VISC11', 'Vinci Shopping Centers FII', 'br_fii', 'BRL', 'B3')
ON CONFLICT (ticker) DO NOTHING;

-- Brazilian ETFs
INSERT INTO public.assets (ticker, name, asset_type, currency, exchange) VALUES
  ('BOVA11', 'iShares Ibovespa ETF', 'br_etf', 'BRL', 'B3'),
  ('IVVB11', 'iShares S&P500 BRL ETF', 'br_etf', 'BRL', 'B3'),
  ('HASH11', 'Hashdex Nasdaq Crypto ETF', 'br_etf', 'BRL', 'B3')
ON CONFLICT (ticker) DO NOTHING;

-- US Stocks
INSERT INTO public.assets (ticker, name, asset_type, currency, exchange) VALUES
  ('AAPL', 'Apple Inc', 'us_stock', 'USD', 'NASDAQ'),
  ('MSFT', 'Microsoft Corp', 'us_stock', 'USD', 'NASDAQ'),
  ('GOOGL', 'Alphabet Inc', 'us_stock', 'USD', 'NASDAQ'),
  ('AMZN', 'Amazon.com Inc', 'us_stock', 'USD', 'NASDAQ'),
  ('NVDA', 'NVIDIA Corp', 'us_stock', 'USD', 'NASDAQ'),
  ('TSLA', 'Tesla Inc', 'us_stock', 'USD', 'NASDAQ'),
  ('META', 'Meta Platforms Inc', 'us_stock', 'USD', 'NASDAQ'),
  ('JPM', 'JPMorgan Chase', 'us_stock', 'USD', 'NYSE'),
  ('V', 'Visa Inc', 'us_stock', 'USD', 'NYSE'),
  ('KO', 'Coca-Cola Co', 'us_stock', 'USD', 'NYSE')
ON CONFLICT (ticker) DO NOTHING;

-- US ETFs
INSERT INTO public.assets (ticker, name, asset_type, currency, exchange) VALUES
  ('VOO', 'Vanguard S&P 500 ETF', 'us_etf', 'USD', 'NYSE'),
  ('QQQ', 'Invesco QQQ Trust', 'us_etf', 'USD', 'NASDAQ'),
  ('VTI', 'Vanguard Total Stock Market ETF', 'us_etf', 'USD', 'NYSE'),
  ('SCHD', 'Schwab US Dividend Equity ETF', 'us_etf', 'USD', 'NYSE')
ON CONFLICT (ticker) DO NOTHING;

-- Cryptocurrencies
INSERT INTO public.assets (ticker, name, asset_type, currency, exchange, coingecko_id) VALUES
  ('BTC', 'Bitcoin', 'crypto', 'USD', 'CoinGecko', 'bitcoin'),
  ('ETH', 'Ethereum', 'crypto', 'USD', 'CoinGecko', 'ethereum'),
  ('SOL', 'Solana', 'crypto', 'USD', 'CoinGecko', 'solana'),
  ('ADA', 'Cardano', 'crypto', 'USD', 'CoinGecko', 'cardano'),
  ('DOT', 'Polkadot', 'crypto', 'USD', 'CoinGecko', 'polkadot'),
  ('AVAX', 'Avalanche', 'crypto', 'USD', 'CoinGecko', 'avalanche-2'),
  ('MATIC', 'Polygon', 'crypto', 'USD', 'CoinGecko', 'matic-network'),
  ('LINK', 'Chainlink', 'crypto', 'USD', 'CoinGecko', 'chainlink'),
  ('XRP', 'XRP', 'crypto', 'USD', 'CoinGecko', 'ripple'),
  ('BNB', 'BNB', 'crypto', 'USD', 'CoinGecko', 'binancecoin')
ON CONFLICT (ticker) DO NOTHING;
