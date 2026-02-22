-- ─── SwingJournal Multi-User Schema ───
-- Run this entire file in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── TRADES ───
CREATE TABLE IF NOT EXISTS trades (
  id           BIGINT PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol       TEXT NOT NULL,
  sector       TEXT DEFAULT 'Technology',
  status       TEXT DEFAULT 'Running',
  buy_price    NUMERIC,
  qty          NUMERIC,
  sl           NUMERIC,
  target       NUMERIC,
  buy_date     DATE,
  reason       TEXT,
  timing       TEXT,
  image_url    TEXT,
  chart_link   TEXT,
  tags         TEXT,
  exit_price   NUMERIC,
  exit_date    DATE,
  deployed     NUMERIC,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trades_owner" ON trades
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── IPO ACCOUNTS ───
CREATE TABLE IF NOT EXISTS ipo_accounts (
  id              BIGINT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  holder_name     TEXT NOT NULL,
  pan             TEXT,
  demat_name      TEXT,
  demat_provider  TEXT DEFAULT 'Zerodha',
  demat_id        TEXT,
  bank            TEXT,
  upi_id          TEXT,
  phone           TEXT,
  email           TEXT,
  category        TEXT DEFAULT 'Retail',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ipo_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ipo_accounts_owner" ON ipo_accounts
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── IPO RECORDS ───
CREATE TABLE IF NOT EXISTS ipo_records (
  id                 BIGINT PRIMARY KEY,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name       TEXT NOT NULL,
  symbol             TEXT,
  year               TEXT,
  exchange           TEXT DEFAULT 'NSE + BSE',
  sector             TEXT DEFAULT 'Technology',
  ipo_price          NUMERIC,
  lot_size           NUMERIC,
  lots_applied       NUMERIC,
  allotted           TEXT DEFAULT 'Yes',
  qty_allotted       NUMERIC,
  amount_applied     NUMERIC,
  amount_paid        NUMERIC,
  listing_date       DATE,
  listing_price      NUMERIC,
  selling_price      NUMERIC,
  selling_date       DATE,
  status             TEXT DEFAULT 'Sold on Listing',
  account_id         BIGINT REFERENCES ipo_accounts(id) ON DELETE SET NULL,
  notes              TEXT,
  gmp_at_apply       NUMERIC,
  subscription_times NUMERIC,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ipo_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ipo_records_owner" ON ipo_records
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── CAPITAL (one row per user) ───
CREATE TABLE IF NOT EXISTS capital (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total      NUMERIC DEFAULT 500000,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE capital ENABLE ROW LEVEL SECURITY;
CREATE POLICY "capital_owner" ON capital
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── USER PROFILES (optional display names) ───
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_owner" ON profiles
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Auto-create profile + capital row on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO capital (user_id, total) VALUES (NEW.id, 500000) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
