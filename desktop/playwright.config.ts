import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test', testMatch: '*.smoke.ts', workers: 1,
  timeout: 30_000, reporter: 'list',
});
