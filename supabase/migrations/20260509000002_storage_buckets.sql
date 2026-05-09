-- =====================================================================
-- ReceiptLink Storage バケット定義
-- 作成日: 2026-05-09
-- 詳細仕様: docs/receipt-scan-spec.md §2 / docs/design.md §6
--
-- バケット: receipts
--   - パス命名規則: receipts/{user_id}/{uuid}.{ext}
--   - ファイルサイズ上限: 10 MB
--   - 許可 MIME: image/jpeg, image/png, image/webp, image/heic
--   - 公開: NO（プライベート、署名付き URL でのみ閲覧）
--   - RLS: 所有者（パスの先頭セグメント = 自分の auth.uid()）のみ全 CRUD 可
-- =====================================================================

-- バケット作成（既存なら更新）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760,  -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- =====================================================================
-- Storage RLS: 所有者のみアクセス可
-- パス先頭セグメント (storage.foldername(name))[1] が自分の auth.uid() と一致するもののみ
-- =====================================================================

create policy "receipts: select own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "receipts: insert own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "receipts: update own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "receipts: delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
