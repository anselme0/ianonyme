// États et cas limites (docs/UI_UX.md, §8) : analyse de base, fichiers refusés, thème sombre, conversations.
import { expect, test } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { DEMO, SHOTS, launch } from './launch.js';

test('analyse de base quand le modèle local est absent', async () => {
  const { app, page } = await launch({ localEngine: 'none' });
  await expect(page.getByTestId('analysis-status')).toContainText('Analyse de base');
  await expect(page.getByTestId('deep-toggle')).toBeDisabled();
  await page.screenshot({ path: `${SHOTS}/10-analyse-de-base.png` });

  // Import : la revue s'ouvre sans suggestion et le dit.
  await page.getByTestId('file-input').setInputFiles(resolve(DEMO, 'rapport-expertise-fictif.pdf'));
  await expect(page.getByTestId('review')).toBeVisible();
  await expect(page.getByTestId('review')).toContainText('Analyse de base');
  await expect(page.getByTestId('verify-item')).toHaveCount(0);
  await expect(page.getByTestId('review-continue')).toBeEnabled();
  await page.screenshot({ path: `${SHOTS}/11-revue-analyse-de-base.png` });
  await app.close();
});

test('fichiers refusés avec un message clair', async () => {
  const { app, page } = await launch();
  const dir = mkdtempSync(join(tmpdir(), 'ianonyme-files-'));

  const blank = await PDFDocument.create();
  blank.addPage();
  const scanned = join(dir, 'scan.pdf');
  writeFileSync(scanned, await blank.save());
  await page.getByTestId('file-input').setInputFiles(scanned);
  await expect(page.getByTestId('banner')).toContainText('Ce PDF est une image : il n’est pas possible'.replace('’', "'"));
  await page.screenshot({ path: `${SHOTS}/12-pdf-scanne.png` });

  const png = join(dir, 'photo.png');
  writeFileSync(png, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]));
  await page.getByTestId('file-input').setInputFiles(png);
  await expect(page.getByTestId('banner')).toContainText('Les images ne sont pas prises en charge pour le moment.');
  await expect(page.getByTestId('file-chip')).toHaveCount(2);
  await app.close();
});

test('thème sombre', async () => {
  const { app, page } = await launch();
  await page.getByTestId('user-menu').click();
  await page.getByTestId('menu-settings').click();
  await page.getByText('Apparence', { exact: true }).click();
  await page.getByTestId('theme-dark').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: `${SHOTS}/13-sombre-parametres.png` });
  await page.getByRole('button', { name: 'Fermer' }).click();
  await page.getByTestId('composer-input').fill('Mme Sophie Renard, 01 99 00 11 22 et sophie@exemple.org');
  await expect(page.getByTestId('protect-count')).toContainText('3 éléments seront protégés');
  await page.screenshot({ path: `${SHOTS}/14-sombre-saisie.png` });
  await app.close();
});

test('conversations : création, renommage, effacement, suppression', async () => {
  const { app, page } = await launch();
  await page.getByTestId('new-conversation').click();
  await expect(page.getByTestId('conversation-item')).toHaveCount(2);
  const first = page.getByTestId('conversation-item').first();
  await first.hover();
  await page.getByRole('button', { name: 'Renommer' }).first().click();
  await page.locator('.conv-edit').fill('Dossier fictif A');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('conversation-item').first()).toHaveText('Dossier fictif A');
  await page.getByTestId('composer-input').fill('M. Jean Garnier écrit.');
  await page.getByTestId('send').click();
  await page.getByTestId('brief-send').click();
  await expect(page.getByTestId('assistant-text')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByTestId('entity-row')).toHaveCount(1);
  await page.getByTestId('user-menu').click();
  await page.getByTestId('menu-settings').click();
  await page.getByText('Données', { exact: true }).click();
  await page.getByTestId('clear-conversation').click();
  await page.getByTestId('confirm-clear').click();
  await expect(page.getByTestId('entity-row')).toHaveCount(0);
  await expect(page.getByTestId('empty')).toBeVisible();
  await page.getByTestId('conversation-item').first().hover();
  await page.getByRole('button', { name: 'Supprimer' }).first().click();
  await expect(page.getByTestId('conversation-item')).toHaveCount(1);
  await app.close();
});
