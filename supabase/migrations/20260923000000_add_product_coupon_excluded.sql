-- 商品ごとにクーポン適用を禁止できるようにする。デフォルトはfalse（クーポン使用可）。
alter table products
  add column if not exists coupon_excluded boolean not null default false;
