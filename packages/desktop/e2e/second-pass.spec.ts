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

test('une croix au survol d’un élément protégé le retire', async () => {
  const { app, page } = await launch();
  await page.getByTestId('composer-input').fill('Le maire de la commune a signé hier.');
  await page.getByTestId('verify').click();
  await expect(page.getByTestId('unprotect')).toHaveCount(1);
  await page.locator('[data-testid="review-doc"] mark.mark-protected').first().hover();
  await page.getByTestId('mark-unprotect').first().click();
  await expect(page.getByTestId('unprotect')).toHaveCount(0);
  await app.close();
});

test('un document Word s’affiche comme dans Word, avec les éléments surlignés et leur croix', async () => {
  const { app, page } = await launch();
  await page.getByTestId('file-input').setInputFiles(resolve(DEMO, 'expertise-affaire-brunet.docx'));
  await expect(page.locator('.file-tile.file-ready')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('verify').click();
  const doc = page.getByTestId('review-doc');
  await expect(doc.locator('section.docx').first()).toBeVisible();
  await expect(doc).toContainText('RAPPORT D’EXPERTISE JUDICIAIRE');
  await expect(doc.locator('table').first()).toBeVisible();
  const marks = doc.locator('mark.dx-mark.mark-protected');
  expect(await marks.count()).toBeGreaterThan(5);
  // Le nom d'un participant, dans le tableau, est surligné : la croix au survol le retire.
  const cell = doc.locator('td mark.dx-mark.mark-protected', { hasText: 'Isabelle Brunet' }).first();
  await expect(cell).toBeVisible();
  const before = await doc.locator('mark.dx-mark').allInnerTexts();
  await cell.hover();
  await cell.locator('button.mark-x').click();
  await expect.poll(async () => (await doc.locator('mark.dx-mark').allInnerTexts()).join('|')).not.toBe(before.join('|'));
  // Vue « ce que l'IA va recevoir » : même document, repères à la place des valeurs.
  await page.getByTestId('review-see-sent').click();
  await expect(doc).toContainText('[NOM_');
  await page.screenshot({ path: `${SHOTS}/18-document-word.png` });
  await app.close();
});

/** Serveur local lent : l'analyse approfondie met 3 secondes à répondre. */
async function slowServer(): Promise<{ url: string; close(): void }> {
  const server = createServer((req, res) => {
    const reply = (): void => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(req.url?.endsWith('/models') ? { data: [] } : { choices: [{ message: { content: '{"mentions":[]}' } }] }));
    };
    if (req.url?.endsWith('/models')) reply();
    else setTimeout(reply, 3000);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const port = (server.address() as AddressInfo).port;
  return { url: `http://127.0.0.1:${port}/v1`, close: () => { server.closeAllConnections(); server.close(); } };
}

const slowModel = (url: string) => ({
  engine: 'openai-compatible',
  active: 's',
  registry: [{ id: 's', file: '', downloadUrl: '', sha256: '', contextSize: 0, chunkChars: 2000, timeoutMs: 20000, baseUrl: url, model: 'm' }],
});

test('« Vérifier » ouvre le volet tout de suite, sans attendre la fin de l’analyse', async () => {
  const slow = await slowServer();
  const { app, page } = await launch({ localModel: slowModel(slow.url) });
  await expect(page.getByTestId('analysis-status')).toContainText('active');
  await page.getByTestId('composer-input').fill('Le maire de la commune a signé hier.');
  await page.getByTestId('verify').click();
  await expect(page.getByTestId('review')).toBeVisible({ timeout: 2000 });
  await expect(page.getByTestId('review-wait')).toBeVisible();
  await expect(page.getByTestId('review-continue')).toBeDisabled();
  await expect(page.getByTestId('review-wait')).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByTestId('review-continue')).toBeEnabled();
  await app.close();
  slow.close();
});

test('les boutons restent cliquables pendant l’analyse d’un document', async () => {
  const slow = await slowServer();
  const { app, page } = await launch({ localModel: slowModel(slow.url) });
  await expect(page.getByTestId('analysis-status')).toContainText('active');
  await page.getByTestId('file-input').setInputFiles(resolve(DEMO, 'expertise-affaire-brunet.docx'));
  await expect(page.locator('.file-tile.file-deep')).toBeVisible();
  await expect(page.getByTestId('verify')).toBeEnabled();
  await expect(page.getByTestId('send')).toBeEnabled();
  await page.getByTestId('verify').click();
  await expect(page.getByTestId('review')).toBeVisible({ timeout: 2000 });
  await expect(page.getByTestId('review-continue')).toBeDisabled();
  await expect(page.getByTestId('review-continue')).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByTestId('review-doc').locator('mark.dx-mark').first()).toBeVisible();
  await app.close();
  slow.close();
});

test('l’écran d’attente du volet propose de passer en analyse de base', async () => {
  const slow = await slowServer();
  const { app, page } = await launch({ localModel: slowModel(slow.url) });
  await expect(page.getByTestId('analysis-status')).toContainText('active');
  await page.getByTestId('composer-input').fill('Le maire de la commune a signé hier.');
  await page.getByTestId('verify').click();
  await expect(page.getByTestId('review-wait')).toBeVisible({ timeout: 2000 });
  await page.getByTestId('review-skip').click();
  await expect(page.getByTestId('review-wait')).toHaveCount(0, { timeout: 2000 });
  await expect(page.getByTestId('review')).toContainText('Analyse de base');
  await expect(page.getByTestId('review-continue')).toBeEnabled();
  await app.close();
  slow.close();
});

test('« Envoyer » pendant l’analyse part tout seul à la fin', async () => {
  const slow = await slowServer();
  const { app, page } = await launch({ localModel: slowModel(slow.url) });
  await expect(page.getByTestId('analysis-status')).toContainText('active');
  await page.getByTestId('composer-input').fill('Le maire de la commune a signé hier.');
  await page.getByTestId('send').click();
  await expect(page.getByTestId('cancel-queued')).toBeVisible();
  await expect(page.getByTestId('skip-analysis')).toBeVisible();
  await expect(page.getByTestId('assistant-text')).toHaveCount(1, { timeout: 20_000 });
  await app.close();
  slow.close();
});

test('« Envoyer » en attente : « Passer en analyse de base » envoie sans attendre', async () => {
  const slow = await slowServer();
  const { app, page } = await launch({ localModel: slowModel(slow.url) });
  await expect(page.getByTestId('analysis-status')).toContainText('active');
  await page.getByTestId('composer-input').fill('Le maire de la commune a signé hier.');
  await page.getByTestId('send').click();
  await page.getByTestId('skip-analysis').click();
  await expect(page.getByTestId('assistant-text')).toHaveCount(1, { timeout: 2500 });
  await app.close();
  slow.close();
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
