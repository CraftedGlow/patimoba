-- 注文時点のオプション選択がどのデコレーション/商品由来かを記録し、
-- 印刷時に印刷用短縮名を最新の値で解決できるようにする（スナップショットのみだと
-- 後から短縮名を追加・変更しても過去の注文の印字に反映されなかったため）。
alter table public.order_item_options
  add column decoration_id uuid references public.decorations(id) on delete set null,
  add column product_id uuid references public.products(id) on delete set null;
