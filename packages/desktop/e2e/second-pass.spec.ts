// Deuxième passe (docs/UI_UX.md, §11) : revue courte en ligne, écran de démarrage, « À propos ».
import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { SHOTS, launch } from './launch.js';

test('revue courte en ligne pour un message court avec une suggestion', async () => {
  const { app, page } = await launch();
  await page.getByTestId('composer-input').fill('Le maire de la commune a signé hier.');
  await page.getByTestId('send').click();
  const inline = page.getByTestId('inline-review');
  await expect(inline).toBeVisible();
  await expect(page.getByTestId('review')).toHaveCount(0);
  await expect(page.getByTestId('inline-item')).toHaveCount(1);
  await expect(page.getByTestId('inline-continue')).toBeDisabled();
  await page.screenshot({ path: `${SHOTS}/15-revue-en-ligne.png` });
  await page.getByTestId('protect').click();
  await expect(page.getByTestId('inline-continue')).toBeEnabled();
  await page.getByTestId('inline-continue').click();
  const brief = page.getByTestId('brief');
  await expect(brief).toContainText('[FONCTION_1]');
  await expect(brief).not.toContainText('maire');
  await page.getByTestId('brief-send').click();
  await expect(page.getByTestId('assistant-text')).toHaveCount(1, { timeout: 30_000 });
  await app.close();
});

test('« Ignorer » laisse la mention en clair, comme l’utilisateur l’a choisi', async () => {
  const { app, page } = await launch();
  await page.getByTestId('composer-input').fill('Le maire de la commune a signé hier.');
  await page.getByTestId('send').click();
  await page.getByTestId('ignore').click();
  await page.getByTestId('inline-continue').click();
  await expect(page.getByTestId('brief')).toContainText('Le maire de la commune a signé hier.');
  await page.getByTestId('brief-cancel').click();
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
