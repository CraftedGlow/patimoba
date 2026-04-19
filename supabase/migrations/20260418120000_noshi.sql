-- のし管理テーブル
CREATE TABLE IF NOT EXISTS noshi (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE noshi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store staff can manage their noshi"
  ON noshi FOR ALL
  USING (store_id = (
    SELECT store_id FROM store_staff WHERE user_id = auth.uid() LIMIT 1
  ));

CREATE POLICY "Anon can read noshi"
  ON noshi FOR SELECT
  TO anon, authenticated
  USING (true);

-- products にのし関連カラムを追加
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS noshi_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS noshi_ids UUID[] NOT NULL DEFAULT '{}';
