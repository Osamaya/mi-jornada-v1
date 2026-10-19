import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('registro, reinicio, cálculo, respaldo y restauración', async ({ page, context }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-21T23:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-21T23:00:01Z'));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Iniciar jornada', exact: true })).toBeVisible();
  await page.screenshot({ path: `test-results/${info.project.name}-inicio.png`, fullPage: true });
  await page.getByRole('button', { name: 'Configuración', exact: true }).click();
  await page.getByLabel('¿Cómo te gusta que te llamen?', { exact: false }).fill('José');
  await page.getByRole('button', { name: 'Guardar mi nombre', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Perfil de José', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hola, José.', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hola, José.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Configuración', exact: true }).click();
  await page.getByLabel('Confirmé que a mi trabajo', { exact: false }).check();
  await page.getByLabel('Ya confirmé con mi empleador', { exact: false }).check();
  await page.getByText('3. Descuentos de tu pago', { exact: true }).click();
  await page.getByLabel('Confirmé que a mi pago', { exact: false }).check();
  await page.getByLabel('Ya revisé este porcentaje', { exact: false }).check();
  await page.getByLabel('¿Cuánto te pagan por hora? (USD)', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Guardar mis ajustes', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Guardado');
  await page.getByRole('button', { name: 'Inicio', exact: true }).click();
  await page.getByRole('button', { name: 'Iniciar jornada', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Finalizar jornada', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Finalizar jornada', exact: true })).toBeVisible();
  await page.clock.fastForward(3_600_000);
  // Sin red: tanto el registro como SQLite siguen funcionando tras cargar los assets.
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Finalizar jornada', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Iniciar jornada', exact: true })).toBeVisible();
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Agregar jornada manual', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Entrada', { exact: true }).fill('2026-10-19T08:00');
  await dialog.getByLabel('Salida', { exact: true }).fill('2026-10-19T17:00');
  await dialog.getByRole('button', { name: 'Guardar jornada', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Resumen', exact: true }).click();
  await expect(page.getByText('10 h 00 min', { exact: true })).toHaveCount(2);
  await page.getByText('¿Dónde encuentro este dato? ¿Qué es FICA?', { exact: true }).click();
  await expect(
    page.getByText('FICA es el nombre de la ley que agrupa', { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: 'test-results/' + info.project.name + '-ayuda-recibo.png',
    fullPage: true,
  });
  await page.getByText('¿Dónde encuentro este dato? ¿Qué es FICA?', { exact: true }).click();
  await page.getByLabel('¿Qué día te pagan?').fill('2026-10-23');
  await page
    .getByLabel('Lo que esta empresa ya te pagó este año (USD)', { exact: true })
    .fill('12500');
  await page
    .getByRole('button', { name: 'No sé este dato; lo dejo pendiente', exact: true })
    .click();
  await expect(
    page.getByLabel('Lo que esta empresa ya te pagó este año (USD)', { exact: true }),
  ).toHaveValue('');
  await page.getByRole('button', { name: 'Guardar datos del pago', exact: true }).click();
  await expect(
    page.getByText('Falta el acumulado del recibo anterior', { exact: false }),
  ).toBeVisible();
  await page.getByLabel('Lo que esta empresa ya te pagó este año (USD)', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Guardar datos del pago', exact: true }).click();
  await expect(page.getByText('$164.70', { exact: true })).toHaveCount(2);
  await page.screenshot({ path: `test-results/${info.project.name}-resumen.png`, fullPage: true });
  await page.getByRole('button', { name: 'Historial', exact: true }).click();
  await expect(page.getByText('2 jornadas registradas')).toBeVisible();
  await page.getByRole('button', { name: 'Editar jornada del 2026-10-19', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Salida', { exact: true }).fill('2026-10-19T16:00');
  await page
    .getByRole('dialog')
    .getByLabel('Motivo del registro o corrección')
    .fill('Salida corregida con recibo');
  await page.getByRole('button', { name: 'Guardar jornada', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Editar jornada del 2026-10-21', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Nota opcional').fill('Solo cambió la nota');
  await page
    .getByRole('dialog')
    .getByLabel('Motivo del registro o corrección')
    .fill('Añadir nota sin redondear fichaje');
  await page.getByRole('button', { name: 'Guardar jornada', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Configuración', exact: true }).click();
  await page.getByText('Copias de mis registros', { exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Guardar respaldo', exact: true }).click();
  const download = await downloadPromise;
  await download.saveAs(`test-results/${info.project.name}-backup.json`);
  const exported = JSON.parse(
    await readFile(`test-results/${info.project.name}-backup.json`, 'utf8'),
  );
  const clockSession = exported.state.sessions.find(
    (s: { source: string }) => s.source === 'clock',
  );
  expect(clockSession.startMs).toBe(Date.parse('2026-10-21T23:00:01Z'));
  expect(clockSession.endMs).toBe(Date.parse('2026-10-22T00:00:01Z'));
  await page.getByLabel('Revisar respaldo', { exact: true }).setInputFiles({
    name: 'corrupto.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{bad'),
  });
  await expect(page.getByRole('alert')).toContainText('JSON válido');
  await page
    .getByLabel('Revisar respaldo', { exact: true })
    .setInputFiles(`test-results/${info.project.name}-backup.json`);
  await expect(page.getByText('Revisar antes de reemplazar', { exact: true })).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Restaurar y reemplazar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('restaurado');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});
