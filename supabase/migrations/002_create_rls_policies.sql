-- =============================================
-- Row Level Security Policies
-- Prefix: invest_
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.invest_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invest_brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invest_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invest_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invest_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invest_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invest_price_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invest_price_history ENABLE ROW LEVEL SECURITY;

-- invest_profiles: users can only see/edit their own
CREATE POLICY "Users can view own profile"
  ON public.invest_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.invest_profiles FOR UPDATE
  USING (auth.uid() = id);

-- invest_brokers: users can CRUD their own
CREATE POLICY "Users can view own brokers"
  ON public.invest_brokers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own brokers"
  ON public.invest_brokers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own brokers"
  ON public.invest_brokers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own brokers"
  ON public.invest_brokers FOR DELETE
  USING (auth.uid() = user_id);

-- invest_holdings: users can CRUD their own
CREATE POLICY "Users can view own holdings"
  ON public.invest_holdings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own holdings"
  ON public.invest_holdings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own holdings"
  ON public.invest_holdings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own holdings"
  ON public.invest_holdings FOR DELETE
  USING (auth.uid() = user_id);

-- invest_transactions: users can CRUD their own
CREATE POLICY "Users can view own transactions"
  ON public.invest_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON public.invest_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON public.invest_transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON public.invest_transactions FOR DELETE
  USING (auth.uid() = user_id);

-- invest_favorites: users can CRUD their own
CREATE POLICY "Users can view own favorites"
  ON public.invest_favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
  ON public.invest_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
  ON public.invest_favorites FOR DELETE
  USING (auth.uid() = user_id);

-- invest_assets: all authenticated users can read
CREATE POLICY "Authenticated users can read assets"
  ON public.invest_assets FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to insert/update assets (for API routes)
CREATE POLICY "Service role can manage assets"
  ON public.invest_assets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- invest_price_cache: all authenticated users can read
CREATE POLICY "Authenticated users can read prices"
  ON public.invest_price_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage price cache"
  ON public.invest_price_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- invest_price_history: all authenticated users can read
CREATE POLICY "Authenticated users can read price history"
  ON public.invest_price_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage price history"
  ON public.invest_price_history FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
