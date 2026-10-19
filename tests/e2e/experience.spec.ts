import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark'] as const) {
  test('personalización y ayudas accesibles en modo ' + theme, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.emulateMedia({ colorScheme: theme });
    if (info.project.name === 'mobile') await page.setViewportSize({ width: 360, height: 800 });
    await page.clock.install({ time: new Date('2026-10-21T23:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-21T23:00:01Z'));
    await page.goto('/');
    await page.getByRole('button', { name: 'Personalizar mi nombre', exact: true }).click();
    await expect(page.getByText('3. Descuentos de tu pago', { exact: true })).toBeVisible();
    await expect(
      page.getByLabel('Impuesto federal que te descuentan (%)', { exact: true }),
    ).not.toBeVisible();
    const name = 'José Manuel Hernández Ramírez de la Cruz';
    await page.getByLabel('¿Cómo te gusta que te llamen?', { exact: false }).fill(name);
    await page.getByRole('button', { name: 'Guardar mi nombre', exact: true }).click();
    await page.getByRole('button', { name: 'Inicio', exact: true }).click();
    await page.clock.fastForward(5000);
    await expect(
      page.getByRole('heading', { name: 'Hola, ' + name + '.', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: 'test-results/' + info.project.name + '-' + theme + '-personalizado.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Configuración', exact: true }).click();
    await page.getByText('3. Descuentos de tu pago', { exact: true }).click();
    const help = page
      .locator('summary')
      .filter({ hasText: '¿Qué son Seguro Social, Medicare y FICA?' });
    await help.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('FICA es el nombre de la ley', { exact: false })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByText('FICA es el nombre de la ley', { exact: false })).not.toBeVisible();
    expect(
      await page
        .getByLabel('Impuesto federal que te descuentan (%)', { exact: true })
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(16);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: 'test-results/' + info.project.name + '-' + theme + '-ajustes.png',
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Resumen', exact: true }).click();
    const receiptHelp = page
      .locator('summary')
      .filter({ hasText: '¿Dónde encuentro este dato? ¿Qué es FICA?' });
    await receiptHelp.focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByText('Si los dos acumulados son distintos', { exact: false }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });
}
