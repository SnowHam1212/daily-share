-- 1. 既存のテーブルをリセット（順番が大事です）
drop table if exists locations;
drop table if exists events;
drop table if exists profiles;
drop table if exists teams;

-- 2. チームテーブル（チーム作成・招待用）
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique default substr(md5(random()::text), 0, 9), -- 8文字の招待コード
  created_at timestamptz default now()
);

-- 3. プロフィールテーブル（ユーザー名などの管理）
-- Supabaseの認証機能(auth.users)と連動させます
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text,
  email text,
  team_id uuid references teams(id), -- どのチームに所属しているか
  updated_at timestamptz default now()
);

-- 4. 予定テーブル（カレンダー用）
create table events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  team_id uuid references teams(id), -- チームメンバー全員に見せるため
  title text not null,
  event_date date not null,
  created_at timestamptz default now()
);

-- 5. 位置情報テーブル（マップ用）
create table locations (
  id uuid primary key references auth.users on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  updated_at timestamptz default now()
);

-- 6. リアルタイム機能を有効化
alter publication supabase_realtime add table events, locations, profiles;

-- 7. セキュリティ設定 (RLS)
alter table profiles enable row level security;
alter table events enable row level security;
alter table locations enable row level security;

-- ポリシー設定（同じチームの人のデータは見れる、自分のデータだけ編集できる）
create policy "チームメンバーのプロフィールを閲覧可能" on profiles for select using (true);
create policy "自分のプロフィールを更新可能" on profiles for update using (auth.uid() = id);

create policy "チームの予定を閲覧可能" on events for select using (true);
create policy "自分の予定を追加・削除可能" on events for all using (auth.uid() = user_id);

create policy "チームの位置情報を閲覧可能" on locations for select using (true);
create policy "自分の位置情報を更新可能" on locations for all using (auth.uid() = id);