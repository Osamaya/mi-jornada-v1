import { ZONE, type AppState, type WorkSession, type BreakPeriod } from '../shared/models';
export const uid = () => crypto.randomUUID();
export function audit(
  state: AppState,
  action: string,
  entityId: string,
  before: unknown,
  after: unknown,
  reason: string,
  atMs = Date.now(),
) {
  if (!reason.trim()) throw new Error('Escribe un motivo para la corrección.');
  state.audit.push({
    id: uid(),
    atMs,
    action,
    entityId,
    reason: reason.trim(),
    beforeJson: before == null ? null : JSON.stringify(before),
    afterJson: after == null ? null : JSON.stringify(after),
  });
}
export function startSession(state: AppState, now: number) {
  if (state.sessions.some((s) => s.voidedAtMs === null && s.endMs === null))
    throw new Error('Ya hay una jornada abierta.');
  const session: WorkSession = {
    id: uid(),
    startMs: now,
    endMs: null,
    zone: ZONE,
    source: 'clock',
    note: '',
    revision: 1,
    voidedAtMs: null,
  };
  state.sessions.push(session);
  audit(state, 'start', session.id, null, session, 'Inicio de jornada', now);
}
export function finishSession(state: AppState, id: string, now: number) {
  const s = state.sessions.find((s) => s.id === id && s.voidedAtMs === null && s.endMs === null);
  if (!s) throw new Error('La jornada ya cambió. Actualiza la vista.');
  const before = { ...s };
  s.endMs = now;
  s.revision++;
  for (const b of state.breaks.filter(
    (b) => b.sessionId === id && b.voidedAtMs === null && b.endMs === null,
  )) {
    const old = { ...b };
    b.endMs = now;
    b.revision++;
    audit(state, 'finish-break', b.id, old, b, 'Descanso finalizado junto a jornada', now);
  }
  audit(state, 'finish', s.id, before, s, 'Fin de jornada', now);
}
export function startBreak(
  state: AppState,
  sessionId: string,
  kind: BreakPeriod['kind'],
  now: number,
) {
  if (!state.sessions.some((s) => s.id === sessionId && s.endMs === null && s.voidedAtMs === null))
    throw new Error('Primero inicia una jornada.');
  if (
    state.breaks.some((b) => b.sessionId === sessionId && b.endMs === null && b.voidedAtMs === null)
  )
    throw new Error('Ya hay un descanso abierto.');
  const b: BreakPeriod = {
    id: uid(),
    sessionId,
    startMs: now,
    endMs: null,
    kind,
    revision: 1,
    voidedAtMs: null,
  };
  state.breaks.push(b);
  audit(state, 'start-break', b.id, null, b, 'Inicio de descanso', now);
}
export function finishBreak(state: AppState, id: string, now: number) {
  const b = state.breaks.find((b) => b.id === id && b.endMs === null && b.voidedAtMs === null);
  if (!b) throw new Error('El descanso ya cambió.');
  const old = { ...b };
  b.endMs = now;
  b.revision++;
  audit(state, 'finish-break', b.id, old, b, 'Fin de descanso', now);
}
export function saveSession(
  state: AppState,
  session: WorkSession,
  breaks: BreakPeriod[],
  reason: string,
  now: number,
) {
  if (session.startMs > now || (session.endMs !== null && session.endMs > now))
    throw new Error('No se pueden registrar jornadas futuras.');
  const old = state.sessions.find((s) => s.id === session.id);
  if (old && old.revision !== session.revision)
    throw new Error('La jornada cambió mientras la editabas. Vuelve a abrirla.');
  const next = { ...session, revision: (old?.revision ?? 0) + 1 };
  state.sessions = [...state.sessions.filter((s) => s.id !== session.id), next];
  const previousBreaks = state.breaks.filter(
    (b) => b.sessionId === session.id && b.voidedAtMs === null,
  );
  for (const b of previousBreaks)
    if (!breaks.some((n) => n.id === b.id)) {
      const before = { ...b };
      b.voidedAtMs = now;
      b.revision++;
      audit(state, 'void-break', b.id, before, b, reason, now);
    }
  for (const b of breaks) {
    const before = state.breaks.find((p) => p.id === b.id);
    const after = { ...b, sessionId: session.id, revision: (before?.revision ?? 0) + 1 };
    state.breaks = [...state.breaks.filter((p) => p.id !== b.id), after];
    audit(state, 'save-break', b.id, before, after, reason, now);
  }
  audit(state, old ? 'correct' : 'manual', session.id, old, next, reason, now);
}
export function voidSession(state: AppState, id: string, reason: string, now: number) {
  const s = state.sessions.find((s) => s.id === id && s.voidedAtMs === null);
  if (!s) throw new Error('No se encontró la jornada.');
  const old = { ...s };
  s.voidedAtMs = now;
  s.revision++;
  for (const b of state.breaks.filter((b) => b.sessionId === id && b.voidedAtMs === null)) {
    const before = { ...b };
    b.voidedAtMs = now;
    b.revision++;
    audit(state, 'void-break', b.id, before, b, reason, now);
  }
  audit(state, 'void', id, old, s, reason, now);
}
