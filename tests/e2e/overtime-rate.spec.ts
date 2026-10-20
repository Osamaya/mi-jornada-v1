import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('tarifa extra propia, neto, recarga, respaldo y vuelta al automático', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-21T23:00:00Z') });
  await page.goto('/');
  await page.getByRole('button', { name: 'Configuración', exact: true }).click();
  await page.getByLabel('¿Cuánto te pagan por hora? (USD)', { exact: true }).fill('16');
  await page.getByLabel('¿Cómo te pagan las horas extra?', { exact: true }).selectOption('custom');
  await page.getByLabel('¿Cuánto te pagan por cada hora extra? (USD)', { exact: true }).fill('18');
  await page.getByLabel('Ya confirmé con mi empleador', { exact: false }).check();
  await page.getByLabel('Confirmé que a mi trabajo', { exact: false }).check();
  await page.getByText('3. Descuentos de tu pago', { exact: true }).click();
  await page.getByLabel('Confirmé que a mi pago', { exact: false }).check();
  await page.getByLabel('Ya revisé este porcentaje', { exact: false }).check();
  await page.getByRole('button', { name: 'Guardar mis ajustes', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Guardado');
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await page.getByRole('button', { name: 'Agregar jornada manual', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Entrada', { exact: true }).fill('2026-10-19T08:00');
  await dialog.getByLabel('Salida', { exact: true }).fill('2026-10-19T18:00');
  await dialog.getByRole('button', { name: 'Guardar jornada', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Resumen', exact: true }).click();
  await expect(page.locator('.pay-overview').getByText('$164.00', { exact: true })).toBeVisible();
  const comparison = page.getByLabel('Comparación del pago por horas extra');
  await expect(comparison).toContainText('$176.00');
  await expect(comparison).toContainText('$12.00');
  await page.getByLabel('¿Qué día te pagan?').fill('2026-10-23');
  await page.getByLabel('Lo que esta empresa ya te pagó este año (USD)', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Guardar datos del pago', exact: true }).click();
  await expect(page.locator('.pay-overview').getByText('$135.05', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `test-results/${info.project.name}-tarifa-extra.png`,
    fullPage: true,
  });
  await page.reload();
  await page.getByRole('button', { name: 'Configuración', exact: true }).click();
  await expect(page.getByLabel('¿Cómo te pagan las horas extra?', { exact: true })).toHaveValue(
    'custom',
  );
  await expect(
    page.getByLabel('¿Cuánto te pagan por cada hora extra? (USD)', { exact: true }),
  ).toHaveValue('18.00');
  await page.getByText('Copias de mis registros', { exact: true }).click();
  const waiting = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Guardar respaldo', exact: true }).click();
  const download = await waiting;
  const path = `test-results/${info.project.name}-tarifa-extra.json`;
  await download.saveAs(path);
  const backup = JSON.parse(await readFile(path, 'utf8'));
  expect(backup.formatVersion).toBe(3);
  expect(backup.state.rates[0].overtimeHourlyCents).toBe(1800);
  await page
    .getByLabel('¿Cómo te pagan las horas extra?', { exact: true })
    .selectOption('automatic');
  await page.getByRole('button', { name: 'Guardar mis ajustes', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Guardado');
  await page.getByRole('button', { name: 'Resumen', exact: true }).click();
  await expect(page.locator('.pay-overview').getByText('$176.00', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Comparación del pago por horas extra')).toHaveCount(0);
  expect(errors).toEqual([]);
});
