-- メッセージプレート管理テーブル（生菓子向け。ホールケーキの無料メッセージプレートとは別機能）
CREATE TABLE IF NOT EXISTS message_plates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE message_plates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store staff can manage their message plates"
  ON message_plates FOR ALL
  USING (public.is_store_member_or_child(store_id))
  WITH CHECK (public.is_store_member_or_child(store_id));

CREATE POLICY "Anon can read message plates"
  ON message_plates FOR SELECT
  TO anon, authenticated
  USING (true);

-- products にメッセージプレート関連カラムを追加
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS message_plate_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS message_plate_ids UUID[] NOT NULL DEFAULT '{}';
