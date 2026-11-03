-- 知源 · Supabase 云同步初始化脚本（v4.0.1）
-- 在 Supabase SQL Editor 中执行一次即可（幂等，可重复执行）。
-- 目标：云快照（手动上传/下载 + revision 乐观锁）与移动端采集 inbox。
-- 安全：两表启用 RLS，仅 authenticated 且 auth.uid() = user_id；
--       anon 角色无任何权限。严禁将 service-role key 放进客户端。

-- ============ 1. 云快照 ============
-- 幂等重建：旧实验残留结构不一致，直接重起（邀请制早期，无生产数据）
drop table if exists public.cloud_snapshots cascade;
create table if not exists public.cloud_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 通用 updated_at 触发器
create or replace function public.zy_touch_updated_at()
returns trigger language plpgsql as $$
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
returns trigger language plpgsql as $$
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
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists zy_cloud_snapshots_insert on public.cloud_snapshots;
create policy zy_cloud_snapshots_insert on public.cloud_snapshots
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists zy_cloud_snapshots_update on public.cloud_snapshots;
create policy zy_cloud_snapshots_update on public.cloud_snapshots
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.cloud_snapshots from anon;

-- ============ 2. 移动端采集 inbox ============
drop table if exists public.capture_inbox cascade;
create table if not exists public.capture_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  url text not null,
  title text,
  note text,
  tags text[] not null default '{}',
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_capture_inbox_touch on public.capture_inbox;
create trigger trg_capture_inbox_touch
before update on public.capture_inbox
for each row execute function public.zy_touch_updated_at();

-- 同一用户、同一链接，未消费只保留一条（防手机端重复提交）
create unique index if not exists capture_inbox_user_url_pending
  on public.capture_inbox (user_id, url) where consumed_at is null;
create index if not exists capture_inbox_user_created
  on public.capture_inbox (user_id, created_at);

alter table public.capture_inbox enable row level security;

drop policy if exists zy_capture_inbox_select on public.capture_inbox;
create policy zy_capture_inbox_select on public.capture_inbox
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists zy_capture_inbox_insert on public.capture_inbox;
create policy zy_capture_inbox_insert on public.capture_inbox
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists zy_capture_inbox_update on public.capture_inbox;
create policy zy_capture_inbox_update on public.capture_inbox
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.capture_inbox from anon;
