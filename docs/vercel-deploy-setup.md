# Vercel デプロイのセットアップ

`main` にマージすると [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) が
本番へデプロイする。その初回設定の手順。**一度やれば以後は不要。**

## なぜこの構成なのか

2026-09-21 にリポジトリを `SnowHam1212` から `thisIsCsDojo` Org へ移管したとき、
Vercel の GitHub App 接続が切れた。GitHub App のインストールは移管先の Org には
引き継がれないため、Vercel から見るとリポジトリが消えた状態になる。

その結果 **#129〜#135 の 7 本が本番に届かないまま 10 日間気づかなかった。**
デプロイが止まっても GitHub 上は何も赤くならないので、気づく手段が無かった。

接続を直すには Org への App インストールが必要で、それは Org owner
（SnowHam さん）の操作になる。申請は一度流れた。**配布を人待ちで止めないため、
GitHub App を使わない経路に切り替えた。**

この構成では GitHub Actions 上でビルドし、成果物だけを Vercel へ送る。
Org の設定も App のインストールも要らず、必要な権限はすべてこちら側にある。

### 失ったもの

| | 以前（Vercel Git 連携） | 今 |
|---|---|---|
| PR ごとのプレビュー | 自動で作られ、PR にコメントされた | **無い**（必要なら後から足せる。「今後」参照） |
| GitHub の Deployments タブ | デプロイが並んだ | **出ない。** 代わりに Actions タブに残る |
| ロールバック | Vercel ダッシュボードから 1 クリック | 同じ（Vercel 側の機能なので変わらない） |
| Sentry の release | `VERCEL_GIT_COMMIT_SHA` から自動 | ワークフローが `VITE_SENTRY_RELEASE` で明示的に渡す |

---

## 手順

### 1. Vercel アカウントを作る

<https://vercel.com/signup> — 「Continue with GitHub」で作る。Hobby（無料）でよい。

> **GitHub App のインストールは要らない。** import 画面でリポジトリを選ぶ必要が
> ないため、Org の承認待ちは発生しない。

### 2. ローカルからプロジェクトを作る

リポジトリのルートで:

```bash
npx --yes vercel@latest login
```

続けて:

```bash
npx --yes vercel@latest link --yes
```

プロジェクト名を聞かれたら `daily-share` でよい。完了すると `.vercel/project.json`
ができる（gitignore 済み）。中身の `orgId` と `projectId` を次で使う。

### 3. Vercel にアプリの環境変数を登録する

Vercel → daily-share → **Settings → Environment Variables**

| Name | Value | 環境 |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://mdetcjwmwzjeupheppgo.supabase.co` | Production |
| `VITE_SUPABASE_ANON_KEY` | 本番（ソウル）の anon key | Production |

anon key は <https://supabase.com/dashboard/project/mdetcjwmwzjeupheppgo/settings/api-keys>
の **anon / public**。公開値なので秘密ではない。

> **GitHub の Secrets には入れない。** ワークフローは `vercel pull` で Vercel から
> 取ってくる。置き場所を 1 箇所に保つため。

Sentry を使うなら `VITE_SENTRY_DSN` もここに足す（[sentry-setup.md](./sentry-setup.md) 参照）。

### 4. デプロイ用のトークンを発行する

<https://vercel.com/account/tokens> → **Create Token**

- Scope: 自分のアカウント
- Expiration: 無期限、または 1 年

> **期限を切ると、切れた日にデプロイが止まる。** Actions が赤くなるので気づけるが、
> 原因が分かりにくい故障なので、切るなら期限をカレンダーに入れておくこと。

表示は発行直後の一度きり。コピーして次へ。

### 5. GitHub に Secrets を登録する

<https://github.com/thisIsCsDojo/daily-share/settings/secrets/actions> → **New repository secret**

| Name | Value |
|---|---|
| `VERCEL_TOKEN` | 手順 4 のトークン。**秘密** |
| `VERCEL_ORG_ID` | `.vercel/project.json` の `orgId` |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` の `projectId` |

### 6. 外部から見えるようにする

Vercel → daily-share → **Settings → Deployment Protection** → Vercel Authentication を
**Disabled**。

> これを忘れると、本番 URL が Vercel のログイン画面を返す。2026-08-11 に一度踏んでいる。

### 7. 動作確認

<https://github.com/thisIsCsDojo/daily-share/actions/workflows/deploy.yml> →
**Run workflow** → `main`。

緑になったら、実行サマリーに出たデプロイ URL を開く。確認すること:

- `/privacy.html` が表示され、連絡先が `urushi1413@gmail.com` になっている
- ログイン画面の「パスワードをお忘れですか？」を押すと、メールではなく連絡先が案内される

どちらも #134 / #135 で入れた変更なので、**これが見えれば古いビルドから脱したことの証拠になる。**

### 8. 本番 URL を Supabase に登録する

Vercel → daily-share → **Settings → Domains** の、ハッシュを含まない短い方が固定の本番 URL。

<https://supabase.com/dashboard/project/mdetcjwmwzjeupheppgo/auth/url-configuration> で:

- **Site URL** → 新しい URL
- **Redirect URLs** → `新しいURL/**` を追加

> 旧 URL（`daily-share-snowham1212s-projects.vercel.app`）の設定は消さなくてよい。
> 消すと、旧 URL を開いている人の Google ログインが即座に壊れる。

Google Cloud 側の変更は**不要**。Google のリダイレクト先は Supabase の
`/auth/v1/callback` であり、そこは変わらないため。

### 9. 旧 Vercel プロジェクトを止める

SnowHam さんのアカウントにある旧プロジェクトは、放置すると**古いビルドを配り続ける。**
配布前に SnowHam さんへ削除か停止を依頼する。急ぎではないが、配布までには片付ける。

---

## 今後

### PR プレビューを戻したいとき

`pull_request` をトリガーにしたジョブを足し、`--environment=preview` で pull、
`--prod` 無しで deploy すればよい。その際は Vercel の **Preview** 環境変数に
staging（東京 `zlptsmiqfzwisgerwwet`）を入れること。本番 DB を触らずに PR を
確認できるようになる。

最初の導入では入れていない。production を確実に動かしてから段階的に足す方針
（[migration-deploy-runbook.md](./migration-deploy-runbook.md) と同じ考え方）。

### Vercel Git 連携に戻したくなったとき

SnowHam さんが Org に Vercel の GitHub App を入れてくれれば、
<https://vercel.com/new> から import し直して Git 連携に戻せる。
その場合は [deploy.yml](../.github/workflows/deploy.yml) を削除すること。
**両方動かすと 1 つのマージで 2 回デプロイが走る。**
