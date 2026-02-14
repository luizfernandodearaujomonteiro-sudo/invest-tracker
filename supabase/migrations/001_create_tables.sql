-- =============================================
-- InvestTracker - Database Schema
-- Prefix: invest_ (para evitar conflito com tabelas existentes)
-- =============================================

-- 1. Profiles (extends Supabase auth.users)
CREATE TABLE public.invest_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  preferred_currency TEXT DEFAULT 'BRL' CHECK (preferred_currency IN ('BRL', 'USD')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_invest_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.invest_profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_invest
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_invest_user();

-- 2. Brokers / Corretoras / Wallets
CREATE TABLE public.invest_brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.invest_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  broker_type TEXT NOT NULL DEFAULT 'broker'
    CHECK (broker_type IN ('broker', 'exchange', 'wallet')),
  icon_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_invest_brokers_user ON public.invest_brokers(user_id);

-- 3. Assets (global reference table)
CREATE TYPE invest_asset_type AS ENUM (
  'br_stock', 'br_fii', 'br_bdr', 'br_etf',
  'us_stock', 'us_etf',
  'crypto',
  'fixed_income'
);

CREATE TABLE public.invest_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  asset_type invest_asset_type NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK (currency IN ('BRL', 'USD')),
  exchange TEXT,
  coingecko_id TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invest_assets_ticker ON public.invest_assets(ticker);
CREATE INDEX idx_invest_assets_type ON public.invest_assets(asset_type);
CREATE INDEX idx_invest_assets_search ON public.invest_assets USING gin(
  to_tsvector('portuguese', name || ' ' || ticker)
);

-- 4. Holdings (user position in an asset at a broker)
CREATE TABLE public.invest_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.invest_profiles(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES public.invest_brokers(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.invest_assets(id) ON DELETE RESTRICT,
  total_quantity NUMERIC(20, 8) NOT NULL DEFAULT 0,
  average_price NUMERIC(20, 8) NOT NULL DEFAULT 0,
  total_invested NUMERIC(20, 2) NOT NULL DEFAULT 0,
  fixed_income_rate NUMERIC(8, 4),
  fixed_income_index TEXT,
  maturity_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, broker_id, asset_id)
);

CREATE INDEX idx_invest_holdings_user ON public.invest_holdings(user_id);
CREATE INDEX idx_invest_holdings_broker ON public.invest_holdings(broker_id);
CREATE INDEX idx_invest_holdings_asset ON public.invest_holdings(asset_id);

-- 5. Transactions
CREATE TYPE invest_transaction_type AS ENUM (
  'buy', 'sell', 'dividend', 'split', 'transfer_in', 'transfer_out'
);

CREATE TABLE public.invest_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.invest_profiles(id) ON DELETE CASCADE,
  holding_id UUID NOT NULL REFERENCES public.invest_holdings(id) ON DELETE CASCADE,
  type invest_transaction_type NOT NULL,
  quantity NUMERIC(20, 8) NOT NULL,
  price_per_unit NUMERIC(20, 8) NOT NULL,
  total_value NUMERIC(20, 2) NOT NULL,
  fees NUMERIC(20, 2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  executed_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invest_transactions_user ON public.invest_transactions(user_id);
CREATE INDEX idx_invest_transactions_holding ON public.invest_transactions(holding_id);
CREATE INDEX idx_invest_transactions_date ON public.invest_transactions(executed_at DESC);

-- 6. Favorites
CREATE TABLE public.invest_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.invest_profiles(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.invest_assets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, asset_id)
);

CREATE INDEX idx_invest_favorites_user ON public.invest_favorites(user_id);

-- 7. Price Cache (latest price per asset)
CREATE TABLE public.invest_price_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.invest_assets(id) ON DELETE CASCADE,
  current_price NUMERIC(20, 8),
  open_price NUMERIC(20, 8),
  high_price NUMERIC(20, 8),
  low_price NUMERIC(20, 8),
  previous_close NUMERIC(20, 8),
  change_percent NUMERIC(10, 4),
  volume BIGINT,
  market_cap NUMERIC(30, 2),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(asset_id)
);

CREATE INDEX idx_invest_price_cache_asset ON public.invest_price_cache(asset_id);
CREATE INDEX idx_invest_price_cache_fetched ON public.invest_price_cache(fetched_at);

-- 8. Price History (for charts)
CREATE TABLE public.invest_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.invest_assets(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  open_price NUMERIC(20, 8),
  high_price NUMERIC(20, 8),
  low_price NUMERIC(20, 8),
  close_price NUMERIC(20, 8) NOT NULL,
  volume BIGINT,
  UNIQUE(asset_id, date)
);

CREATE INDEX idx_invest_price_history_asset_date ON public.invest_price_history(asset_id, date DESC);

-- =============================================
-- Trigger: Recalculate Holdings on Transaction
-- =============================================
CREATE OR REPLACE FUNCTION invest_recalculate_holding()
RETURNS TRIGGER AS $$
DECLARE
  v_total_qty NUMERIC;
  v_total_cost NUMERIC;
  v_avg_price NUMERIC;
  v_holding_id UUID;
BEGIN
  v_holding_id := COALESCE(NEW.holding_id, OLD.holding_id);

  SELECT
    COALESCE(SUM(CASE WHEN type IN ('buy', 'transfer_in') THEN quantity ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN type IN ('sell', 'transfer_out') THEN quantity ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type IN ('buy', 'transfer_in') THEN total_value ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN type IN ('sell', 'transfer_out') THEN total_value ELSE 0 END), 0)
  INTO v_total_qty, v_total_cost
  FROM public.invest_transactions
  WHERE holding_id = v_holding_id;

  IF v_total_qty > 0 THEN
    v_avg_price := v_total_cost / v_total_qty;
  ELSE
    v_avg_price := 0;
  END IF;

  UPDATE public.invest_holdings
  SET
    total_quantity = GREATEST(v_total_qty, 0),
    average_price = GREATEST(v_avg_price, 0),
    total_invested = GREATEST(v_total_cost, 0),
    updated_at = NOW()
  WHERE id = v_holding_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_invest_recalculate_holding
  AFTER INSERT OR UPDATE OR DELETE ON public.invest_transactions
  FOR EACH ROW EXECUTE FUNCTION invest_recalculate_holding();
