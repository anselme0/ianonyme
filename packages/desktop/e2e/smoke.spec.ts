import { expect, test } from '@playwright/test';
import { SHOTS, launch } from './launch.js';

test('l’application démarre et affiche l’écran principal', async () => {
  const { app, page } = await launch();
  await expect(page.getByTestId('empty')).toBeVisible();
  await expect(page.getByTestId('protection-panel')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/01-accueil.png` });
  await app.close();
});
