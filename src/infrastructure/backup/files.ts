import { Capacitor } from '@capacitor/core';
import { upgradeState, validateState } from '../../domain/work/validate';
import { money } from '../../domain/money';
import type { AppState, WeekEstimate } from '../../shared/models';

export function backupJson(state: AppState): string {
  validateState(state);
  return JSON.stringify(
    { format: 'mi-jornada-backup', formatVersion: 2, exportedAt: new Date().toISOString(), state },
    null,
    2,
  );
}
export function parseBackup(text: string): AppState {
  if (new TextEncoder().encode(text).length > 10_000_000)
    throw new Error('El respaldo supera el límite de 10 MB.');
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no contiene un respaldo JSON válido.');
  }
  if (
    !data ||
    data.format !== 'mi-jornada-backup' ||
    ![1, 2].includes(data.formatVersion) ||
    Object.keys(data).sort().join(',') !== 'exportedAt,format,formatVersion,state'
  )
    throw new Error('Formato o versión de respaldo incompatible.');
  if (data.state?.schemaVersion !== data.formatVersion)
    throw new Error('La versión de los datos no coincide con la del respaldo.');
  return upgradeState(data.state);
}
const cell = (value: string | number | null) =>
  `"${String(value ?? '')
    .replace(/^\s*[=+@-]/, "'$&")
    .replaceAll('"', '""')}"`;
export function csvWeek(state: AppState, estimate: WeekEstimate): string {
  const rows = [
    [
      'jornada',
      'inicio_utc',
      'fin_utc',
      'zona',
      'nota',
      'pagado',
      'actividad',
      'horas',
      'tarifa_usd_h',
      'extra_diaria_candidata',
      'bruto_semanal_estimado',
      'regla',
      'advertencias',
    ]
      .map(cell)
      .join(','),
  ];
  for (const s of estimate.segments)
    rows.push(
      [
        s.sessionId,
        new Date(s.startMs).toISOString(),
        new Date(s.endMs).toISOString(),
        'America/Los_Angeles',
        state.sessions.find((x) => x.id === s.sessionId)?.note ?? '',
        s.paid ? 'sí' : 'no',
        s.active ? 'sí' : 'no',
        (s.endMs - s.startMs) / 3_600_000,
        s.hourlyCents === null ? 'Pendiente' : (s.hourlyCents / 100).toFixed(2),
        s.dailyOvertime ? 'sí' : 'no',
        money(estimate.grossCents),
        estimate.ruleVersion,
        estimate.warnings.join(' | '),
      ]
        .map(cell)
        .join(','),
    );
  return '\uFEFF' + rows.join('\r\n');
}
export async function saveFile(name: string, contents: string, mime: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const file = await Filesystem.writeFile({
      path: `exports/${name}`,
      data: contents,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    await Share.share({
      title: 'Mi Jornada',
      url: file.uri,
      dialogTitle: 'Guardar o compartir archivo',
    });
  } else {
    const url = URL.createObjectURL(new Blob([contents], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}
