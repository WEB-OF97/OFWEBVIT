-- Catalogue Office Fournitures
-- À coller dans Supabase → SQL Editor, puis Run.
-- Le site ne se connecte jamais à IGestion. Ce schéma reçoit la copie poussée par sync/sync-igestion.ps1.

create table if not exists categories (
  code        text primary key,
  name        text not null,
  image_url   text,
  updated_at  timestamptz default now()
);

create table if not exists products (
  codpro        text primary key,
  name          text not null,
  slug          text unique,
  description   text,
  category_code text references categories(code),
  unit          text,
  price_ht      numeric(12,2),
  vat_rate      numeric(5,2),
  price_ttc     numeric(12,2),
  promo_ht      numeric(12,2),
  promo_start   date,
  promo_end     date,
  weight        numeric(12,3),
  stock         integer default 0,
  image_url     text,
  show_price    boolean default true,
  show_stock    boolean default true,
  published     boolean default true,
  updated_at    timestamptz default now()
);

create index if not exists products_category_code_idx on products (category_code);
create index if not exists products_published_idx on products (published);

create table if not exists product_barcodes (
  codpro   text references products(codpro) on delete cascade,
  barcode  text not null,
  qty_mult numeric default 1,
  primary key (codpro, barcode)
);

create table if not exists product_prices (
  codpro   text references products(codpro) on delete cascade,
  tier     smallint,
  price_ht numeric(12,2),
  primary key (codpro, tier)
);

create table if not exists orders (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz default now(),
  status           text default 'nouvelle' check (status in ('nouvelle', 'payee', 'traitee', 'annulee')),
  customer_name    text,
  customer_email   text,
  customer_phone   text,
  shipping_address text,
  items            jsonb not null,
  total_ht         numeric(12,2),
  total_ttc        numeric(12,2),
  exported         boolean default false
);

alter table categories       enable row level security;
alter table products         enable row level security;
alter table product_barcodes enable row level security;
alter table product_prices   enable row level security;
alter table orders           enable row level security;

drop policy if exists "public read categories" on categories;
create policy "public read categories" on categories for select using (true);

drop policy if exists "public read products" on products;
create policy "public read products" on products for select using (published = true);

drop policy if exists "public read barcodes" on product_barcodes;
create policy "public read barcodes" on product_barcodes for select using (true);

drop policy if exists "anyone can create order" on orders;
create policy "anyone can create order" on orders for insert with check (true);

-- product_prices : pas de policy publique (tarifs B2B, service_role seulement).
-- orders : pas de policy select (lecture réservée au service_role).

revoke all on table public.orders from anon, authenticated;
grant insert on table public.orders to anon, authenticated;

revoke all on table public.product_prices from anon, authenticated;

grant select on table public.categories to anon, authenticated;
grant select on table public.products to anon, authenticated;
grant select on table public.product_barcodes to anon, authenticated;

grant all on table public.categories, public.products, public.product_barcodes, public.product_prices, public.orders to service_role;

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public read product images" on storage.objects;
create policy "public read product images"
on storage.objects for select
using (bucket_id = 'product-images');
