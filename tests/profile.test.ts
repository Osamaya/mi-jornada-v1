import { expect, test } from 'vitest';
import { initialState } from '../src/application/defaults';
import { validateState } from '../src/domain/work/validate';
import { backupJson, parseBackup } from '../src/infrastructure/backup/files';

test('el nombre opcional viaja en el respaldo y se conserva al restaurar', () => {
  const state = initialState();
  state.profile.displayName = 'José Manuel';
  expect(parseBackup(backupJson(state)).profile.displayName).toBe('José Manuel');
});
test('un respaldo v1 se convierte sin alterar los datos originales', () => {
  const current = initialState();
  const { profile, ...rest } = current;
  const legacy = { ...rest, schemaVersion: 1 };
  const converted = parseBackup(
    JSON.stringify({
      format: 'mi-jornada-backup',
      formatVersion: 1,
      exportedAt: '2026-10-19T00:00:00Z',
      state: legacy,
    }),
  );
  expect(converted).toEqual(current);
  expect(legacy.schemaVersion).toBe(1);
});
test('el nombre rechaza contenido inválido y permite tildes', () => {
  const state = initialState();
  state.profile.displayName = 'José';
  validateState(state);
  state.profile.displayName = 'x'.repeat(61);
  expect(() => validateState(state)).toThrow();
  state.profile.displayName = 'José\nManuel';
  expect(() => validateState(state)).toThrow();
});
