export function parseMoney(value: string): number {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value.trim()))
    throw new Error('Escribe un monto positivo con hasta dos decimales.');
  const [whole, fraction = ''] = value.trim().split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export function parsePercent(value: string): number {
  const bps = parseMoney(value);
  if (bps > 10000) throw new Error('El porcentaje debe estar entre 0 y 100.');
  return bps;
}
/** Redondeo mitad arriba para cantidades no negativas. */
export function rounded(numerator: bigint, denominator: bigint): number {
  if (numerator < 0n || denominator <= 0n) throw new Error('Importe inválido.');
  const value = (2n * numerator + denominator) / (2n * denominator);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Importe fuera del límite.');
  return Number(value);
}
export const percentOf = (cents: number, bps: number) =>
  rounded(BigInt(cents) * BigInt(bps), 10000n);
export const money = (cents: number | null) =>
  cents === null
    ? 'Pendiente'
    : new Intl.NumberFormat('es-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
export const hours = (ms: number | null) =>
  ms === null
    ? 'Pendiente'
    : ms < 0
      ? 'Revisar reloj'
      : `${Math.floor(ms / 3_600_000)} h ${Math.floor((ms % 3_600_000) / 60_000)
          .toString()
          .padStart(2, '0')} min`;
