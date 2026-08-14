# Sentry 有効化手順（エラー監視）

本番の未捕捉エラーを Sentry に集めて通知するための手順書。issue #52 の残作業はこのファイルの通りに進める。

## 現状

**コードの組み込みは完了している**（PR #81、`main` にマージ済み）。

| ファイル | 役割 |
|---|---|
| `src/lib/sentry.ts` | `Sentry.init()` / ユーザー ID の紐付け |
| `src/main.tsx` | 描画前に `initSentry()` を呼ぶ |
| `src/App.tsx` | `Sentry.ErrorBoundary` で描画クラッシュを捕捉 |
| `src/components/ErrorFallback.tsx` | クラッシュ時に出す画面 |
| `vite.config.ts` | release / environment の埋め込み、ソースマップのアップロード |

**残っているのは DSN の登録だけ。** DSN が未設定の間 `initSentry()` は何もせず、Sentry SDK の初期化コードはビルドから除去される（no-op。バンドルも太らない）。

> **`VITE_` 変数はビルド時にバンドルへ埋め込まれる。** 環境変数を登録しただけでは反映されない。**必ず再デプロイすること。**

---

## 手順

### 1. Sentry プロジェクトを作る

1. https://sentry.io でログイン（アカウントが無ければ作成）
2. **Projects → Create Project**
3. Platform に **React** を選ぶ
4. プロジェクト名は `daily-share`
5. 作成後に表示されるコード例は**不要**（すでに実装済み）。DSN だけ控える

DSN は後からでも **Settings → Projects → daily-share → Client Keys (DSN)** で確認できる。
`https://<公開キー>@o<組織ID>.ingest.sentry.io/<プロジェクトID>` の形。

> DSN はブラウザに露出してよい公開値（Supabase の anon key と同じ扱い）。秘密ではないが、後述の `SENTRY_AUTH_TOKEN` は**秘密**なので混同しないこと。

### 2. Vercel に DSN を登録する

Vercel → daily-share → **Settings → Environment Variables**

| Key | Value | 対象環境 |
|---|---|---|
| `VITE_SENTRY_DSN` | 手順 1 の DSN | Production / Preview |

Preview にも入れておくと、本番前のデプロイで出たエラーも拾える。Sentry 側では `environment` が `production` / `preview` に自動で分かれるため、混ざって困ることはない（`vite.config.ts` が `VERCEL_ENV` から決めている）。

Preview のノイズが邪魔なら Production だけに入れる。

> **`VITE_SENTRY_RELEASE` / `VITE_SENTRY_ENVIRONMENT` は登録しなくてよい。** Vercel が渡す `VERCEL_GIT_COMMIT_SHA` / `VERCEL_ENV` から自動で決まる。ローカルや他のホスティングで上書きしたいときだけ使う。

### 3. 再デプロイする

Vercel → **Deployments → 最新のデプロイ → ⋯ → Redeploy**。

「Use existing Build Cache」は**外す**（環境変数を確実に読み直させる）。

### 4. エラーが届くか確認する

1. 本番 URL を開く
2. DevTools のコンソールで、わざと未捕捉エラーを起こす

```js
setTimeout(() => { throw new Error('Sentry test: 本番疎通確認') })
```

3. Sentry の **Issues** に `Sentry test: 本番疎通確認` が数秒〜1分で現れる

イベントを開いて、次の 2 つが付いていることも確認する。

- **release** = デプロイした commit SHA
- **environment** = `production`

> **広告ブロッカーやトラッキング防止機能が Sentry への送信をブロックすることがある。** イベントが来ないときは拡張機能を切ったブラウザ、またはシークレットウィンドウで試す。Network タブで `ingest.sentry.io` へのリクエストが失敗していれば原因はこれ。

確認が終わったら、そのテスト issue は Sentry 上で **Resolve** か **Delete** しておく。

### 5. 通知を設定する（これが無いと気づけない）

イベントが溜まっても、通知が無ければ障害に気づけない。issue #52 の完了条件は「収集**・通知**」なのでここまでやる。

Sentry → **Alerts → Create Alert → Issues**

- 推奨条件: **A new issue is created**（新しい種類のエラーが出たときだけ通知。同じエラーの連発では鳴らない）
- Action: 自分のメールアドレス
- Slack を使っているなら **Settings → Integrations → Slack** を接続してチャンネル通知も追加する

エラーが多くて煩わしくなったら、条件を「短時間に N 件以上」へ変える。

### 6.（任意）ソースマップをアップロードする

これをやらないと、本番のスタックトレースが minify されたコード（`z_`, `W_` のような名前）のままで読めない。**実質必須に近い。**

1. Sentry → **Settings → Auth Tokens → Create New Token**
   - 必要なスコープ: `project:releases`（と `org:read`）
2. Vercel の Environment Variables に 3 つ登録する

| Key | Value | 備考 |
|---|---|---|
| `SENTRY_AUTH_TOKEN` | 手順 1 のトークン | **秘密。`VITE_` を付けないこと**（付けるとブラウザに漏れる） |
| `SENTRY_ORG` | 組織スラッグ | Sentry の URL に出る |
| `SENTRY_PROJECT` | `daily-share` | プロジェクトスラッグ |

3. 再デプロイする

3 つ揃ったビルドだけソースマップを生成・アップロードし、アップロード後に `.map` を削除する（公開ディレクトリに残さない）。1 つでも欠けていればプラグインごとスキップされ、ビルドは壊れない。

確認方法: 手順 4 のテストエラーをもう一度出し、スタックトレースに `src/...` の TSX の行が出ていれば成功。

---

## 環境変数まとめ

| 変数 | 必須 | ブラウザに露出 | 用途 |
|---|---|---|---|
| `VITE_SENTRY_DSN` | ○ | する（公開値でよい） | これが無いと Sentry は完全に無効 |
| `SENTRY_AUTH_TOKEN` | 任意 | **しない** | ソースマップのアップロード |
| `SENTRY_ORG` | 任意 | しない | 同上 |
| `SENTRY_PROJECT` | 任意 | しない | 同上 |
| `VITE_SENTRY_RELEASE` | 不要 | する | Vercel では commit SHA から自動 |
| `VITE_SENTRY_ENVIRONMENT` | 不要 | する | Vercel では `VERCEL_ENV` から自動 |

ローカルで試す場合は `.env.local` に `VITE_SENTRY_DSN` を入れて `npm run dev` を再起動する。ただし開発中のエラーまで本番プロジェクトに混ざるため、常用は勧めない（`environment` が `development` になるのでフィルタは可能）。

---

## 収集される / されないもの

**収集される**

- 未捕捉の例外（`window.onerror`）
- 未処理の Promise rejection
- React の描画中クラッシュ（`Sentry.ErrorBoundary`）
- エラーの発生ユーザー（**ID のみ**。メール・氏名は送らない。`sendDefaultPii: false`）

**収集されない**

- **Supabase 呼び出しの失敗。** `supabase.from(...)` はエラーを throw せず戻り値で返すため、`console.error` している箇所は Sentry に届かない。RLS 違反やネットワーク断はここに出るので、**取りこぼしとしては一番大きい**。拾いたい箇所から順に `Sentry.captureException(error)` を足していく
- パフォーマンス（トレース）とセッションリプレイ。`tracesSampleRate: 0` で無効。有料枠を使うため意図的に切っている
- Supabase Edge Functions。**そもそもこのリポジトリに Edge Functions は無い**（`supabase/` は migrations のみ）。追加したらサーバ側の Sentry も別途入れる

---

## トラブルシュート

| 症状 | 原因 |
|---|---|
| Issues に何も来ない | ①再デプロイしていない（`VITE_` はビルド時埋め込み） ②DSN の対象環境が Production になっていない ③広告ブロッカーが送信をブロック |
| スタックトレースが読めない | ソースマップ未設定（手順 6） |
| release が付かない／`unknown` | Vercel 以外でビルドしている。`VITE_SENTRY_RELEASE` を明示的に渡す |
| ソースマップを上げたのに復元されない | ビルド時の release と実行時の release が食い違っている。両方 `vite.config.ts` の同じ値から決まるので、通常は起きない。手で `VITE_SENTRY_RELEASE` を設定した場合は値を揃える |
| Preview のエラーが煩わしい | `VITE_SENTRY_DSN` を Production 限定にする、または Sentry 側で `environment:production` のフィルタ／アラート条件を使う |

---

## 完了したら

issue #52 をクローズする。完了条件は「本番の未捕捉エラーが収集・通知される」なので、**手順 5 の通知まで終わってから**閉じること。
