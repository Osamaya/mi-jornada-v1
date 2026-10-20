import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark'] as const) {
  test('el color se puede comparar y conservar en modo ' + theme, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/');
    await page.getByRole('button', { name: 'Configuración', exact: true }).click();
    await page.getByLabel('¿Cómo te gusta que te llamen?', { exact: false }).fill('José Prueba');
    await page.getByRole('button', { name: 'Guardar mi nombre', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Perfil de José Prueba', exact: true }),
    ).toBeVisible();
    await page.getByText('Elige tu color', { exact: true }).click();
    for (const [name, id] of [
      ['Verde bosque', 'forest'],
      ['Grafito', 'graphite'],
      ['Azul ejecutivo', 'navy'],
    ]) {
      await page.getByRole('button', { name, exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('data-palette', id);
      await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.getByRole('button', { name: 'Verde bosque', exact: true }).click();
    await page.screenshot({
      path: `test-results/${info.project.name}-${theme}-colores.png`,
      fullPage: true,
    });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'forest');
    await expect(
      page.getByRole('heading', { name: 'Hola, José Prueba.', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Configuración', exact: true }).click();
    await page.getByText('Elige tu color', { exact: true }).click();
    await expect(page.getByRole('button', { name: 'Verde bosque', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
}
