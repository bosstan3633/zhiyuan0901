-- 知源 · Supabase 云同步初始化脚本（v4.3.0）
-- 在 Supabase SQL Editor 中执行一次即可（幂等，可重复执行）。
-- 目标：云快照、账号级操作事件、策展节点私有附件 Storage；capture_inbox 仅保留历史兼容，V4.3.0 起停用。
-- 安全：三表启用 RLS，仅 authenticated 且 auth.uid() = user_id；
--       anon 角色无任何权限。严禁将 service-role key 放进客户端。

-- ============ 1. 云快照 ============
-- 只做增量收敛，绝不 DROP：用户可能已经在这个项目里保存了真实主快照。
create table if not exists public.cloud_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.cloud_snapshots add column if not exists state jsonb;
alter table public.cloud_snapshots add column if not exists revision bigint not null default 1;
alter table public.cloud_snapshots add column if not exists created_at timestamptz not null default now();
alter table public.cloud_snapshots add column if not exists updated_at timestamptz not null default now();

-- 通用 updated_at 触发器
create or replace function public.zy_touch_updated_at()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_cloud_snapshots_touch on public.cloud_snapshots;
create trigger trg_cloud_snapshots_touch
before update on public.cloud_snapshots
for each row execute function public.zy_touch_updated_at();

-- revision 单调递增（客户端乐观锁 PATCH 的备份保障）
create or replace function public.zy_bump_snapshot_revision()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  new.revision = old.revision + 1;
  return new;
end $$;

drop trigger if exists trg_cloud_snapshots_revision on public.cloud_snapshots;
create trigger trg_cloud_snapshots_revision
before update of state on public.cloud_snapshots
for each row execute function public.zy_bump_snapshot_revision();

alter table public.cloud_snapshots enable row level security;

drop policy if exists zy_cloud_snapshots_select on public.cloud_snapshots;
create policy zy_cloud_snapshots_select on public.cloud_snapshots
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists zy_cloud_snapshots_insert on public.cloud_snapshots;
create policy zy_cloud_snapshots_insert on public.cloud_snapshots
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists zy_cloud_snapshots_update on public.cloud_snapshots;
create policy zy_cloud_snapshots_update on public.cloud_snapshots
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.cloud_snapshots from anon;

-- ============ 2. 移动端采集 inbox（V4.3.0 已停用，仅历史兼容） ============
-- 不再 DROP 表：升级前可能已有历史采集记录。客户端与 PWA 已移除，
-- 本段仅保证旧项目重复执行 schema.sql 时不破坏历史数据。
create table if not exists public.capture_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content_kind text not null default 'link' check (content_kind in ('link', 'text')),
  url text,
  text_content text,
  title text,
  note text,
  tags text[] not null default '{}',
  consumed_at timestamptz,
  converted_at timestamptz,
  converted_kind text check (converted_kind in ('task', 'curiosity', 'resource')),
  converted_card_id text,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.capture_inbox alter column url drop not null;
alter table public.capture_inbox add column if not exists content_kind text not null default 'link';
alter table public.capture_inbox add column if not exists text_content text;
alter table public.capture_inbox add column if not exists converted_at timestamptz;
alter table public.capture_inbox add column if not exists converted_kind text;
alter table public.capture_inbox add column if not exists converted_card_id text;
alter table public.capture_inbox add column if not exists dismissed_at timestamptz;

alter table public.capture_inbox drop constraint if exists capture_inbox_content_present;
alter table public.capture_inbox add constraint capture_inbox_content_present check (
  (content_kind = 'link' and nullif(btrim(url), '') is not null)
  or (content_kind = 'text' and nullif(btrim(text_content), '') is not null)
);
alter table public.capture_inbox drop constraint if exists capture_inbox_conversion_shape;
alter table public.capture_inbox add constraint capture_inbox_conversion_shape check (
  (converted_kind is null and converted_at is null and converted_card_id is null)
  or (converted_kind is not null and converted_at is not null and nullif(btrim(converted_card_id), '') is not null)
);

-- 旧 consumed_at 记录不再参与新 Inbox，也不重建资源卡。
update public.capture_inbox set dismissed_at = coalesce(dismissed_at, consumed_at)
where consumed_at is not null;

drop trigger if exists trg_capture_inbox_touch on public.capture_inbox;
create trigger trg_capture_inbox_touch
before update on public.capture_inbox
for each row execute function public.zy_touch_updated_at();

drop index if exists public.capture_inbox_user_url_pending;
-- 只对未转化、未删除的链接去重；文本采集不受 URL 唯一约束影响。
create unique index if not exists capture_inbox_user_url_pending_v2
  on public.capture_inbox (user_id, url)
  where content_kind = 'link' and converted_at is null and dismissed_at is null;
create index if not exists capture_inbox_user_created
  on public.capture_inbox (user_id, created_at);

alter table public.capture_inbox enable row level security;

drop policy if exists zy_capture_inbox_select on public.capture_inbox;
create policy zy_capture_inbox_select on public.capture_inbox
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists zy_capture_inbox_insert on public.capture_inbox;
create policy zy_capture_inbox_insert on public.capture_inbox
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists zy_capture_inbox_update on public.capture_inbox;
create policy zy_capture_inbox_update on public.capture_inbox
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.capture_inbox from anon;

-- ============ 3. 账号级操作事件 ============
-- 事件 ID 由客户端设备 ID + 时间戳 + 序号生成；服务端只做幂等收编，不重写事件时间。
create table if not exists public.account_events (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  device_id text not null default 'legacy',
  event_ts timestamptz not null,
  action text not null check (action in ('create', 'delete', 'restore', 'purge', 'status', 'call')),
  card_kind text not null check (card_kind in ('resource', 'task', 'curiosity', 'system')),
  card_id text,
  title_snapshot text not null default '',
  to_state text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists account_events_user_time
  on public.account_events (user_id, event_ts desc);
create index if not exists account_events_user_created
  on public.account_events (user_id, created_at);

alter table public.account_events enable row level security;

drop policy if exists zy_account_events_select on public.account_events;
create policy zy_account_events_select on public.account_events
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists zy_account_events_insert on public.account_events;
create policy zy_account_events_insert on public.account_events
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists zy_account_events_update on public.account_events;
create policy zy_account_events_update on public.account_events
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.account_events from anon;

-- ============ 4. 策展节点附件私有 Storage ============
insert into storage.buckets (id, name, public, file_size_limit)
values ('curation-assets', 'curation-assets', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists zy_curation_assets_select on storage.objects;
create policy zy_curation_assets_select on storage.objects
  for select to authenticated
  using (bucket_id = 'curation-assets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists zy_curation_assets_insert on storage.objects;
create policy zy_curation_assets_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'curation-assets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists zy_curation_assets_update on storage.objects;
create policy zy_curation_assets_update on storage.objects
  for update to authenticated
  using (bucket_id = 'curation-assets' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'curation-assets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists zy_curation_assets_delete on storage.objects;
create policy zy_curation_assets_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'curation-assets' and (storage.foldername(name))[1] = auth.uid()::text);
