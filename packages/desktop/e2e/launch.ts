import { _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const DESKTOP = resolve(import.meta.dirname, '..');
export const DEMO = resolve(DESKTOP, '../../demo');
export const SHOTS = resolve(import.meta.dirname, 'screenshots');

export interface Launched {
  app: ElectronApplication;
  page: Page;
  userData: string;
}

/** Lance l'application construite avec une configuration d'essai : faux assistant, faux LLM local. */
export async function launch(options: { localEngine?: 'fake' | 'none'; fakeDelay?: boolean } = {}): Promise<Launched> {
  const dir = mkdtempSync(join(tmpdir(), 'ianonyme-e2e-'));
  const config = join(dir, 'config.json');
  writeFileSync(
    config,
    JSON.stringify({
      assistant: { default: 'demo-fake', providers: [{ id: 'demo-fake', label: 'Assistant de démonstration (hors ligne)', type: 'fake' }] },
      localModel: { engine: options.localEngine ?? 'fake', active: '', registry: [] },
    }),
  );
  mkdirSync(SHOTS, { recursive: true });
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${join(dir, 'data')}`],
    cwd: DESKTOP,
    env: { ...process.env, IANONYME_CONFIG: config, IANONYME_E2E: '1' },
  });
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.waitForSelector('[data-testid="composer-input"]');
  return { app, page, userData: dir };
}
