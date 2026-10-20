import { expect, test } from 'vitest';
import { demoWeek, DEMO_WEEK } from '../src/application/demo';
import { calculateWeek } from '../src/domain/overtime/calculate';
import { deductions } from '../src/domain/payroll/deductions';
import { validateState } from '../src/domain/work/validate';
import { backupJson, csvWeek, parseBackup } from '../src/infrastructure/backup/files';
import { HOUR } from '../src/shared/models';

test.each([
  [null, 76000],
  [1800, 73000],
  [2400, 76000],
  [3000, 79000],
  [1600, 72000],
  [1400, 71000],
])('45 horas a $16 con hora extra %s: total %i sin duplicar primas', (extra, expected) => {
  const state = demoWeek();
  state.rates[0].hourlyCents = 1600;
  state.rates[0].overtimeHourlyCents = extra;
  validateState(state);
  const result = calculateWeek(state, DEMO_WEEK, DEMO_WEEK.endMs);
  expect(result.extraMs).toBe(5 * HOUR);
  expect(result.ordinaryMs).toBe(40 * HOUR);
  expect(result.grossCents).toBe(expected);
  expect(result.referenceGrossCents).toBe(76000);
  expect(result.warnings.some((w) => w.includes('menor que una vez y media'))).toBe(
    extra !== null && extra < 2400,
  );
});

test('el neto y el CSV usan el pago indicado y conservan la referencia', () => {
  const state = demoWeek();
  state.rates[0].hourlyCents = 1600;
  state.rates[0].overtimeHourlyCents = 1800;
  const result = calculateWeek(state, DEMO_WEEK, DEMO_WEEK.endMs);
  const net = deductions(result.grossCents, state.payroll[0], state.payments[0]);
  expect(net.net).toBe(58615);
  const csv = csvWeek(state, result);
  expect(csv).toContain('bruto_referencia_reglas_generales');
  expect(csv).toContain('$730.00');
  expect(csv).toContain('$760.00');
  expect(parseBackup(backupJson(state))).toEqual(state);
});

test('la tarifa extra no inventa horas extra ni desbloquea cobertura pendiente', () => {
  const state = demoWeek();
  state.rates[0].overtimeHourlyCents = 1800;
  state.sessions = state.sessions.slice(0, 1);
  state.breaks = state.breaks.slice(0, 1);
  const result = calculateWeek(state, DEMO_WEEK, DEMO_WEEK.endMs);
  expect(result.extraMs).toBe(0);
  expect(result.grossCents).toBe(18000);
  state.employment[0].coverageConfirmed = false;
  expect(calculateWeek(state, DEMO_WEEK, DEMO_WEEK.endMs).grossCents).toBeNull();
});

test('cambiar solo el pago extra dentro de una semana con overtime requiere revisión', () => {
  const state = demoWeek();
  state.rates.push({
    ...state.rates[0],
    id: 'next',
    effectiveFromMs: state.sessions[2].startMs,
    overtimeHourlyCents: 1800,
  });
  const result = calculateWeek(state, DEMO_WEEK, DEMO_WEEK.endMs);
  expect(result.baseCents).toBe(90000);
  expect(result.grossCents).toBeNull();
  expect(result.referenceGrossCents).toBeNull();
  expect(result.warnings.join(' ')).toContain('cambió dentro de la semana');
});

test('un cambio futuro conserva el cálculo anterior y rechaza importes inválidos', () => {
  const state = demoWeek();
  state.rates.push({
    ...state.rates[0],
    id: 'future',
    effectiveFromMs: DEMO_WEEK.endMs,
    overtimeHourlyCents: 1800,
  });
  expect(calculateWeek(state, DEMO_WEEK, DEMO_WEEK.endMs).grossCents).toBe(95000);
  for (const bad of [0, -1, 18.25, NaN, 10_000_001]) {
    state.rates[0].overtimeHourlyCents = bad;
    expect(() => validateState(state)).toThrow();
  }
});

test('las fracciones de hora se calculan exactas y se redondean una sola vez', () => {
  const state = demoWeek();
  state.rates[0].hourlyCents = 1601;
  state.rates[0].overtimeHourlyCents = 1801;
  state.sessions = [{ ...state.sessions[0], endMs: state.sessions[0].startMs + 8 * HOUR + 1000 }];
  state.breaks = [];
  const result = calculateWeek(state, DEMO_WEEK, DEMO_WEEK.endMs);
  expect(result.extraMs).toBe(1000);
  expect(result.grossCents).toBe(12809);
  expect(result.referenceGrossCents).toBe(12809);
});
