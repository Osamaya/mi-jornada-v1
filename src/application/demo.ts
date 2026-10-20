import { initialState } from './defaults';
import { localInstant } from '../domain/time';
import { validateState } from '../domain/work/validate';
import { WEEK, ZONE, type AppState } from '../shared/models';

export const DEMO_WEEK_START = localInstant('2026-10-12T00:00');
export const DEMO_WEEK = { startMs: DEMO_WEEK_START, endMs: DEMO_WEEK_START + WEEK };

/** Datos ficticios de solo lectura. Nunca se escriben en el repositorio personal. */
export function demoWeek(): AppState {
  const state = initialState();
  state.profile.displayName = 'José · ejemplo';
  state.employment = [
    {
      ...state.employment[0],
      weekAnchorMs: DEMO_WEEK_START,
      weekConfirmed: true,
      coverageConfirmed: true,
    },
  ];
  state.payroll = [
    {
      ...state.payroll[0],
      ficaConfirmed: true,
      federalConfirmed: true,
      federalBps: 1000,
      otherWeeklyCents: 1500,
    },
  ];
  state.rates = [
    { id: 'demo-rate', effectiveFromMs: 0, hourlyCents: 2000, overtimeHourlyCents: null },
  ];
  for (let day = 12; day <= 16; day++) {
    const date = `2026-10-${day}`;
    const id = `demo-session-${day}`;
    state.sessions.push({
      id,
      startMs: localInstant(date + 'T08:00'),
      endMs: localInstant(date + 'T17:30'),
      zone: ZONE,
      source: 'manual',
      note: 'Jornada ficticia para mostrar el desglose. No es un registro personal.',
      revision: 1,
      voidedAtMs: null,
    });
    state.breaks.push({
      id: `demo-meal-${day}`,
      sessionId: id,
      startMs: localInstant(date + 'T12:00'),
      endMs: localInstant(date + 'T12:30'),
      kind: 'unpaid-meal',
      revision: 1,
      voidedAtMs: null,
    });
  }
  state.payments = [
    {
      id: 'demo-payment',
      weekStartMs: DEMO_WEEK_START,
      payDate: '2026-10-23',
      ytdBeforeCents: 1_000_000,
      receivedNetCents: null,
    },
  ];
  validateState(state);
  return state;
}
