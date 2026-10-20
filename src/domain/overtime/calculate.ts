import {
  atDate,
  DAY,
  HOUR,
  type AppState,
  type Interval,
  type PaySegment,
  type WeekEstimate,
} from '../../shared/models';
import { money, rounded } from '../money';
import { localInstant, weekday } from '../time';

export const RULE_VERSION = 'US-NV-2026-07-01.AO-2025-05-07.v1';
/** Ventanas consecutivas de 24 h desde trabajo real, sin reinicio por turno/calendario.
 * AO-2025-07, pp. 4–5; primas acreditadas: AO-2025-05, p. 3.
 * Tarifas mixtas con recargo e irregularidades 4x10 permanecen bloqueadas.
 */
export function calculateWeek(state: AppState, week: Interval, asOfMs: number): WeekEstimate {
  const settings = atDate(state.employment, week.startMs)!;
  const warnings: string[] = [];
  const segments: PaySegment[] = [];
  const activeSessions = state.sessions
    .filter((s) => s.voidedAtMs === null && s.startMs < Math.min(week.endMs, asOfMs))
    .sort((a, b) => a.startMs - b.startMs);
  const dailyLimit = settings.mode === 'four-ten' ? 10 * HOUR : 8 * HOUR;
  let windowStart = -Infinity,
    windowWorked = 0;
  // El historial completo mantiene el ancla incluso en cadenas de turnos diarios.
  for (const session of activeSessions) {
    const end = Math.min(session.endMs ?? asOfMs, asOfMs);
    if (end <= session.startMs) {
      warnings.push('Revisa el reloj del dispositivo o el inicio de la jornada.');
      continue;
    }
    const breaks = state.breaks.filter((b) => b.sessionId === session.id && b.voidedAtMs === null);
    const cuts = [
      ...new Set(
        [
          session.startMs,
          end,
          ...breaks.flatMap((b) => [b.startMs, b.endMs ?? asOfMs]),
          ...state.rates.map((r) => r.effectiveFromMs),
          week.startMs,
          week.endMs,
        ].filter((t) => t >= session.startMs && t <= end),
      ),
    ].sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      let start = cuts[i];
      const stop = cuts[i + 1];
      const pause = breaks.find((b) => b.startMs <= start && (b.endMs ?? asOfMs) > start);
      const paid = pause?.kind !== 'unpaid-meal';
      while (start < stop) {
        if (paid && start >= windowStart + DAY) {
          windowStart = start;
          windowWorked = 0;
        }
        let finish = paid ? Math.min(stop, windowStart + DAY) : stop;
        const rate = atDate(state.rates, start)?.hourlyCents ?? null;
        const dailyEligible = paid && rate !== null && rate < 1800;
        if (dailyEligible && windowWorked < dailyLimit)
          finish = Math.min(finish, start + dailyLimit - windowWorked);
        const overtime = dailyEligible && windowWorked >= dailyLimit;
        if (start >= week.startMs && start < week.endMs)
          segments.push({
            startMs: start,
            endMs: finish,
            sessionId: session.id,
            breakId: pause?.id ?? null,
            hourlyCents: rate,
            paid,
            active: !pause,
            dailyOvertime: overtime,
            workdayStartMs: Number.isFinite(windowStart) ? windowStart : start,
          });
        if (paid) windowWorked += finish - start;
        start = finish;
      }
    }
  }
  const presenceMs = segments.reduce((n, s) => n + s.endMs - s.startMs, 0);
  const paidSegments = segments.filter((s) => s.paid);
  const paidMs = paidSegments.reduce((n, s) => n + s.endMs - s.startMs, 0);
  const activeMs = segments.filter((s) => s.active).reduce((n, s) => n + s.endMs - s.startMs, 0);
  const dailyExtraMs = paidSegments
    .filter((s) => s.dailyOvertime)
    .reduce((n, s) => n + s.endMs - s.startMs, 0);
  const weeklyExtraMs = Math.max(0, paidMs - 40 * HOUR);
  const baseNumerator = paidSegments.reduce(
    (n, s) => n + BigInt(s.hourlyCents ?? 0) * BigInt(s.endMs - s.startMs),
    0n,
  );
  const missingRate = paidSegments.some((s) => s.hourlyCents === null);
  let blocked = false;
  function block(message: string) {
    warnings.push(message);
    blocked = true;
  }
  if (!settings.weekConfirmed)
    block('Confirma en Configuración cuándo empieza tu semana de trabajo.');
  if (!settings.coverageConfirmed)
    block(
      'Falta confirmar en Configuración las reglas de horas extra que corresponden a tu trabajo.',
    );
  if (missingRate) block('Falta una tarifa vigente para parte de esta semana.');
  if (week.startMs < localInstant('2026-07-01T00:00'))
    block(
      'Esta semana queda fuera de la vigencia de las reglas verificadas (desde julio de 2026).',
    );
  if (week.endMs > localInstant('2027-01-01T00:00'))
    block(
      'La semana incluye fechas posteriores a las reglas verificadas para 2026. Se necesita actualizar su validación.',
    );
  if (paidSegments.some((s) => s.hourlyCents !== null && s.hourlyCents < 1200))
    warnings.push(
      'La tarifa registrada es inferior a la referencia general de salario mínimo de Nevada. Verifica tu caso; no se cambia la tarifa automáticamente.',
    );
  if (
    state.employment.some((s) => s.effectiveFromMs > week.startMs && s.effectiveFromMs < week.endMs)
  )
    block(
      'Hay un cambio de condiciones dentro de la semana. Revisa la vigencia antes de estimar el recargo.',
    );
  const relevant = activeSessions.filter(
    (s) => s.startMs < week.endMs && (s.endMs ?? asOfMs) > week.startMs,
  );
  if (settings.mode === 'four-ten') {
    const uniqueDays = new Set(relevant.map((s) => weekday(s.startMs)));
    const durations = relevant.map((s) =>
      paidSegments.filter((p) => p.sessionId === s.id).reduce((n, p) => n + p.endMs - p.startMs, 0),
    );
    const valid =
      settings.agreementConfirmed &&
      relevant.length === 4 &&
      uniqueDays.size === 4 &&
      relevant.every(
        (s) =>
          s.endMs !== null &&
          s.startMs >= week.startMs &&
          s.endMs <= week.endMs &&
          settings.scheduledDays.includes(weekday(s.startMs)),
      ) &&
      durations.every((d) => d >= 10 * HOUR) &&
      durations.filter((d) => d > 10 * HOUR).length <= 1;
    if (!valid)
      block(
        '4×10: falta confirmar el acuerdo o completar cuatro jornadas pactadas. Los cambios e irregularidades requieren revisión; el importe base sigue disponible.',
      );
  }
  const rates = new Set(paidSegments.map((s) => s.hourlyCents));
  const overtimeRates = new Set(
    paidSegments.map((s) => atDate(state.rates, s.startMs)?.overtimeHourlyCents ?? null),
  );
  if (rates.size > 1 && (dailyExtraMs > 0 || weeklyExtraMs > 0))
    block(
      'Hay varias tarifas con horas extra. El importe base está calculado; la tarifa regular del recargo requiere revisión.',
    );
  if (overtimeRates.size > 1 && (dailyExtraMs > 0 || weeklyExtraMs > 0))
    block(
      'La tarifa indicada para horas extra cambió dentro de la semana. Revisa la vigencia; el total queda pendiente para no aplicar una cantidad incorrecta.',
    );
  if (
    paidSegments.some((s) => s.workdayStartMs < week.startMs) &&
    state.employment.some(
      (s) =>
        s.effectiveFromMs === week.startMs &&
        atDate(state.employment, week.startMs - 1)?.mode !== s.mode,
    )
  )
    block(
      'La modalidad cambió dentro de un día laboral que cruza semanas. El recargo requiere revisión.',
    );
  if (
    dailyExtraMs > 0 &&
    paidSegments.some(
      (s) =>
        s.workdayStartMs < week.startMs &&
        state.rates.some(
          (r) =>
            r.effectiveFromMs >= s.workdayStartMs &&
            r.effectiveFromMs <= week.startMs &&
            r.hourlyCents !== atDate(state.rates, s.workdayStartMs)?.hourlyCents,
        ),
    )
  )
    block(
      'El día laboral cruza un cambio de tarifa y el límite semanal. Revisa el recargo antes de usar el total.',
    );
  // Solo tarifa uniforme y perfil validado: comparar primas, no unir horas candidatas.
  const rate = BigInt(paidSegments[0]?.hourlyCents ?? 0);
  const dailyPremiumNumerator = rate * BigInt(dailyExtraMs);
  const weeklyPremiumNumerator = rate * BigInt(weeklyExtraMs);
  const credit =
    dailyPremiumNumerator < weeklyPremiumNumerator ? dailyPremiumNumerator : weeklyPremiumNumerator;
  const premiumNumerator = dailyPremiumNumerator + weeklyPremiumNumerator - credit;
  const selectedMs = dailyPremiumNumerator >= weeklyPremiumNumerator ? dailyExtraMs : weeklyExtraMs;
  const baseCents = missingRate ? null : rounded(baseNumerator, BigInt(HOUR));
  const referenceGrossCents = blocked
    ? null
    : rounded(2n * baseNumerator + premiumNumerator, 2n * BigInt(HOUR));
  const overtimeHourlyCents = overtimeRates.size === 1 ? [...overtimeRates][0] : null;
  const grossCents = blocked
    ? null
    : overtimeHourlyCents === null
      ? referenceGrossCents
      : rounded(
          baseNumerator + (BigInt(overtimeHourlyCents) - rate) * BigInt(selectedMs),
          BigInt(HOUR),
        );
  if (
    overtimeHourlyCents !== null &&
    selectedMs > 0 &&
    !blocked &&
    2n * BigInt(overtimeHourlyCents) < 3n * rate
  )
    warnings.push(
      `La tarifa extra que indicaste (${money(overtimeHourlyCents)}/h) es menor que una vez y media tu tarifa normal. El total muestra ese pago indicado; la referencia de las reglas generales es ${money(referenceGrossCents)} antes de descuentos. Revisa la diferencia con tu empleador.`,
    );
  const provisional = relevant.some((s) => s.endMs === null) || asOfMs < week.endMs;
  if (provisional)
    warnings.push('Semana en curso: la estimación cambia al agregar o corregir jornadas.');
  return {
    week,
    paidMs,
    activeMs,
    presenceMs,
    dailyExtraMs,
    weeklyExtraMs,
    ordinaryMs: blocked ? null : paidMs - selectedMs,
    extraMs: blocked ? null : selectedMs,
    baseCents,
    premiumCents: grossCents === null || baseCents === null ? null : grossCents - baseCents,
    grossCents,
    referenceGrossCents,
    overtimeHourlyCents,
    baseExact: { numerator: baseNumerator.toString(), denominator: HOUR.toString() },
    segments,
    warnings: [...new Set(warnings)],
    provisional,
    ruleVersion: RULE_VERSION,
    explanation: [
      'Comida con obligaciones y descansos cortos: pagados y computables. Solo la comida libre no pagada se descuenta.',
      'Día laboral: ventanas consecutivas de 24 horas desde el inicio de trabajo; no se reinicia a medianoche.',
      `Se comparan la prima diaria y la semanal; se acredita la menor sin duplicar el recargo (AO-2025-05).`,
      'Importes racionales en centavos; el bruto se redondea una sola vez al centavo, mitades hacia arriba.',
      ...(overtimeHourlyCents === null
        ? []
        : [
            'El pago estimado usa la tarifa total por hora extra indicada por el usuario. La referencia de las reglas generales conserva el recargo de una vez y media; no se modifica por registrar otro pago.',
          ]),
    ],
  };
}
