import { expect, test } from 'vitest';
import { demoWeek, DEMO_WEEK } from '../src/application/demo';
import { calculateWeek } from '../src/domain/overtime/calculate';
import { deductions } from '../src/domain/payroll/deductions';
import { HOUR } from '../src/shared/models';
import { initialState } from '../src/application/defaults';

test('la semana ficticia produce 45 horas pagadas, 5 extra y un neto explicable', () => {
  const state = demoWeek();
  const estimate = calculateWeek(state, DEMO_WEEK, DEMO_WEEK.endMs);
  expect(estimate.presenceMs).toBe(47.5 * HOUR);
  expect(estimate.paidMs).toBe(45 * HOUR);
  expect(estimate.ordinaryMs).toBe(40 * HOUR);
  expect(estimate.extraMs).toBe(5 * HOUR);
  expect(estimate.grossCents).toBe(95000);
  expect(estimate.baseCents).toBe(90000);
  expect(estimate.premiumCents).toBe(5000);
  expect(estimate.provisional).toBe(false);
  const taxes = deductions(estimate.grossCents, state.payroll[0], state.payments[0]);
  expect(taxes).toMatchObject({
    socialSecurity: 5890,
    medicare: 1378,
    federal: 9500,
    other: 1500,
    net: 76732,
  });
});

test('el ejemplo se crea aislado y no precarga jornadas ni confirmaciones personales', () => {
  const first = demoWeek();
  first.sessions[0].note = 'Cambio de prueba';
  expect(demoWeek().sessions[0].note).not.toBe('Cambio de prueba');
  const personal = initialState();
  expect(personal.sessions).toEqual([]);
  expect(personal.payments).toEqual([]);
  expect(personal.employment[0].coverageConfirmed).toBe(false);
  expect(personal.payroll[0].ficaConfirmed).toBe(false);
});
