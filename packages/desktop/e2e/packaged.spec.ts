// Application empaquetée (release/win-unpacked) : démarrage, module natif, parcours minimal.
// Ignoré si l'application n'a pas été empaquetée (`pnpm package`).
import { _electron as electron, expect, test } from '@playwright/test';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DEMO, DESKTOP, SHOTS, protectAll } from './launch.js';

const EXE = process.env.IANONYME_EXE ?? resolve(DESKTOP, 'release/win-unpacked/IAnonyme.exe');

test.skip(!existsSync(EXE), 'application non empaquetée');

test('l’application empaquetée démarre, charge le module natif et déroule un envoi', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ianonyme-pkg-'));
  const config = join(dir, 'config.json');
  writeFileSync(
    config,
    JSON.stringify({
      assistant: { default: 'demo-fake', providers: [{ id: 'demo-fake', label: 'Assistant de démonstration (hors ligne)', type: 'fake' }] },
      localModel: { engine: 'fake', active: '', registry: [] },
    }),
  );
  mkdirSync(SHOTS, { recursive: true });
  const app = await electron.launch({
    executablePath: EXE,
    args: [`--user-data-dir=${join(dir, 'data')}`],
    env: { ...process.env, IANONYME_CONFIG: config, IANONYME_PROBE: '1' },
  });
  const logs: string[] = [];
  app.process().stderr?.on('data', (d: Buffer) => logs.push(String(d)));
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.waitForSelector('[data-testid="composer-input"]');
  await expect.poll(() => logs.join('')).toContain('native_probe ok=true');
  expect(await app.evaluate(({ app: a }) => a.isPackaged)).toBe(true);

  await page.getByTestId('file-input').setInputFiles(resolve(DEMO, 'rapport-expertise-fictif.pdf'));
  await expect(page.getByTestId('review')).toBeVisible();
  await protectAll(page);
  await page.getByTestId('review-continue').click();
  await page.getByTestId('preview-send').click();
  await expect(page.getByTestId('assistant-text')).toHaveCount(1, { timeout: 30_000 });
  await page.screenshot({ path: `${SHOTS}/20-installeur-demarre.png` });

  // Outils de développement désactivés dans l'application empaquetée.
  const devtools = await app.evaluate(({ BrowserWindow }) => {
    const wc = BrowserWindow.getAllWindows()[0]!.webContents;
    wc.openDevTools();
    return wc.isDevToolsOpened();
  });
  expect(devtools).toBe(false);
  await app.close();
});
