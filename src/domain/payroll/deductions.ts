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
      'Revisa el porcentaje de impuesto federal en Configuración. El 10 % inicial es solo un ejemplo.',
    );
  const year = payment?.payDate?.slice(0, 4);
  if (!payment?.payDate)
    warnings.push('Escribe qué día te pagan para usar las reglas del año correcto.');
  else if (year !== '2026')
    warnings.push('Solo están verificadas las tasas y el límite fiscal de 2026.');
  if (!settings.ficaConfirmed)
    warnings.push('Falta confirmar los descuentos de Seguro Social y Medicare en Configuración.');
  if (payment?.ytdBeforeCents === null || payment?.ytdBeforeCents === undefined)
    warnings.push(
      'Falta el acumulado del recibo anterior de esta empresa. Puedes dejarlo pendiente si no lo conoces.',
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
