import { Temporal } from '@js-temporal/polyfill';
import { WEEK, ZONE, type EmploymentSettings, type Interval } from '../shared/models';
export function localInstant(
  value: string,
  disambiguation: 'reject' | 'earlier' | 'later' = 'reject',
): number {
  try {
    const plain = Temporal.PlainDateTime.from(value);
    const zoned = plain.toZonedDateTime(ZONE, { disambiguation });
    if (!zoned.toPlainDateTime().equals(plain)) throw new Error('Hora inexistente');
    return zoned.epochMilliseconds;
  } catch {
    throw new Error(
      'La fecha no existe o es ambigua por el cambio de horario. Elige la primera o segunda ocurrencia si corresponde.',
    );
  }
}
export function localInput(ms: number): string {
  return Temporal.Instant.fromEpochMilliseconds(ms)
    .toZonedDateTimeISO(ZONE)
    .toPlainDateTime()
    .toString({ smallestUnit: 'minute' });
}
export function dateInput(ms: number): string {
  return localInput(ms).slice(0, 10);
}
export function mondayDate(ms: number): string {
  const local = Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(ZONE);
  return local
    .toPlainDate()
    .subtract({ days: local.dayOfWeek - 1 })
    .toString();
}
export function weekAt(ms: number, settings: EmploymentSettings): Interval {
  const startMs = settings.weekAnchorMs + Math.floor((ms - settings.weekAnchorMs) / WEEK) * WEEK;
  return { startMs, endMs: startMs + WEEK };
}
export function weekday(ms: number): number {
  return Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(ZONE).dayOfWeek;
}
export function formatDate(ms: number, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: ZONE,
    day: 'numeric',
    month: 'short',
    ...options,
  }).format(ms);
}
export function labelWeek(week: Interval): string {
  return `${formatDate(week.startMs)} — ${formatDate(week.endMs - 1, { year: 'numeric' })}`;
}
