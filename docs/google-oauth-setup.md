# Google ログイン（OAuth）設定手順

`signInWithGoogle()`（`useAuth.ts`）と各フォームの「Google でログイン」ボタンは
コード上すでに実装済み。ただし動作させるには **Google Cloud Console** と
**Supabase** 側の設定が必要で、これらはリポジトリのコードでは完結しない。
本ドキュメントはその外部設定の手順をまとめたもの。

> MVP では Google ログインは v2 以降スコープ（`docs/mvp-plan.md` 参照）。
> 急がない場合は設定せず、メール認証のみで進めて問題ない。

---

## 全体像

```
ユーザー
  │ ①「Google でログイン」クリック
  ▼
Google 認証画面 ──②同意──▶ Google が認可コードを発行
  │
  ③ Supabase のコールバックURLへリダイレクト
  ▼
https://<project-ref>.supabase.co/auth/v1/callback
  │ ④ Supabase が Google にトークン交換 → セッション発行
  ▼
アプリ（site_url）へ戻る → ログイン完了
```

設定するのは次の3か所：

1. **Google Cloud Console** — OAuth クライアントID / シークレットの発行
2. **Supabase Dashboard** — 発行した ID / シークレットの登録と Google プロバイダ有効化
3. **（任意）ローカル開発** — `supabase/config.toml` への Google プロバイダ追記

---

## 1. Google Cloud Console

### 1-1. プロジェクト作成

1. <https://console.cloud.google.com/> にアクセス
2. 画面上部のプロジェクト選択 → 「新しいプロジェクト」→ 任意の名前（例: `daily-share`）で作成

### 1-2. OAuth 同意画面の設定

1. 左メニュー「APIとサービス」→「OAuth 同意画面」
2. User Type は外部（**External**）を選択
3. アプリ名・ユーザーサポートメール・デベロッパー連絡先を入力
4. スコープは `email` / `profile` / `openid`（デフォルトでOK）
5. テスト段階の場合は「テストユーザー」に自分のGoogleアカウントを追加
   （公開前は登録したテストユーザーしかログインできない）

### 1-3. OAuth クライアントID の発行

1. 「APIとサービス」→「認証情報」→「認証情報を作成」→「OAuth クライアント ID」
2. アプリケーションの種類: **ウェブアプリケーション**
3. 名前は管理者だけが見るラベル（例: `daily-share-web`）。任意で良い
4. 入力欄は2つあるが役割が違う：

   | 欄 | 役割 | このプロジェクトでの値 |
   |---|---|---|
   | **承認済みの JavaScript 生成元** | ブラウザ上のJSが直接Google API/SDKを呼ぶ場合に使う欄 | Supabaseはページ全体をGoogleへリダイレクトする方式のため**基本不要（空でOK）**。念のため入れるなら `http://localhost:5173` や本番ドメイン |
   | **承認済みのリダイレクト URI** | Google認証後にブラウザを送り返す先。**必須** | Supabase のコールバックURL（下記） |

   **承認済みのリダイレクト URI** に Supabase のコールバックURLを追加：

   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

   `<project-ref>` は Supabase の `VITE_SUPABASE_URL`
   （`https://<project-ref>.supabase.co`）のサブドメイン部分。
   このリポジトリの `.env` では `mdetcjwmwzjeupheppgo` が該当。

   > Supabase Dashboard の Authentication → Providers → Google を開くと
   > このコールバックURLが表示されるので、それをコピーして貼るのが確実。
   > ここが1文字でも違うと `redirect_uri_mismatch` エラーになる。

5. 作成すると **クライアント ID** と **クライアント シークレット** が表示される。
   この2つを次の手順で使う（シークレットはGitに**絶対にコミットしない**）。

---

## 2. Supabase Dashboard（本番プロジェクト）

1. <https://supabase.com/dashboard> → 対象プロジェクトを開く
2. 左メニュー「Authentication」→「Providers」（または Sign In / Providers）
3. 一覧から **Google** を開く
4. **Enable Sign in with Google** をオン
5. 手順1-3で取得した値を入力：
   - **Client ID** ← Google の クライアント ID
   - **Client Secret** ← Google の クライアント シークレット
6. 「Save」

### リダイレクト先（Site URL）の確認

「Authentication」→「URL Configuration」で以下を設定：

- **Site URL**: 本番URL（例: Vercel の `https://daily-share.vercel.app`）
- **Redirect URLs**: ローカル開発用に `http://localhost:5173` も追加しておく

> `signInWithOAuth` は明示的に `redirectTo` を渡していないため、
> 認証後は Supabase の Site URL に戻る。ローカルで試すなら
> ローカルURLを Redirect URLs に登録しておくこと。

---

## 3. ローカル開発で試す場合（任意）

ローカルの Supabase（`npx supabase start`）で Google ログインを試すには
`supabase/config.toml` にプロバイダ設定を追記する。
現状このリポジトリの config には `[auth.external.apple]` のテンプレートしか無く、
Google のブロックが存在しないため、そのままではローカルで動かない。

```toml
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
# ローカルでの Google サインインにはこれが必要
skip_nonce_check = true
```

シークレット類は config に直書きせず環境変数で渡す：

```bash
export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID="xxxx.apps.googleusercontent.com"
export SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET="xxxx"
npx supabase start   # または npx supabase stop && start で再読み込み
```

Google Cloud 側の承認済みリダイレクトURIには、ローカルSupabaseの
コールバックURL（既定では `http://127.0.0.1:54321/auth/v1/callback`）も追加する。

### 補足: ポートの食い違い

`config.toml` の `site_url` は現在 `http://127.0.0.1:3000` だが、
Vite dev サーバーは既定で **5173** で起動する。
ローカルで認証後の戻り先を合わせるなら、`site_url` を `http://localhost:5173`
にするか、`additional_redirect_urls` に `http://localhost:5173` を追加する。

---

## 動作確認

1. アプリのログイン画面で「Google でログイン」をクリック
2. Google の同意画面が表示される
3. 同意後アプリに戻り、ログイン済み状態になる
4. 新規ユーザーの場合は `handle_new_user()` トリガーで `public.users` に
   行が作られ、`displayName` が空のため `ProfileSetupModal`（プロフィール入力）
   が表示される

### よくあるエラー

| 症状 | 原因 / 対処 |
|---|---|
| `Unsupported provider: provider is not enabled` | Supabase 側で Google プロバイダが未有効。手順2を実施 |
| `redirect_uri_mismatch` | Google Cloud の承認済みリダイレクトURIが Supabase のコールバックURLと不一致。手順1-3を確認 |
| 認証後に空白ページ/別URLへ飛ぶ | Supabase の Site URL / Redirect URLs 設定漏れ。手順2末尾を確認 |
| `Access blocked: ... has not completed verification` | OAuth同意画面がテスト段階。テストユーザー追加、または本番公開申請が必要 |
