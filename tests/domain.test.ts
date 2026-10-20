import { describe, expect, test } from 'vitest';
import { initialState } from '../src/application/defaults';
import {
  finishBreak,
  finishSession,
  saveSession,
  startBreak,
  startSession,
  voidSession,
} from '../src/application/commands';
import { calculateWeek } from '../src/domain/overtime/calculate';
import { deductions } from '../src/domain/payroll/deductions';
import { hours, parseMoney, percentOf, rounded } from '../src/domain/money';
import { localInstant, weekAt } from '../src/domain/time';
import { validateState } from '../src/domain/work/validate';
import { backupJson, csvWeek, parseBackup } from '../src/infrastructure/backup/files';
import { HOUR, WEEK, type AppState, type WeeklyPaymentRecord } from '../src/shared/models';

const at = (s: string) => localInstant(s);
const MONDAY = at('2026-10-19T00:00'),
  END = MONDAY + WEEK;
function fixture(rate = 2000): AppState {
  const state = initialState();
  state.employment[0].coverageConfirmed = true;
  state.employment[0].weekConfirmed = true;
  state.employment[0].weekAnchorMs = MONDAY;
  state.payroll[0].ficaConfirmed = true;
  state.payroll[0].federalConfirmed = true;
  state.rates.push({
    id: 'rate',
    effectiveFromMs: 0,
    hourlyCents: rate,
    overtimeHourlyCents: null,
  });
  return state;
}
function shift(state: AppState, date: string, hours: number, start = '08:00') {
  const startMs = at(`${date}T${start}`);
  state.sessions.push({
    id: `s${state.sessions.length}`,
    startMs,
    endMs: startMs + hours * HOUR,
    zone: 'America/Los_Angeles',
    source: 'manual',
    note: '',
    revision: 1,
    voidedAtMs: null,
  });
}
function run(state: AppState) {
  validateState(state);
  return calculateWeek(state, { startMs: MONDAY, endMs: END }, END);
}
function schedule(durations: number[], rate = 2000) {
  const state = fixture(rate);
  durations.forEach((h, i) => shift(state, `2026-10-${19 + i}`, h));
  return state;
}

describe('overtime estándar y concurrencia verificada', () => {
  test.each([
    [35, 70000, 0],
    [40, 80000, 0],
    [45, 95000, 5],
  ])('%i horas semanales', (total, gross, extra) => {
    const result = run(schedule(Array(5).fill(total / 5)));
    expect(result.grossCents).toBe(gross);
    expect(result.extraMs).toBe(extra * HOUR);
  });
  test.each([
    [1600, 17600, 2],
    [1800, 18000, 0],
    [2000, 20000, 0],
  ])('tarifa %i: umbral diario', (rate, gross, extra) => {
    const result = run(schedule([10], rate));
    expect(result.grossCents).toBe(gross);
    expect(result.extraMs).toBe(extra * HOUR);
  });
  test('diaria con semana menor a 40', () => {
    const result = run(schedule([9, 7, 7], 1600));
    expect(result.grossCents).toBe(37600);
    expect(result.extraMs).toBe(HOUR);
  });
  test('AO-2025-05 escenario 1: 44 horas, 10 extra', () => {
    const result = run(schedule([10, 4, 12, 12, 6], 1600));
    expect(result.paidMs).toBe(44 * HOUR);
    expect(result.dailyExtraMs).toBe(10 * HOUR);
    expect(result.weeklyExtraMs).toBe(4 * HOUR);
    expect(result.extraMs).toBe(10 * HOUR);
    expect(result.grossCents).toBe(78400);
  });
  test('AO-2025-05 escenario 2: 44 horas, 4 extra', () => {
    const result = run(schedule([9, 8, 9, 4, 8, 6], 1600));
    expect(result.dailyExtraMs).toBe(2 * HOUR);
    expect(result.extraMs).toBe(4 * HOUR);
    expect(result.grossCents).toBe(73600);
  });
  test('cinco de nueve: no duplica diario y semanal', () => {
    const r = run(schedule([9, 9, 9, 9, 9], 1600));
    expect(r.grossCents).toBe(76000);
    expect(r.extraMs).toBe(5 * HOUR);
  });
  test('AO-2025-07 ejemplo 1: 43.5 horas y 3.5 extra', () => {
    const s = fixture(1600);
    shift(s, '2026-10-19', 6, '11:00');
    shift(s, '2026-10-20', 11);
    shift(s, '2026-10-22', 8, '11:00');
    shift(s, '2026-10-23', 8.5, '10:30');
    shift(s, '2026-10-24', 8, '11:00');
    shift(s, '2026-10-25', 2, '09:00');
    const r = run(s);
    expect(r.paidMs).toBe(43.5 * HOUR);
    expect(r.dailyExtraMs).toBe(3.5 * HOUR);
    expect(r.extraMs).toBe(3.5 * HOUR);
  });
  test('AO-2025-07 ejemplo 2: turnos adelantados, tres horas extra', () => {
    const s = fixture(1600);
    shift(s, '2026-10-19', 8, '11:00');
    shift(s, '2026-10-20', 7);
    shift(s, '2026-10-21', 8, '09:00');
    expect(run(s).extraMs).toBe(3 * HOUR);
  });
  test('AO-2025-07 ejemplo 3: ventana se conserva varios días', () => {
    const s = fixture(1600);
    shift(s, '2026-10-20', 6.25, '06:00');
    shift(s, '2026-10-21', 8, '04:15');
    shift(s, '2026-10-22', 8, '04:15');
    shift(s, '2026-10-23', 8.25, '04:15');
    const r = run(s);
    expect(r.paidMs).toBe(30.5 * HOUR);
    expect(r.extraMs).toBe(0);
  });
  test('AO-2025-07 ejemplo 4: dos turnos y día siguiente', () => {
    const s = fixture(1600);
    shift(s, '2026-10-19', 7, '06:00');
    shift(s, '2026-10-19', 4, '19:00');
    shift(s, '2026-10-20', 8, '07:00');
    expect(run(s).extraMs).toBe(3 * HOUR);
  });
  test('medianoche no reinicia el día', () => {
    const s = fixture(1600);
    shift(s, '2026-10-19', 10, '22:00');
    const r = run(s);
    expect(r.extraMs).toBe(2 * HOUR);
    expect(r.grossCents).toBe(17600);
  });
  test('domingo sin prima automática', () => {
    const s = fixture();
    shift(s, '2026-10-25', 7);
    expect(run(s).grossCents).toBe(14000);
  });
  test('orden de entrada no cambia cálculo', () => {
    const s = schedule([10, 4, 12, 12, 6], 1600),
      expected = run(s);
    s.sessions.reverse();
    expect(run(s)).toEqual(expected);
  });
  test('contexto de día laboral anterior a la semana', () => {
    const s = fixture(1600);
    shift(s, '2026-10-18', 8, '14:00');
    shift(s, '2026-10-19', 4, '08:00');
    expect(run(s).dailyExtraMs).toBe(4 * HOUR);
  });
  test('cambio de modalidad en ventana que cruza semana no se inventa', () => {
    const s = fixture(1600);
    shift(s, '2026-10-18', 8, '14:00');
    shift(s, '2026-10-19', 4, '08:00');
    s.employment[0].mode = 'four-ten';
    s.employment.push({
      ...s.employment[0],
      id: 'new-standard',
      effectiveFromMs: MONDAY,
      mode: 'standard',
    });
    const r = run(s);
    expect(r.grossCents).toBeNull();
    expect(r.warnings.join(' ')).toContain('modalidad cambió');
  });
  test('periodo posterior a 2026 no usa tasas sin revisión', () => {
    const s = fixture();
    expect(
      calculateWeek(
        s,
        { startMs: at('2026-12-28T00:00'), endMs: at('2026-12-28T00:00') + WEEK },
        at('2027-01-04T00:00'),
      ).grossCents,
    ).toBeNull();
  });
});
describe('acuerdo 4×10', () => {
  function four(durations: number[]) {
    const s = schedule(durations, 1600);
    s.employment[0].mode = 'four-ten';
    s.employment[0].agreementConfirmed = true;
    return s;
  }
  test('cuatro de diez pactadas', () => {
    const r = run(four([10, 10, 10, 10]));
    expect(r.extraMs).toBe(0);
    expect(r.grossCents).toBe(64000);
  });
  test('AO-2025-01: doce, diez, diez, diez', () => {
    const r = run(four([12, 10, 10, 10]));
    expect(r.extraMs).toBe(2 * HOUR);
    expect(r.grossCents).toBe(68800);
  });
  test.each([
    [12, 10, 8, 10],
    [10, 10],
    [10, 10, 10, 10, 4],
  ])('irregular %j se conserva pendiente', (...durations) => {
    const r = run(four(durations));
    expect(r.grossCents).toBeNull();
    expect(r.baseCents).not.toBeNull();
  });
  test('acuerdo sin confirmar no habilita excepción', () => {
    const s = four([10, 10, 10, 10]);
    s.employment[0].agreementConfirmed = false;
    expect(run(s).grossCents).toBeNull();
  });
});
describe('descansos, vigencias y cambios de horario', () => {
  test.each(['meal-on-duty', 'short-rest', 'unpaid-meal'] as const)('descanso %s', (kind) => {
    const s = schedule([8]);
    s.breaks.push({
      id: 'b',
      sessionId: 's0',
      startMs: at('2026-10-19T12:00'),
      endMs: at('2026-10-19T12:30'),
      kind,
      revision: 1,
      voidedAtMs: null,
    });
    const r = run(s);
    expect(r.activeMs).toBe(7.5 * HOUR);
    expect(r.paidMs).toBe((kind === 'unpaid-meal' ? 7.5 : 8) * HOUR);
    expect(r.grossCents).toBe(kind === 'unpaid-meal' ? 15000 : 16000);
  });
  test('tarifa cambia sin reescribir segmentos', () => {
    const s = schedule([8, 8]);
    s.rates.push({
      id: 'r2',
      effectiveFromMs: at('2026-10-20T00:00'),
      hourlyCents: 2200,
      overtimeHourlyCents: null,
    });
    expect(run(s).grossCents).toBe(33600);
  });
  test('tarifas mixtas con extra conserva base y advierte', () => {
    const s = schedule([9, 9, 9, 9, 9]);
    s.rates.push({
      id: 'r2',
      effectiveFromMs: at('2026-10-20T00:00'),
      hourlyCents: 2200,
      overtimeHourlyCents: null,
    });
    expect(run(s).grossCents).toBeNull();
    expect(run(s).baseCents).toBe(97200);
  });
  test('DST: una hora real en primavera y tres en otoño', () => {
    expect(at('2026-03-08T03:30') - at('2026-03-08T01:30')).toBe(HOUR);
    expect(at('2026-11-01T02:30') - at('2026-11-01T00:30')).toBe(3 * HOUR);
    expect(() => at('2026-03-08T02:30')).toThrow();
    expect(() => localInstant('2026-03-08T02:30', 'earlier')).toThrow();
    expect(() => at('2026-11-01T01:30')).toThrow();
    expect(
      localInstant('2026-11-01T01:30', 'later') - localInstant('2026-11-01T01:30', 'earlier'),
    ).toBe(HOUR);
  });
  test('semana fija de 168 horas cruza año y DST', () => {
    const s = fixture();
    const week = weekAt(at('2026-01-01T12:00'), s.employment[0]);
    expect(week.endMs - week.startMs).toBe(WEEK);
    expect(new Date(week.startMs).getUTCFullYear()).toBe(2025);
  });
  test('clasificación/cobertura pendiente no equivale a cero extra', () => {
    const s = schedule([9, 9, 9, 9, 9]);
    s.employment[0].coverageConfirmed = false;
    const r = run(s);
    expect(r.extraMs).toBeNull();
    expect(r.baseCents).toBe(90000);
  });
  test('redondea una vez con aritmética exacta', () => {
    const s = fixture(1830);
    shift(s, '2026-10-19', 1 / 60);
    shift(s, '2026-10-19', 1 / 60, '09:00');
    expect(run(s).grossCents).toBe(61);
    expect(rounded(61n, 2n)).toBe(31);
    expect(parseMoney('18.01')).toBe(1801);
    expect(() => parseMoney('18.001')).toThrow();
  });
});
describe('retenciones 2026 sin inferencias migratorias', () => {
  const payment: WeeklyPaymentRecord = {
    id: 'p',
    weekStartMs: MONDAY,
    payDate: '2026-10-23',
    ytdBeforeCents: 0,
    receivedNetCents: null,
  };
  test('SS, Medicare y federal configurable', () => {
    const s = fixture();
    const r = deductions(100000, s.payroll[0], payment);
    expect(r.socialSecurity).toBe(6200);
    expect(r.medicare).toBe(1450);
    expect(r.federal).toBe(10000);
    expect(r.state).toBe(0);
    expect(r.net).toBe(82350);
    s.payroll[0].federalBps = 1200;
    expect(deductions(100000, s.payroll[0], payment).net).toBe(80350);
  });
  test('límite SS: solo salario antes del tope', () => {
    expect(
      deductions(100000, fixture().payroll[0], { ...payment, ytdBeforeCents: 18_400_000 })
        .socialSecurity,
    ).toBe(3100);
    expect(
      deductions(100000, fixture().payroll[0], { ...payment, ytdBeforeCents: 18_450_000 })
        .socialSecurity,
    ).toBe(0);
  });
  test('Medicare adicional al cruzar USD 200000 del empleador', () => {
    const r = deductions(100000, fixture().payroll[0], { ...payment, ytdBeforeCents: 19_950_000 });
    expect(r.additionalMedicare).toBe(450);
    expect(r.medicare).toBe(1450);
  });
  test('no supone cero YTD ni exención por falta de SSN', () => {
    const s = fixture();
    expect(deductions(100000, s.payroll[0], { ...payment, ytdBeforeCents: null }).net).toBeNull();
    s.payroll[0].ficaConfirmed = false;
    expect(deductions(100000, s.payroll[0], payment).socialSecurity).toBeNull();
  });
  test('año desconocido o futuro bloquea tasas no verificadas', () => {
    expect(
      deductions(100000, fixture().payroll[0], { ...payment, payDate: '2027-01-02' }).net,
    ).toBeNull();
  });
  test('federal supuesto sin confirmar bloquea neto', () => {
    const s = fixture();
    s.payroll[0].federalConfirmed = false;
    expect(deductions(100000, s.payroll[0], payment).net).toBeNull();
  });
  test('otras deducciones sin eliminar aviso de neto negativo', () => {
    const s = fixture();
    s.payroll[0].otherWeeklyCents = 100000;
    const r = deductions(100000, s.payroll[0], payment);
    expect(r.net).toBe(-17650);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
describe('registro y respaldo validado', () => {
  test('inicio, descanso, fin conserva instantes y auditoría', () => {
    const s = fixture();
    startSession(s, MONDAY + 8 * HOUR);
    const id = s.sessions[0].id;
    startBreak(s, id, 'meal-on-duty', MONDAY + 12 * HOUR);
    finishSession(s, id, MONDAY + 16 * HOUR);
    validateState(s);
    expect(s.breaks[0].endMs).toBe(MONDAY + 16 * HOUR);
    expect(s.audit).toHaveLength(4);
  });
  test('solapamiento y duración cero rechazados, adyacentes válidos', () => {
    const s = schedule([4]);
    shift(s, '2026-10-19', 4, '12:00');
    validateState(s);
    s.sessions[1].startMs--;
    expect(() => validateState(s)).toThrow(/solapan/);
  });
  test('corrección y anulación conservan valores previos', () => {
    const s = schedule([8]);
    const before = { ...s.sessions[0] };
    saveSession(
      s,
      { ...before, endMs: before.startMs + 7.5 * HOUR },
      [],
      'Corrección de salida',
      END,
    );
    expect(run(s).grossCents).toBe(15000);
    expect(JSON.parse(s.audit[0].beforeJson!).endMs).toBe(before.endMs);
    voidSession(s, before.id, 'Duplicado', END);
    expect(run(s).paidMs).toBe(0);
  });
  test('respaldo roundtrip y CSV neutraliza fórmulas', () => {
    const s = schedule([8]);
    s.sessions[0].note = '=HYPERLINK("bad")';
    expect(parseBackup(backupJson(s))).toEqual(s);
    expect(csvWeek(s, run(s))).toContain("'=HYPERLINK");
  });
  test.each(['{broken', '{}', '{"format":"mi-jornada-backup","formatVersion":2}'])(
    'respaldo corrupto: %s',
    (text) => expect(() => parseBackup(text)).toThrow(),
  );
  test('datos externos con campo migratorio no autorizado son rechazados', () => {
    const s = fixture() as AppState & { immigrationStatus: string };
    s.immigrationStatus = 'irrelevant';
    expect(() => validateState(s)).toThrow(/campos/);
  });
  test('descanso huérfano o corto no pagado rechazado', () => {
    const s = schedule([8]);
    s.breaks.push({
      id: 'b',
      sessionId: 'missing',
      startMs: MONDAY,
      endMs: MONDAY + 60000,
      kind: 'short-rest',
      revision: 1,
      voidedAtMs: null,
    });
    expect(() => validateState(s)).toThrow();
  });
  test('duración negativa del reloj no se muestra como horas trabajadas', () => {
    expect(hours(-1000)).toBe('Revisar reloj');
  });
});
