// Parcours de démonstration (docs/DOCUMENTATION.md, §13), de bout en bout, avec le faux assistant.
import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { DEMO, SHOTS, launch, protectAll } from './launch.js';

const REAL_NAMES = ['Louis Cordier', 'Étienne Vasseur', 'Odile Marchand', 'Hélène Barraud', 'Paul-Henri Delmas', 'Claire Perrin'];

test.describe.configure({ mode: 'serial' });

test('parcours complet : import, revue, envoi masqué, restitution, tour suivant, blocage, fiabilité', async () => {
  const { app, page } = await launch();

  // 1. Import d'un rapport fictif (.docx) : la revue plein écran s'ouvre.
  await page.getByTestId('file-input').setInputFiles(resolve(DEMO, 'rapport-expertise-fictif.docx'));
  await expect(page.getByTestId('review')).toBeVisible();
  await expect(page.getByTestId('review-doc')).toContainText('Louis Cordier');
  await page.screenshot({ path: `${SHOTS}/02-revue.png` });

  // 2. Le bouton Continuer est inactif tant qu'il reste des points à vérifier ; traitement des suggestions.
  const suggestions = await page.getByTestId('verify-item').count();
  expect(suggestions).toBeGreaterThan(0);
  await expect(page.getByTestId('review-continue')).toBeDisabled();
  await expect(page.getByTestId('review-progress')).toContainText(`0 sur ${suggestions}`);
  await protectAll(page);
  await expect(page.getByTestId('review-continue')).toBeEnabled();
  await expect(page.getByTestId('review-progress')).toContainText(`${suggestions} sur ${suggestions}`);
  await page.screenshot({ path: `${SHOTS}/03-revue-terminee.png` });

  // 3. « Ce que l'IA va recevoir » : aucune valeur réelle, repères visibles.
  await page.getByTestId('review-continue').click();
  const masked = page.getByTestId('preview-masked');
  await expect(masked).toBeVisible();
  const maskedText = await masked.innerText();
  for (const name of REAL_NAMES) expect(maskedText).not.toContain(name);
  expect(maskedText).not.toContain('01 99 00 67 45');
  expect(maskedText).not.toContain('FR76');
  expect(maskedText).toMatch(/\[PERSONNE_\d+\]/);
  expect(maskedText).toMatch(/\[FONCTION_\d+\]|\[PERSONNE_\d+\]/);
  await page.getByTestId('view-compare').click();
  await page.screenshot({ path: `${SHOTS}/04-comparaison.png` });

  // 4. Envoi : message de tâche « chronologie ».
  await page.getByTestId('preview-back').click();
  await page.getByTestId('composer-input').fill('Établis la chronologie des faits.');
  await page.getByTestId('send').click();
  // Plusieurs étapes possibles : revue du fichier déjà faite, aperçu final.
  const send = page.getByTestId('preview-send');
  await expect(send).toBeVisible();
  await send.click();

  // 5. Réponse restituée avec les vraies valeurs, soulignées.
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

  // 6. Volet Protection : entités groupées par famille ; onglet « Ce que l'IA va recevoir ».
  await expect(page.getByTestId('entity-row').first()).toBeVisible();
  const row = page.getByTestId('entity-row').filter({ hasText: 'Louis Cordier' });
  const placeholder = (await row.locator('.placeholder').innerText()).trim();
  expect(placeholder).toMatch(/^\[PERSONNE_\d+\]$/);

  // 7. Tour suivant : le nom saisi directement reçoit le même repère.
  await page.getByTestId('composer-input').fill('Que dit M. Louis Cordier ?');
  await expect(page.getByTestId('protect-count')).toContainText('1 élément sera protégé');
  await page.getByTestId('tab-received').click();
  await expect(page.getByTestId('received-text')).toContainText(`Que dit M. ${placeholder} ?`.replace('M. ', ''));
  await page.getByTestId('send').click();
  const brief = page.getByTestId('brief');
  await expect(brief).toBeVisible();
  await expect(brief).toContainText(placeholder);
  await page.screenshot({ path: `${SHOTS}/06-tour-suivant.png` });
  await page.getByTestId('brief-send').click();
  await expect(page.getByTestId('assistant-text')).toHaveCount(2, { timeout: 30_000 });

  // 8. Envoi bloqué : deux personnes de même nom, une occurrence ambiguë.
  await page.getByTestId('composer-input').fill('Pierre Dupuis et Jacques Dupuis sont frères.');
  await page.getByTestId('send').click();
  await page.getByTestId('brief-send').click();
  await expect(page.getByTestId('assistant-text')).toHaveCount(3, { timeout: 30_000 });
  await page.getByTestId('composer-input').fill('Dupuis a signé hier.');
  await page.getByTestId('send').click();
  const banner = page.getByTestId('banner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('Envoi bloqué : le nom Dupuis apparaît encore dans le message.');
  await expect(page.getByTestId('composer-input')).toHaveValue('Dupuis a signé hier.');
  await page.screenshot({ path: `${SHOTS}/07-envoi-bloque.png` });

  // 9. « Protéger » ouvre la revue ; le conflit se tranche explicitement.
  await page.getByTestId('blocked-protect').click();
  await expect(page.getByTestId('review')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/08-conflit.png` });
  await page.getByTestId('choose-candidate').first().click();
  await expect(page.getByTestId('review-continue')).toBeEnabled();
  await page.getByTestId('review-cancel').click();

  // 10. Écran « Fiabilité de la détection ».
  await page.getByTestId('user-menu').click();
  await page.getByTestId('menu-reliability').click();
  await expect(page.getByTestId('reliability')).toBeVisible();
  await expect(page.getByTestId('measured-on')).toContainText('documents fictifs');
  await page.screenshot({ path: `${SHOTS}/09-fiabilite.png` });

  await app.close();
});
