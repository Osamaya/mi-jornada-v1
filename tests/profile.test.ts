import { expect, test } from 'vitest';
import { initialState } from '../src/application/defaults';
import { demoWeek } from '../src/application/demo';
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

test.each([1, 2])(
  'respaldo v%i con tarifas y jornadas se convierte sin cambiar la fuente',
  (version) => {
    const current = demoWeek();
    const legacy: Record<string, unknown> = {
      ...current,
      schemaVersion: version,
      rates: current.rates.map(({ overtimeHourlyCents, ...rate }) => rate),
    };
    if (version === 1) delete legacy.profile;
    const text = JSON.stringify({
      format: 'mi-jornada-backup',
      formatVersion: version,
      exportedAt: '2026-10-19T00:00:00Z',
      state: legacy,
    });
    const restored = parseBackup(text);
    expect(restored.sessions).toEqual(current.sessions);
    expect(restored.rates[0].overtimeHourlyCents).toBeNull();
    expect(restored.schemaVersion).toBe(3);
    expect(restored.profile.displayName).toBe(version === 1 ? '' : current.profile.displayName);
    expect(JSON.stringify(legacy)).not.toContain('overtimeHourlyCents');
  },
);

test('un respaldo antiguo no puede inyectar una tarifa extra nueva sin versión', () => {
  const state = { ...demoWeek(), schemaVersion: 2 };
  expect(() =>
    parseBackup(
      JSON.stringify({
        format: 'mi-jornada-backup',
        formatVersion: 2,
        exportedAt: '2026-10-19T00:00:00Z',
        state,
      }),
    ),
  ).toThrow('campos incompatibles');
});
