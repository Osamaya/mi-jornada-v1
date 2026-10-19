import { ZONE, type AppState } from '../../shared/models';

function fail(message: string): never {
  throw new Error(message);
}
function obj(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('El respaldo contiene un objeto inválido.');
  const names = Object.keys(value);
  if (names.some((k) => !keys.includes(k)) || keys.some((k) => !names.includes(k)))
    fail('El respaldo contiene campos incompatibles.');
}
function integer(v: unknown, min = 0, max = 4_102_444_800_000): asserts v is number {
  if (!Number.isSafeInteger(v) || (v as number) < min || (v as number) > max)
    fail('Número o fecha fuera de los límites.');
}
function text(v: unknown, max = 2000): asserts v is string {
  if (typeof v !== 'string' || v.length > max) fail('Texto inválido o demasiado largo.');
}
function bool(v: unknown): asserts v is boolean {
  if (typeof v !== 'boolean') fail('Valor de confirmación inválido.');
}
function choice(v: unknown, values: unknown[]) {
  if (!values.includes(v)) fail('Una opción del respaldo no es válida.');
}
function unique(items: { id: string }[]) {
  const seen = new Set<string>();
  for (const item of items) {
    text(item.id, 100);
    if (!item.id || seen.has(item.id)) fail('Hay identificadores vacíos o duplicados.');
    seen.add(item.id);
  }
}
function effective(items: { effectiveFromMs: number }[]) {
  const seen = new Set<number>();
  for (const item of items) {
    integer(item.effectiveFromMs);
    if (seen.has(item.effectiveFromMs)) fail('Hay vigencias duplicadas.');
    seen.add(item.effectiveFromMs);
  }
}
/** Se usa tanto en cada transacción como antes de restaurar datos externos. */
export function validateState(value: unknown): asserts value is AppState {
  obj(value, [
    'schemaVersion',
    'revision',
    'employment',
    'payroll',
    'rates',
    'sessions',
    'breaks',
    'payments',
    'audit',
  ]);
  choice(value.schemaVersion, [1]);
  integer(value.revision, 1, Number.MAX_SAFE_INTEGER);
  for (const key of ['employment', 'payroll', 'rates', 'sessions', 'breaks', 'payments', 'audit']) {
    if (!Array.isArray(value[key]) || value[key].length > 50000)
      fail('Lista ausente o fuera del límite de 50 000 registros.');
  }
  const state = value as unknown as AppState;
  for (const collection of [
    state.employment,
    state.payroll,
    state.rates,
    state.sessions,
    state.breaks,
    state.payments,
    state.audit,
  ])
    unique(collection);
  if (!state.employment.length || !state.payroll.length) fail('Falta configuración inicial.');
  for (const s of state.employment) {
    obj(s, [
      'id',
      'effectiveFromMs',
      'zone',
      'weekAnchorMs',
      'weekConfirmed',
      'coverageConfirmed',
      'mode',
      'agreementConfirmed',
      'scheduledDays',
    ]);
    integer(s.effectiveFromMs);
    integer(s.weekAnchorMs);
    choice(s.zone, [ZONE]);
    bool(s.weekConfirmed);
    bool(s.coverageConfirmed);
    bool(s.agreementConfirmed);
    choice(s.mode, ['standard', 'four-ten']);
    if (
      !Array.isArray(s.scheduledDays) ||
      s.scheduledDays.length !== 4 ||
      new Set(s.scheduledDays).size !== 4
    )
      fail('Selecciona cuatro días distintos para el acuerdo 4×10.');
    s.scheduledDays.forEach((d) => integer(d, 1, 7));
  }
  for (const s of state.payroll) {
    obj(s, [
      'id',
      'effectiveFromMs',
      'ficaConfirmed',
      'federalBps',
      'federalConfirmed',
      'otherWeeklyCents',
    ]);
    integer(s.effectiveFromMs);
    bool(s.ficaConfirmed);
    bool(s.federalConfirmed);
    integer(s.federalBps, 0, 10000);
    integer(s.otherWeeklyCents, 0, 99_999_999_999);
  }
  effective(state.employment);
  effective(state.payroll);
  effective(state.rates);
  if (
    Math.min(...state.employment.map((s) => s.effectiveFromMs)) !== 0 ||
    Math.min(...state.payroll.map((s) => s.effectiveFromMs)) !== 0
  )
    fail('Falta la versión inicial de configuración.');
  for (const r of state.rates) {
    obj(r, ['id', 'effectiveFromMs', 'hourlyCents']);
    integer(r.effectiveFromMs);
    integer(r.hourlyCents, 1, 10_000_000);
  }
  for (const s of state.sessions) {
    obj(s, ['id', 'startMs', 'endMs', 'zone', 'source', 'note', 'revision', 'voidedAtMs']);
    integer(s.startMs);
    if (s.endMs !== null) {
      integer(s.endMs);
      if (s.endMs <= s.startMs) fail('La salida debe ser posterior a la entrada.');
    }
    if (s.voidedAtMs !== null) integer(s.voidedAtMs);
    choice(s.zone, [ZONE]);
    choice(s.source, ['clock', 'manual']);
    text(s.note);
    integer(s.revision, 1);
  }
  const sessions = state.sessions
    .filter((s) => s.voidedAtMs === null)
    .sort((a, b) => a.startMs - b.startMs);
  for (let i = 1; i < sessions.length; i++)
    if (sessions[i].startMs < (sessions[i - 1].endMs ?? Infinity))
      fail('Las jornadas se solapan. Revisa entrada y salida.');
  for (const b of state.breaks) {
    obj(b, ['id', 'sessionId', 'startMs', 'endMs', 'kind', 'revision', 'voidedAtMs']);
    text(b.sessionId, 100);
    integer(b.startMs);
    integer(b.revision, 1);
    if (b.voidedAtMs !== null) integer(b.voidedAtMs);
    choice(b.kind, ['meal-on-duty', 'short-rest', 'unpaid-meal']);
    if (b.endMs !== null) {
      integer(b.endMs);
      if (b.endMs <= b.startMs) fail('El descanso debe tener duración positiva.');
    }
    const s = state.sessions.find((s) => s.id === b.sessionId);
    if (!s) fail('El descanso no tiene una jornada válida.');
    if (b.voidedAtMs === null) {
      if (
        s.voidedAtMs !== null ||
        b.startMs < s.startMs ||
        (b.endMs ?? Infinity) > (s.endMs ?? Infinity)
      )
        fail('El descanso debe quedar dentro de su jornada.');
      if (b.kind === 'unpaid-meal' && b.endMs !== null && b.endMs - b.startMs < 30 * 60000)
        fail(
          'Una comida libre no pagada debe durar al menos 30 minutos. Corrige el tipo si fue un descanso corto.',
        );
    }
  }
  for (const s of sessions) {
    const breaks = state.breaks
      .filter((b) => b.sessionId === s.id && b.voidedAtMs === null)
      .sort((a, b) => a.startMs - b.startMs);
    for (let i = 1; i < breaks.length; i++)
      if (breaks[i].startMs < (breaks[i - 1].endMs ?? Infinity)) fail('Los descansos se solapan.');
  }
  const weeks = new Set<number>();
  for (const p of state.payments) {
    obj(p, ['id', 'weekStartMs', 'payDate', 'ytdBeforeCents', 'receivedNetCents']);
    integer(p.weekStartMs);
    if (weeks.has(p.weekStartMs)) fail('Hay pagos duplicados para una semana.');
    weeks.add(p.weekStartMs);
    if (p.payDate !== null) {
      text(p.payDate, 10);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(p.payDate) ||
        new Date(p.payDate + 'T12:00:00Z').toISOString().slice(0, 10) !== p.payDate
      )
        fail('La fecha de pago no es válida.');
    }
    for (const amount of [p.ytdBeforeCents, p.receivedNetCents])
      if (amount !== null) integer(amount, 0, 99_999_999_999);
  }
  for (const a of state.audit) {
    obj(a, ['id', 'atMs', 'action', 'entityId', 'reason', 'beforeJson', 'afterJson']);
    integer(a.atMs);
    text(a.action, 100);
    text(a.entityId, 100);
    text(a.reason);
    for (const json of [a.beforeJson, a.afterJson])
      if (json !== null) {
        text(json, 2_000_000);
        try {
          JSON.parse(json);
        } catch {
          fail('Historial de correcciones inválido.');
        }
      }
  }
}
