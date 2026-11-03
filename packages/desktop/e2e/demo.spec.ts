// Parcours de démonstration (docs/DOCUMENTATION.md, §13), de bout en bout, avec le faux assistant.
import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { DEMO, SHOTS, launch, protectAll } from './launch.js';

test.describe.configure({ mode: 'serial' });

test('parcours complet : import, vérification, envoi masqué, restitution, tour suivant, blocage', async () => {
  const { app, page } = await launch();

  // 1. Import d'un rapport fictif (.docx) : tuile du document, analyse en arrière-plan, aucun volet.
  await page.getByTestId('file-input').setInputFiles(resolve(DEMO, 'rapport-expertise-fictif.docx'));
  await expect(page.locator('.file-tile.file-ready')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.file-tile')).toContainText('rapport-expertise-fictif.docx');
  await expect(page.getByTestId('review')).toHaveCount(0);

  // 2. « Vérifier » ouvre le volet : un onglet pour le message, un par document.
  await page.getByTestId('composer-input').fill('Établis la chronologie des faits.');
  await page.getByTestId('verify').click();
  await expect(page.getByTestId('review')).toBeVisible();
  await expect(page.getByTestId('review-tab')).toHaveCount(2);
  await page.getByTestId('review-tab').nth(1).click();
  await expect(page.getByTestId('review-doc')).toContainText('Louis Cordier');
  await expect(page.getByTestId('unprotect').first()).toBeVisible();
  // Le petit bouton montre ce que l'IA reçoit : des repères, aucune valeur réelle.
  await page.getByTestId('review-see-sent').click();
  const sent = page.getByTestId('review-sent');
  await expect(sent).toBeVisible();
  await expect(sent).toContainText('[NOM_');
  expect(await sent.innerText()).not.toContain('Louis Cordier');
  await page.screenshot({ path: `${SHOTS}/04-comparaison.png` });
  await page.getByTestId('review-see-sent').click();
  await expect(page.getByTestId('review-doc')).toBeVisible();
  await protectAll(page);
  await page.screenshot({ path: `${SHOTS}/03-revue-terminee.png` });

  // 3. Envoi depuis le volet : la réponse restitue les vraies valeurs, soulignées.
  await page.getByTestId('review-continue').click();
  await expect(page.getByTestId('sent-file')).toContainText('rapport-expertise-fictif.docx', { timeout: 30_000 });
  const reply = page.getByTestId('assistant-text').last();
  await expect(reply).toContainText('chronologie', { timeout: 30_000 });
  await expect(reply.locator('.restored').first()).toBeVisible({ timeout: 30_000 });
  const replyText = await reply.innerText();
  expect(replyText).not.toMatch(/\[[A-Z_]+_\d+\]/);
  expect(replyText).toMatch(/14 janvier 2025/);
  await expect(page.getByTestId('restored-notice')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/05-reponse-restituee.png` });
  const hint = await reply.locator('.restored').first().getAttribute('title');
  expect(hint).toMatch(/^Remplace \[[A-Z_]+_\d+\]$/);

  // 4. Volet Protection : liste groupée par famille, sans repères entre crochets.
  await expect(page.getByTestId('entity-row').first()).toBeVisible();
  const row = page.getByTestId('entity-row').filter({ hasText: 'Louis Cordier' });
  await expect(row).toBeVisible();
  expect(await page.getByTestId('protection-panel').innerText()).not.toMatch(/\[[A-Z_]+_\d+\]/);

  // 5. Tour suivant : « Envoyer » vérifie sans rien montrer.
  await page.getByTestId('composer-input').fill('Que dit M. Louis Cordier ?');
  await expect(page.getByTestId('protect-count')).toContainText('1 élément sera protégé');
  await page.getByTestId('send').click();
  await expect(page.getByTestId('assistant-text')).toHaveCount(2, { timeout: 30_000 });
  await expect(page.getByTestId('review')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/06-tour-suivant.png` });

  // 6. Deux personnes qui se confondent (même initiale) : « Envoyer » ouvre le volet, point de vigilance.
  await page.getByTestId('composer-input').fill('Jean Dupuis et Jacques Dupuis sont frères.');
  await page.getByTestId('send').click();
  await expect(page.getByTestId('assistant-text')).toHaveCount(3, { timeout: 30_000 });
  await page.getByTestId('composer-input').fill('J. Dupuis a signé hier.');
  await page.getByTestId('send').click();
  await expect(page.getByTestId('review')).toBeVisible();
  await expect(page.getByTestId('verify-item')).toHaveCount(1);
  await expect(page.getByTestId('review-continue')).toBeDisabled();
  await page.screenshot({ path: `${SHOTS}/08-conflit.png` });
  await page.getByTestId('choose-candidate').first().click();
  await expect(page.getByTestId('review-continue')).toBeEnabled();
  await page.getByTestId('review-cancel').click();

  await app.close();
});
