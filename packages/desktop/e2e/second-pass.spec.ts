// Deuxième passe (docs/UI_UX.md, §11) : revue courte en ligne, écran de démarrage, « À propos ».
import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import { DEMO, SHOTS, launch } from './launch.js';

test('« Vérifier » ouvre le volet avec ce que l’analyse a protégé d’office', async () => {
  const { app, page } = await launch();
  await page.getByTestId('composer-input').fill('Le maire de la commune a signé hier.');
  await page.getByTestId('verify').click();
  await expect(page.getByTestId('review')).toBeVisible();
  await expect(page.getByTestId('verify-item')).toHaveCount(0);
  await expect(page.getByTestId('unprotect')).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS}/15-revue-en-ligne.png` });
  await page.getByTestId('review-continue').click();
  await expect(page.getByTestId('assistant-text')).toHaveCount(1, { timeout: 30_000 });
  await app.close();
});

test('« Envoyer » n’affiche rien quand tout est réglé', async () => {
  const { app, page } = await launch();
  await page.getByTestId('composer-input').fill('Le maire de la commune a signé hier.');
  await page.getByTestId('send').click();
  await expect(page.getByTestId('assistant-text')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByTestId('review')).toHaveCount(0);
  await app.close();
});

test('aucun volet avant « Vérifier », même après l’analyse d’un document', async () => {
  const { app, page } = await launch();
  await page.getByTestId('composer-input').fill('Je rédige mon message');
  await page.getByTestId('file-input').setInputFiles(resolve(DEMO, 'rapport-expertise-fictif.docx'));
  await expect(page.locator('.file-tile.file-ready')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('review')).toHaveCount(0);
  await expect(page.getByTestId('composer-input')).toHaveValue('Je rédige mon message');
  await app.close();
});

test('« Ne plus protéger » laisse la mention en clair, comme l’utilisateur l’a choisi', async () => {
  const { app, page } = await launch();
  await page.getByTestId('composer-input').fill('Le maire de la commune a signé hier.');
  await page.getByTestId('verify').click();
  await page.getByTestId('unprotect').click();
  await expect(page.getByTestId('unprotect')).toHaveCount(0);
  await page.getByTestId('review-cancel').click();
  await expect(page.getByTestId('review')).toHaveCount(0);
  await app.close();
});

test('écran de démarrage pendant la préparation de l’analyse, avec sortie vers l’analyse de base', async () => {
  // Un serveur qui ne termine jamais le téléchargement : l'analyse approfondie reste « en préparation ».
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-length': '1000000' });
    res.write('x');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as AddressInfo).port;
  const { app, page } = await launch({
    localModel: {
      engine: 'node-llama-cpp',
      active: 'essai',
      registry: [{ id: 'essai', file: 'essai.gguf', downloadUrl: `http://127.0.0.1:${port}/m`, sha256: '00', contextSize: 0, chunkChars: 2000, timeoutMs: 0 }],
    },
  });
  await expect(page.getByTestId('startup')).toBeVisible();
  await expect(page.getByTestId('startup')).toContainText('Préparation de l’analyse sur votre ordinateur');
  await page.screenshot({ path: `${SHOTS}/16-demarrage.png` });
  await page.getByTestId('startup-basic').click();
  await expect(page.getByTestId('startup')).toHaveCount(0);
  await expect(page.getByTestId('analysis-status')).toContainText('Analyse de base');
  await app.close();
  server.closeAllConnections();
  server.close();
});

test('fenêtre « À propos »', async () => {
  const { app, page } = await launch();
  await page.getByTestId('user-menu').click();
  await page.getByTestId('menu-about').click();
  await expect(page.getByTestId('about')).toContainText('Version de démonstration');
  await page.screenshot({ path: `${SHOTS}/17-a-propos.png` });
  await app.close();
});
