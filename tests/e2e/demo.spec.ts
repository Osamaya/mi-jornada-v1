import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark'] as const) {
  test(
    'semana de ejemplo aislada de los registros personales en modo ' + theme,
    async ({ page }, info) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.emulateMedia({ colorScheme: theme });
      if (info.project.name === 'mobile') await page.setViewportSize({ width: 360, height: 800 });
      await page.goto('/');
      await page.getByRole('button', { name: 'Configuración', exact: true }).click();
      await page.getByLabel('¿Cómo te gusta que te llamen?', { exact: false }).fill('Carlos');
      await page.getByRole('button', { name: 'Guardar mi nombre', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Perfil de Carlos', exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Inicio', exact: true }).click();
      await page.getByRole('button', { name: 'Agregar jornada manual', exact: true }).click();
      const editor = page.getByRole('dialog');
      await editor.getByLabel('Entrada', { exact: true }).fill('2026-10-14T08:00');
      await editor.getByLabel('Salida', { exact: true }).fill('2026-10-14T09:00');
      await editor.getByRole('button', { name: 'Guardar jornada', exact: true }).click();
      await expect(editor).not.toBeVisible();
      await page.getByRole('button', { name: 'Ver una semana de ejemplo', exact: true }).click();
      await expect(page).toHaveURL(/demo=week/);
      await expect(page.getByLabel('Datos de demostración')).toContainText('Datos ficticios');
      await expect(
        page.locator('.pay-overview').getByText('$950.00', { exact: true }),
      ).toBeVisible();
      await expect(
        page.locator('.pay-overview').getByText('$767.32', { exact: true }),
      ).toBeVisible();
      await expect(page.locator('.session-paid > strong')).toHaveCount(5);
      await expect(
        page.getByText('0 h 30 min de comida o pausa sin pago', { exact: true }),
      ).toHaveCount(5);
      await expect(
        page.getByRole('button', { name: 'Guardar datos del pago', exact: true }),
      ).toHaveCount(0);
      await page.getByText('Elige tu color', { exact: true }).click();
      await page.getByRole('button', { name: 'Verde bosque', exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('data-palette', 'forest');
      await page.getByText('Ver horario y supuestos del ejemplo', { exact: true }).click();
      await page.getByText('¿Cómo llegamos a $950 antes de descuentos?', { exact: true }).click();
      await expect(
        page.getByText('40 horas normales × $20 = $800.', { exact: false }),
      ).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `test-results/${info.project.name}-${theme}-semana-ejemplo.png`,
        fullPage: true,
      });
      await page.reload();
      await expect(
        page.locator('.pay-overview').getByText('$767.32', { exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Mis registros', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Hola, Carlos.', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Historial', exact: true }).click();
      await expect(page.getByText('1 jornadas registradas', { exact: true })).toBeVisible();
      expect(errors).toEqual([]);
    },
  );
}

test('abrir directamente el ejemplo no crea una base de datos personal', async ({ page }) => {
  await page.goto('/?demo=week');
  await expect(page.getByRole('heading', { name: 'Resumen semanal', exact: true })).toBeVisible();
  expect(
    await page.evaluate(async () =>
      (await indexedDB.databases()).some((db) => db.name === 'mi-jornada-local'),
    ),
  ).toBe(false);
  await page.getByRole('button', { name: 'Mis registros', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Iniciar jornada', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Historial', exact: true }).click();
  await expect(page.getByText('0 jornadas registradas', { exact: true })).toBeVisible();
});
