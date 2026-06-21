-- =====================================================
-- 1. storesテーブルの機密カラムへのアクセス制限
--    line_channel_access_token / line_channel_secret は
--    サーバーサイド(service_role)のみが参照する。
--    anon / authenticated ロールからは不要なため REVOKE する。
--    PostgRESTは select=* 時にアクセス不可カラムを自動除外するため
--    既存のクライアント側クエリは影響を受けない。
-- =====================================================
REVOKE SELECT (line_channel_access_token, line_channel_secret)
  ON public.stores
  FROM anon, authenticated;

-- =====================================================
-- 2. Storageアップロードポリシーの修正
--    既存のINSERTポリシーは with_check 条件がなく
--    匿名ユーザーを含む誰でもアップロード可能だった。
--    認証済みユーザーのみに限定する。
-- =====================================================
DROP POLICY IF EXISTS "product-images auth insert" ON storage.objects;
DROP POLICY IF EXISTS "store-logos auth insert" ON storage.objects;

CREATE POLICY "product-images auth insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "store-logos auth insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'store-logos'
    AND auth.role() = 'authenticated'
  );
