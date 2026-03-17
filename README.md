# Daily Share

リアルタイム位置情報共有アプリ

## 技術スタック

| 領域 | 技術 |
|------|------|
| Frontend | React + TypeScript (Vite) |
| BaaS | Supabase |
| DB | PostgreSQL (Supabase) |
| Realtime | Supabase Realtime (WebSocket) |
| マップ | Leaflet.js (react-leaflet) |
| ホスティング | Vercel |
| 認証 | Supabase Auth (メール / Google) |

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` をコピーして `.env` を作成し、Supabase の URL と Anon Key を設定する。

```bash
cp .env.example .env
```

Supabase ダッシュボード → Project Settings → API から取得。

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Supabase のテーブル作成

Supabase SQL Editor で実行:

```sql
create table locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  latitude double precision not null,
  longitude double precision not null,
  updated_at timestamptz default now()
);

-- Realtime を有効化
alter publication supabase_realtime add table locations;

-- RLS ポリシー
alter table locations enable row level security;

create policy "自分の位置情報を読める" on locations
  for select using (true);

create policy "自分の位置情報を更新できる" on locations
  for all using (auth.uid() = user_id);
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

### 5. Vercel デプロイ

```bash
vercel
```

環境変数 `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` を Vercel ダッシュボードにも追加する。

## プロジェクト構成

```
src/
  lib/
    supabase.ts       # Supabase クライアント
  types/
    database.ts       # DB 型定義
  hooks/
    useAuth.ts        # 認証フック
    useRealtime.ts    # リアルタイム位置情報フック
  components/
    Auth/
      LoginForm.tsx   # ログイン・サインアップフォーム
    Map/
      Map.tsx         # Leaflet マップ
  App.tsx
  main.tsx
```
