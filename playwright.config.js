import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  webServer: { command: 'npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  projects: [
    { name: 'ultrawide', use: { viewport: { width: 2560, height: 1000 } } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'portrait', use: { viewport: { width: 1024, height: 1366 } } },
    { name: 'mobile', use: { viewport: { width: 360, height: 800 } } },
  ],
});
