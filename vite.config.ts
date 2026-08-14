/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// https://vite.dev/config/
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// Sentry へのソースマップアップロードに必要な認証情報（ビルド時のみ・
// VITE_ プレフィックス無し = ブラウザには露出しない）。
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;
// release（どのデプロイで起きたか）。Vercel では VERCEL_GIT_COMMIT_SHA を
// フォールバックに使うので、Vercel 側で追加の設定は不要。
// この値はソースマップのアップロード先タグと、実行時に Sentry へ送る
// release の両方に使う。**両者が一致しないとソースマップが適用されない**
// ため、下の define で同じ定数をブラウザ側へ埋め込んでいる。
const sentryRelease = process.env.VITE_SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA || '';
// environment（本番 / プレビューの切り分け）。Vercel の VERCEL_ENV は
// 'production' | 'preview' | 'development' を返す。未設定ならブラウザ側で
// import.meta.env.MODE にフォールバックする。
const sentryEnvironment = process.env.VITE_SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || '';
// 3 つの認証情報が揃ったビルドだけアップロードする。揃っていなければ
// プラグインを差し込まず、ソースマップも生成しない（ビルドは壊れない）。
const uploadSourcemaps = Boolean(sentryAuthToken && sentryOrg && sentryProject);

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [
    react(),
    // sentryVitePlugin は最後に置く。アップロード後、公開しないよう
    // .map ファイルは削除する。
    ...(uploadSourcemaps
      ? [
          sentryVitePlugin({
            authToken: sentryAuthToken,
            org: sentryOrg,
            project: sentryProject,
            release: sentryRelease ? { name: sentryRelease } : undefined,
            sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
          }),
        ]
      : []),
  ],
  // ビルド時に決まる Sentry のメタ情報をブラウザ側へ埋め込む。
  // VITE_ 変数と違い Vercel での追加設定が要らない（VERCEL_* から導出する）。
  define: {
    __SENTRY_RELEASE__: JSON.stringify(sentryRelease),
    __SENTRY_ENVIRONMENT__: JSON.stringify(sentryEnvironment),
  },
  // ソースマップはアップロードする時だけ生成する。
  build: {
    sourcemap: uploadSourcemaps,
  },
  test: {
    projects: [{
      // Plain unit tests (pure logic) running in Node — no browser required,
      // so they run fast in CI. Run with: vitest run --project unit
      extends: true,
      test: {
        name: 'unit',
        environment: 'node',
        include: ['src/**/*.test.ts'],
      },
    }, {
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        },
        setupFiles: ['.storybook/vitest.setup.ts']
      }
    }]
  }
});