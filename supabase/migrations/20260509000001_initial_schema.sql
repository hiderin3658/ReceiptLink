-- =====================================================================
-- ReceiptLink 初期スキーマ
-- 作成日: 2026-05-09
-- 詳細仕様: docs/design.md §4
--
-- 本ファイルで以下を一括作成:
--   1. 拡張 (pgcrypto)
--   2. enum 定義 (user_role, expense_source, ai_kind)
--   3. allowed_users テーブル本体（is_admin() の参照先のため先に作成）
--   4. ヘルパー関数 (current_email, is_admin, set_updated_at)
--   5. allowed_users RLS ポリシー
--   6. user_profiles + RLS                       — ユーザー追加情報
--   7. expense_categories + RLS + 標準カテゴリ シード — カテゴリマスタ
--   8. recurring_expenses + RLS                  — 固定費テンプレート
--   9. expense_records + RLS                     — 支出 1 件
--  10. expense_items + RLS                       — 支出明細
--  11. ai_advice_logs + RLS                      — AI 呼び出しログ
--
-- 注意:
--   - OkazuLink 由来の旧テーブル群（shopping_records / shopping_items / recipes /
--     foods 等）は本ファイル以前に削除済み（Phase 2 での再構築方針）。
--   - admin email のシードは supabase/seed.sql 側に分離。
-- =====================================================================

-- =====================================================================
-- 1. 拡張
-- =====================================================================
create extension if not exists "pgcrypto";

-- =====================================================================
-- 2. enum 定義
-- =====================================================================
create type public.user_role as enum ('admin', 'user');
create type public.expense_source as enum ('receipt', 'manual', 'recurring');
create type public.ai_kind as enum ('ocr', 'ocr_fallback');

-- =====================================================================
-- 3. allowed_users テーブル本体（is_admin() より先に定義する必要あり）
-- =====================================================================
create table public.allowed_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  role public.user_role not null default 'user',
  note text,
  created_at timestamptz not null default now()
);

alter table public.allowed_users enable row level security;

-- =====================================================================
-- 4. ヘルパー関数
--    is_admin() は public.allowed_users を参照するため、テーブル作成後に定義
-- =====================================================================

-- 現在の認証ユーザーの email を返す（lower 済み想定）
create or replace function public.current_email()
returns text
language sql
stable
as $$
  select lower(auth.jwt() ->> 'email');
$$;

-- 現在の認証ユーザーが admin かどうか判定
-- SECURITY DEFINER で RLS をバイパスして再帰を防止
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_users
    where email = lower(auth.jwt() ->> 'email') and role = 'admin'
  );
$$;

grant execute on function public.current_email() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- updated_at 自動更新トリガー関数
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- 5. allowed_users RLS ポリシー
-- =====================================================================

-- 自分の行だけ SELECT 可
create policy "allowed_users: self select"
  on public.allowed_users for select
  to authenticated
  using (email = public.current_email());

-- admin は全行 SELECT 可（is_admin は SECURITY DEFINER のため再帰しない）
create policy "allowed_users: admin select all"
  on public.allowed_users for select
  to authenticated
  using (public.is_admin());

-- admin のみ INSERT / UPDATE / DELETE 可
create policy "allowed_users: admin insert"
  on public.allowed_users for insert
  to authenticated
  with check (public.is_admin());

create policy "allowed_users: admin update"
  on public.allowed_users for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "allowed_users: admin delete"
  on public.allowed_users for delete
  to authenticated
  using (public.is_admin());

-- =====================================================================
-- 6. user_profiles: 表示名等のユーザー追加情報
-- =====================================================================
create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  birth_year int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "user_profiles: self select"
  on public.user_profiles for select
  to authenticated
  using (user_id = auth.uid());

create policy "user_profiles: self insert"
  on public.user_profiles for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "user_profiles: self update"
  on public.user_profiles for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 7. expense_categories: カテゴリマスタ（標準 + ユーザー追加）
--    user_id IS NULL なら標準カテゴリ（全員参照可、admin のみ編集）
--    user_id IS NOT NULL なら所有ユーザーのカスタムカテゴリ
-- =====================================================================
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  sort_order int not null default 100,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index expense_categories_user_idx on public.expense_categories (user_id, sort_order);

-- 一意性制約（部分一意インデックス）:
--   - 標準カテゴリ（user_id IS NULL）間で大文字小文字無視の重複を禁止
--   - ユーザーごとのカスタムカテゴリ間で大文字小文字無視の重複を禁止
--   - PostgreSQL の通常 UNIQUE 制約は NULL を別物扱いするため、user_id NULL の
--     重複阻止のために部分インデックスを使う
create unique index expense_categories_default_unique_name
  on public.expense_categories (lower(name))
  where user_id is null;

create unique index expense_categories_user_unique_name
  on public.expense_categories (user_id, lower(name))
  where user_id is not null;

-- 標準カテゴリと同名のユーザーカテゴリ作成を阻止するトリガー
-- （部分インデックス単独では「user_id 別 + NULL 別」で重複を許してしまうため）
create or replace function public.check_category_name_collision()
returns trigger language plpgsql as $$
begin
  if new.user_id is not null then
    if exists (
      select 1 from public.expense_categories
      where user_id is null and lower(name) = lower(new.name)
    ) then
      raise exception 'カテゴリ名 "%" は標準カテゴリと重複します', new.name
        using errcode = '23505';
    end if;
  end if;
  return new;
end;
$$;

create trigger expense_categories_check_collision
  before insert or update on public.expense_categories
  for each row execute function public.check_category_name_collision();

alter table public.expense_categories enable row level security;

-- 標準カテゴリ（user_id IS NULL）は全員 SELECT 可
create policy "expense_categories: read default"
  on public.expense_categories for select
  to authenticated
  using (user_id is null);

-- 自分のカスタムカテゴリは SELECT 可
create policy "expense_categories: read own"
  on public.expense_categories for select
  to authenticated
  using (user_id = auth.uid());

-- カスタムカテゴリの INSERT は自分のもののみ（user_id = auth.uid()）
create policy "expense_categories: insert own"
  on public.expense_categories for insert
  to authenticated
  with check (user_id = auth.uid());

-- 自分のカスタムカテゴリは UPDATE / DELETE 可（is_default = true は不可）
create policy "expense_categories: update own"
  on public.expense_categories for update
  to authenticated
  using (user_id = auth.uid() and is_default = false)
  with check (user_id = auth.uid() and is_default = false);

create policy "expense_categories: delete own"
  on public.expense_categories for delete
  to authenticated
  using (user_id = auth.uid() and is_default = false);

-- 標準カテゴリの管理は admin のみ可（INSERT / UPDATE / DELETE）
-- DELETE は安全弁として is_default = false に限る（誤削除防止）
create policy "expense_categories: admin insert default"
  on public.expense_categories for insert
  to authenticated
  with check (public.is_admin() and user_id is null);

create policy "expense_categories: admin update default"
  on public.expense_categories for update
  to authenticated
  using (public.is_admin() and user_id is null)
  with check (public.is_admin() and user_id is null);

create policy "expense_categories: admin delete default"
  on public.expense_categories for delete
  to authenticated
  using (public.is_admin() and user_id is null and is_default = false);

-- 標準カテゴリ シード（design.md §4.3）
insert into public.expense_categories (user_id, name, sort_order, is_default) values
  (null, '食費',     10, true),
  (null, '日用品',   20, true),
  (null, '光熱費',   30, true),
  (null, '交通費',   40, true),
  (null, '娯楽',     50, true),
  (null, 'その他',   99, true)
on conflict do nothing;

-- =====================================================================
-- 8. recurring_expenses: 固定費テンプレート
--    day_of_month は 1-31 を許容。当月に該当日が存在しない場合
--    （例: 2 月の 31 日）は recurring.ts 側で月末日に丸める。
-- =====================================================================
create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category_id uuid not null references public.expense_categories(id) on delete restrict,
  amount int not null check (amount >= 0),
  day_of_month int not null check (day_of_month between 1 and 31),
  active boolean not null default true,
  last_generated_month date,  -- 最後に生成した月の 1 日（YYYY-MM-01）
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.recurring_expenses.day_of_month is
  '月次計上日 (1-31)。当月に存在しない日（例: 2 月の 31 日）はアプリ側 (lib/expense/recurring.ts) で月末日に丸める。';

create index recurring_expenses_user_idx on public.recurring_expenses (user_id, active);

alter table public.recurring_expenses enable row level security;

create policy "recurring_expenses: self all"
  on public.recurring_expenses for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger recurring_expenses_set_updated_at
  before update on public.recurring_expenses
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 9. expense_records: 支出 1 件（レシート単位 or 手入力 1 回 or 固定費 1 回）
-- =====================================================================
create table public.expense_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- timestamptz: OCR が時刻まで返すため（design.md §6.3）。手入力時は 00:00:00 で保存。
  purchased_at timestamptz not null,
  store_name text,
  total_amount int not null default 0 check (total_amount >= 0),
  note text,
  image_paths text[] not null default '{}',
  source_type public.expense_source not null default 'receipt',
  recurring_expense_id uuid references public.recurring_expenses(id) on delete set null,
  created_at timestamptz not null default now()
);

create index expense_records_user_date_idx on public.expense_records (user_id, purchased_at desc);
create index expense_records_recurring_idx on public.expense_records (recurring_expense_id) where recurring_expense_id is not null;

alter table public.expense_records enable row level security;

create policy "expense_records: self all"
  on public.expense_records for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- =====================================================================
-- 10. expense_items: 支出の品目内訳
-- =====================================================================
create table public.expense_items (
  id uuid primary key default gen_random_uuid(),
  expense_record_id uuid not null references public.expense_records(id) on delete cascade,
  category_id uuid not null references public.expense_categories(id) on delete restrict,
  raw_name text not null,                  -- OCR 抽出時のオリジナル品名
  display_name text,                       -- ユーザー編集後の表示名
  quantity numeric(10, 3),
  unit text,
  unit_price int check (unit_price is null or unit_price >= 0),
  total_price int not null default 0 check (total_price >= 0),
  discount int not null default 0 check (discount >= 0),
  created_at timestamptz not null default now()
);

create index expense_items_record_idx on public.expense_items (expense_record_id);
create index expense_items_category_idx on public.expense_items (category_id);

alter table public.expense_items enable row level security;

-- 親 record の所有者経由でアクセス制御
create policy "expense_items: via record"
  on public.expense_items for all
  to authenticated
  using (
    exists (
      select 1 from public.expense_records r
      where r.id = expense_record_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.expense_records r
      where r.id = expense_record_id and r.user_id = auth.uid()
    )
  );

-- =====================================================================
-- 11. ai_advice_logs: AI 呼び出しログ（OCR）
-- =====================================================================
create table public.ai_advice_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  kind public.ai_kind not null,
  model text not null,
  request_payload jsonb,
  response jsonb,
  tokens_in int,
  tokens_out int,
  cost_usd numeric(10, 6),
  error text,
  created_at timestamptz not null default now()
);

create index ai_advice_logs_user_created_idx on public.ai_advice_logs (user_id, created_at desc);
create index ai_advice_logs_created_idx on public.ai_advice_logs (created_at desc);
create index ai_advice_logs_kind_idx on public.ai_advice_logs (kind);

alter table public.ai_advice_logs enable row level security;

-- 自分の履歴のみ読める
create policy "ai_advice_logs: self select"
  on public.ai_advice_logs for select
  to authenticated
  using (user_id = auth.uid());

-- Edge Function (service_role) のみ書き込み想定
-- service_role は RLS をバイパスするため policy 不要
