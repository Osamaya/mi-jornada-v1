import { ZONE, type AppState } from '../shared/models';
import { localInstant, mondayDate } from '../domain/time';
export function initialState(): AppState {
  return {
    schemaVersion: 1,
    revision: 1,
    employment: [
      {
        id: 'employment-initial',
        effectiveFromMs: 0,
        zone: ZONE,
        weekAnchorMs: localInstant(mondayDate(Date.now()) + 'T00:00'),
        weekConfirmed: false,
        coverageConfirmed: false,
        mode: 'standard',
        agreementConfirmed: false,
        scheduledDays: [1, 2, 3, 4],
      },
    ],
    payroll: [
      {
        id: 'payroll-initial',
        effectiveFromMs: 0,
        ficaConfirmed: false,
        federalBps: 1000,
        federalConfirmed: false,
        otherWeeklyCents: 0,
      },
    ],
    rates: [],
    sessions: [],
    breaks: [],
    payments: [],
    audit: [],
  };
}
