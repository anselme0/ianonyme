import { defineConfig } from '@playwright/test';

// Tests de bout en bout de l'application Electron (docs/DEV_SETUP.md, §10).
// À lancer après `pnpm build` : ils pilotent l'application construite, avec le faux assistant.
export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  retries: 0,
});
