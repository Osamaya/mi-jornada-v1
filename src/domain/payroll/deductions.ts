import type { Deductions, PayrollSettings, WeeklyPaymentRecord } from '../../shared/models';
import { percentOf } from '../money';
export const TAX_2026 = {
  socialSecurityBps: 620,
  medicareBps: 145,
  additionalMedicareBps: 90,
  wageBaseCents: 18_450_000,
  additionalThresholdCents: 20_000_000,
} as const;
/** Estima retenciones sobre salario sujeto a FICA, no la declaración anual. */
export function deductions(
  gross: number | null,
  settings: PayrollSettings,
  payment?: WeeklyPaymentRecord,
): Deductions {
  const warnings: string[] = [];
  let socialSecurity: number | null = null,
    medicare: number | null = null,
    additionalMedicare: number | null = null;
  const federal =
    gross !== null && settings.federalConfirmed ? percentOf(gross, settings.federalBps) : null;
  if (!settings.federalConfirmed)
    warnings.push(
      'La retención federal inicial de 10 % es un supuesto. Configúrala o calíbrala con tu recibo.',
    );
  const year = payment?.payDate?.slice(0, 4);
  if (!payment?.payDate)
    warnings.push('Indica la fecha prevista de pago para elegir el año fiscal.');
  else if (year !== '2026')
    warnings.push('Solo están verificadas las tasas y el límite fiscal de 2026.');
  if (!settings.ficaConfirmed)
    warnings.push(
      'Confirma la aplicación de Social Security y Medicare en tu nómina. No se determina por estatus migratorio.',
    );
  if (payment?.ytdBeforeCents === null || payment?.ytdBeforeCents === undefined)
    warnings.push(
      'Falta el salario acumulado de este empleador antes de este pago, según recibo. No se supone cero.',
    );
  if (gross !== null && settings.ficaConfirmed && year === '2026') {
    medicare = percentOf(gross, TAX_2026.medicareBps);
    if (payment?.ytdBeforeCents !== null && payment?.ytdBeforeCents !== undefined) {
      const prior = payment.ytdBeforeCents;
      socialSecurity = percentOf(
        Math.min(gross, Math.max(0, TAX_2026.wageBaseCents - prior)),
        TAX_2026.socialSecurityBps,
      );
      const additionalBase =
        Math.max(0, prior + gross - TAX_2026.additionalThresholdCents) -
        Math.max(0, prior - TAX_2026.additionalThresholdCents);
      additionalMedicare = percentOf(additionalBase, TAX_2026.additionalMedicareBps);
    }
  }
  const other = settings.otherWeeklyCents;
  const parts = [socialSecurity, medicare, additionalMedicare, federal];
  const net =
    gross === null || parts.some((v) => v === null)
      ? null
      : gross - parts.reduce<number>((n, p) => n + p!, 0) - other;
  if (net !== null && net < 0)
    warnings.push('Las deducciones superan el bruto. Revisa los montos ingresados.');
  return { socialSecurity, medicare, additionalMedicare, federal, state: 0, other, net, warnings };
}
