// Sécurité de l'application Electron (docs/DEV_SETUP.md, §7) et journaux sans texte en clair (§8).
import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { DEMO, launch } from './launch.js';

const SECRETS = ['Louis Cordier', 'Cordier', 'Vasseur', 'Barraud', 'Marchand', 'Delmas', '01 99 00', 'batiravel', 'FR76', '732 829 320'];

test('fenêtre isolée : pas d’accès à Node, CSP stricte, navigation bloquée', async () => {
  const { app, page } = await launch();
  const probe = await page.evaluate(() => ({
    require: typeof (window as unknown as { require?: unknown }).require,
    process: typeof (window as unknown as { process?: unknown }).process,
    api: Object.keys((window as unknown as { ianonyme: object }).ianonyme).sort(),
  }));
  expect(probe.require).toBe('undefined');
  expect(probe.process).toBe('undefined');
  expect(probe.api).toEqual(['app', 'chat', 'conversations', 'detect', 'files', 'llm', 'mentions', 'on', 'settings']);

  // Aucune ressource distante : une requête externe est refusée par la politique de contenu.
  const blocked = await page.evaluate(async () => {
    try {
      await fetch('https://example.org/');
      return false;
    } catch {
      return true;
    }
  });
  expect(blocked).toBe(true);

  const prefs = await app.evaluate(({ BrowserWindow }) => {
    const wc = BrowserWindow.getAllWindows()[0]!.webContents;
    const p = wc.getLastWebPreferences();
    return { ctx: p.contextIsolation, node: p.nodeIntegration, sandbox: p.sandbox };
  });
  expect(prefs).toEqual({ ctx: true, node: false, sandbox: true });

  // Une navigation vers l'extérieur ne change pas la page.
  const before = page.url();
  await page.evaluate(() => {
    window.location.href = 'https://example.org/';
  });
  await page.waitForTimeout(500);
  expect(page.url()).toBe(before);
  await app.close();
});

test('aucune valeur du document dans les journaux du processus principal', async () => {
  const { app, page } = await launch();
  const out: string[] = [];
  app.process().stderr?.on('data', (d: Buffer) => out.push(String(d)));
  app.process().stdout?.on('data', (d: Buffer) => out.push(String(d)));
  await page.getByTestId('file-input').setInputFiles(resolve(DEMO, 'rapport-expertise-fictif.docx'));
  await expect(page.getByTestId('review')).toBeVisible();
  while ((await page.getByTestId('verify-item').count()) > 0) {
    await page.getByTestId('verify-item').first().getByTestId('protect').click();
  }
  await page.getByTestId('review-continue').click();
  await page.getByTestId('preview-send').click();
  await expect(page.getByTestId('assistant-text')).toHaveCount(1, { timeout: 30_000 });
  await page.getByTestId('composer-input').fill('Simule une panne pour M. Louis Cordier.');
  await page.getByTestId('send').click();
  await page.getByTestId('brief-send').click();
  await expect(page.getByTestId('banner')).toBeVisible();
  const logs = out.join('');
  expect(logs.length).toBeGreaterThan(0);
  for (const secret of SECRETS) expect(logs, secret).not.toContain(secret);
  await app.close();
});
