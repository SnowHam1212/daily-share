# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start Vite dev server
npm run build           # TypeScript check + Vite build
npm run lint            # ESLint check
npm run preview         # Preview production build
npm run storybook       # Run Storybook on port 6006
npm run build-storybook # Build Storybook static site
```

### Supabase

```bash
npx supabase start                          # Start local Supabase
npx supabase gen types --lang=typescript --local > src/types/database.ts  # Regenerate DB types
npx supabase db push                        # Apply migrations to remote
```

## Architecture

**Stack:** React 19 + TypeScript, Vite, Chakra UI, Supabase (Auth/DB/Realtime), Leaflet, deployed on Vercel.

**App flow:** `main.tsx` → `App.tsx` wraps everything in `AuthGuard` → shows `LoginForm` or `Map` based on auth state.

### Key layers

- `src/lib/supabase.ts` — Supabase client singleton (reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- `src/hooks/useAuth.ts` — Session state, email/password sign-in/up, Google OAuth, sign-out
- `src/hooks/useRealtime.ts` — Subscribes to Supabase Realtime channel for live location updates
- `src/types/database.ts` — Auto-generated Supabase types (regenerate via `npx supabase gen types`)
- `src/components/ui/` — Chakra-based UI primitives, each with a `.stories.tsx`
- `src/theme/theme.ts` — Chakra UI custom theme (primary/danger/success/gray tokens)

### Database

Schema defined in `supabase/migrations/0001_init.sql`. Key tables:

| Table | Purpose |
|---|---|
| `users` | Linked to `auth.users` via trigger on signup |
| `teams` | Groups with unique `invitationalCode` |
| `user_teams` | Many-to-many with `role` (admin/member) |
| `user_friends` | Bidirectional friendship pairs |
| `events` | Calendar events scoped to team with `sharingState` |
| `locations` | One row per user, updated in-place; Realtime enabled |

`sharing_state` enum: `'private' | 'friends' | 'team'` — used in both `events` and `locations`.

RLS is enabled on all tables. Auth trigger `handle_new_user()` auto-inserts into `public.users` on signup.

## GitHub Workflows

### CI (`ci.yml`)

`pull_request` to `main` でトリガー。`frontend/` ディレクトリを作業ディレクトリとして Lint → Build を実行。
> 注意: CI の `working-directory` が `frontend` になっているが、現状リポジトリルートに直接ソースがある。CI が失敗する場合はこの設定を確認すること。

テストステップはコメントアウト済み（追加時に有効化）。

### Issue テンプレート

- **バグ報告** (`bug.md`) — タイトルプレフィックス `fix:`, ラベル `bug`
- **機能追加** (`feature.md`) — タイトルプレフィックス `feat:`, ラベル `feature`

### PR テンプレート

マージ前のチェックリスト：
- [ ] `npm run lint` が通る
- [ ] `npm run build` が通る
- [ ] 動作確認済み
- [ ] レビュアーを設定した

## Environment

Copy `.env.example` to `.env` and fill in your Supabase project URL and anon key.
