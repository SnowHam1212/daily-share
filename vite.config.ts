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
// 実行時の release（VITE_SENTRY_RELEASE）と一致させる。Vercel では
// VERCEL_GIT_COMMIT_SHA をフォールバックに使う。
const sentryRelease = process.env.VITE_SENTRY_RELEASE || process.env.VERCEL_GIT_COMMIT_SHA;
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