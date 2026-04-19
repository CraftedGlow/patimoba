-- Fix noshi RLS policy: store_staff -> store_users (use is_store_member helper)
DROP POLICY IF EXISTS "Store staff can manage their noshi" ON noshi;

CREATE POLICY "Store staff can manage their noshi"
  ON noshi FOR ALL
  USING (public.is_store_member(store_id))
  WITH CHECK (public.is_store_member(store_id));
