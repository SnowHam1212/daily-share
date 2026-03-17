# daily-share

予定と位置情報を共有するチームアプリ
はろーーーーーー
## 機能

- カレンダー（予定の追加・表示）
- 位置共有（リアルタイム）
- マップ表示

## 技術スタック

| 領域 | 技術 |
|---|---|
| Frontend | React |
| Backend | 未定 |
| DB | 未定 |

## リポジトリ構成

```
daily-share/
├── frontend/       # React アプリ
├── backend/        # バックエンド（未定）
├── docs/           # ドキュメント
└── .github/        # GitHub設定・テンプレート
```

## セットアップ

```bash
# リポジトリをclone
git clone https://github.com/ユーザー名/daily-share.git
cd daily-share

# フロントエンド
cd frontend
npm install
npm run dev
```

## GitHub運用ルール

- `main` への直接pushは禁止
- 作業は必ず `feature/#番号-機能名` ブランチで行う
- PRには必ずレビュアーを1人以上設定する
- コミットメッセージは Conventional Commits 形式（`feat:` / `fix:` / `docs:` など）

## メンバー

| 名前 | 担当 |
|---|---|
| @member1 | Frontend |
| @member2 | Backend |
| @member3 | 全体 |
