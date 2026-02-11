-- =============================================
-- Row Level Security Policies
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- profiles: users can only see/edit their own
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- brokers: users can CRUD their own
CREATE POLICY "Users can view own brokers"
  ON public.brokers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own brokers"
  ON public.brokers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own brokers"
  ON public.brokers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own brokers"
  ON public.brokers FOR DELETE
  USING (auth.uid() = user_id);

-- holdings: users can CRUD their own
CREATE POLICY "Users can view own holdings"
  ON public.holdings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own holdings"
  ON public.holdings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own holdings"
  ON public.holdings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own holdings"
  ON public.holdings FOR DELETE
  USING (auth.uid() = user_id);

-- transactions: users can CRUD their own
CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON public.transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON public.transactions FOR DELETE
  USING (auth.uid() = user_id);

-- favorites: users can CRUD their own
CREATE POLICY "Users can view own favorites"
  ON public.favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
  ON public.favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
  ON public.favorites FOR DELETE
  USING (auth.uid() = user_id);

-- assets: all authenticated users can read
CREATE POLICY "Authenticated users can read assets"
  ON public.assets FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to insert/update assets (for API routes)
CREATE POLICY "Service role can manage assets"
  ON public.assets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- price_cache: all authenticated users can read
CREATE POLICY "Authenticated users can read prices"
  ON public.price_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage price cache"
  ON public.price_cache FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- price_history: all authenticated users can read
CREATE POLICY "Authenticated users can read price history"
  ON public.price_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage price history"
  ON public.price_history FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
