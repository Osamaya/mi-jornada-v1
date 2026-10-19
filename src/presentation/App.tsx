import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Coffee,
  History,
  House,
  LockKeyhole,
  Pencil,
  Play,
  Plus,
  ReceiptText,
  Settings2,
  Square,
  Trash2,
  Check,
  RefreshCw,
} from 'lucide-react';
import { Repository } from '../infrastructure/database/repository';
import { openDriver } from '../infrastructure/database/driver';
import { backupJson, saveFile } from '../infrastructure/backup/files';
import { atDate, type AppState, type WorkSession } from '../shared/models';
import { dateInput, formatDate, labelWeek, weekAt } from '../domain/time';
import { hours, money } from '../domain/money';
import { calculateWeek } from '../domain/overtime/calculate';
import { deductions } from '../domain/payroll/deductions';
import {
  finishBreak,
  finishSession,
  saveSession,
  startBreak,
  startSession,
  voidSession,
} from '../application/commands';
import { SessionEditor } from './components/SessionEditor';
import { Settings } from './pages/Settings';
import { Summary } from './pages/Summary';

let repositoryPromise: Promise<Repository> | undefined;
function openRepository() {
  return (repositoryPromise ??= openDriver().then((d) => new Repository(d)));
}
type Page = 'home' | 'history' | 'summary' | 'settings';
const navigation = [
  { id: 'home', name: 'Inicio', icon: House },
  { id: 'history', name: 'Historial', icon: History },
  { id: 'summary', name: 'Resumen', icon: ReceiptText },
  { id: 'settings', name: 'Configuración', icon: Settings2 },
] as const;

export default function App() {
  const [state, setState] = useState<AppState | null>(null),
    [page, setPage] = useState<Page>('home'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(Date.now()),
    [viewMs, setViewMs] = useState(Date.now());
  const [editor, setEditor] = useState<{ session: WorkSession | null } | null>(null),
    [breakKind, setBreakKind] = useState<'meal-on-duty' | 'short-rest' | 'unpaid-meal'>(
      'meal-on-duty',
    );
  async function refresh() {
    try {
      setState(await (await openRepository()).load());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir la base local.');
    }
  }
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', focus);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function update(mutate: (s: AppState) => void): Promise<boolean> {
    if (!state || busy) return false;
    setBusy(true);
    setError('');
    try {
      const next = await (await openRepository()).update(state.revision, mutate);
      setState(next);
      setNotice('Guardado en este dispositivo');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  const currentSettings = state ? atDate(state.employment, now)! : null;
  const currentWeek = currentSettings ? weekAt(now, currentSettings) : null;
  const selectedWeek = state ? weekAt(viewMs, atDate(state.employment, viewMs)!) : null;
  const currentEstimate = useMemo(
    () => (state && currentWeek ? calculateWeek(state, currentWeek, now) : null),
    [state, now, currentWeek?.startMs],
  );
  const estimate = useMemo(
    () => (state && selectedWeek ? calculateWeek(state, selectedWeek, now) : null),
    [state, now, selectedWeek?.startMs],
  );
  if (!state || !currentEstimate || !estimate || !currentWeek)
    return (
      <main className="loading">
        <div className="brand-mark">MJ</div>
        <h1>Mi Jornada</h1>
        <p>{error || 'Preparando tus registros locales…'}</p>
        {error && (
          <button
            className="primary"
            onClick={() => {
              repositoryPromise = undefined;
              void refresh();
            }}
          >
            Volver a intentar
          </button>
        )}
      </main>
    );
  const active = state.sessions.find((s) => s.voidedAtMs === null && s.endMs === null),
    pause = active
      ? state.breaks.find(
          (b) => b.sessionId === active.id && b.endMs === null && b.voidedAtMs === null,
        )
      : null;
  const currentTaxes = deductions(
    currentEstimate.grossCents,
    atDate(state.payroll, currentWeek.startMs)!,
    state.payments.find((p) => p.weekStartMs === currentWeek.startMs),
  );
  const taxes = deductions(
    estimate.grossCents,
    atDate(state.payroll, estimate.week.startMs)!,
    state.payments.find((p) => p.weekStartMs === estimate.week.startMs),
  );
  const duration = active ? Math.max(0, now - active.startMs) : 0;
  const clockLabel = `${Math.floor(duration / 3600000)
    .toString()
    .padStart(2, '0')}:${Math.floor((duration % 3600000) / 60000)
    .toString()
    .padStart(2, '0')}:${Math.floor((duration % 60000) / 1000)
    .toString()
    .padStart(2, '0')}`;
  const history = [...state.sessions]
    .filter((s) => s.voidedAtMs === null)
    .sort((a, b) => b.startMs - a.startMs);
  const go = (destination: Page) => {
    setPage(destination);
    setError('');
    window.scrollTo({ top: 0 });
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go('home');
          }}
        >
          <span className="brand-mark">MJ</span>
          <span>
            Mi Jornada<small>Tu tiempo cuenta.</small>
          </span>
        </a>
        <nav aria-label="Navegación principal">
          {navigation.map(({ id, name, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? 'nav-link active' : 'nav-link'}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => go(id)}
            >
              <Icon size={21} />
              <span>{name}</span>
              {page === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <LockKeyhole size={19} />
          <div>
            Solo en tu dispositivo<small>Sin cuentas. Sin conexión.</small>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">MJ</span>
            <strong>Mi Jornada</strong>
          </div>
          <span className="location">
            <span className="status-dot" /> Las Vegas, Nevada
          </span>
          <span className="private-pill">
            <LockKeyhole size={14} /> Datos locales
          </span>
        </header>
        <main className="main-content" aria-busy={busy}>
          {error && (
            <div className="alert error" role="alert">
              <span>{error}</span>
              <button className="text-button" onClick={() => void refresh()}>
                <RefreshCw size={16} /> Actualizar
              </button>
            </div>
          )}
          {notice && (
            <div className="toast" role="status">
              <Check size={17} />
              {notice}
            </div>
          )}
          {page === 'home' && (
            <>
              <div className="page-heading home-heading">
                <div>
                  <span className="eyebrow">
                    {formatDate(now, { weekday: 'long', year: 'numeric' }).toUpperCase()}
                  </span>
                  <h1>Tu tiempo cuenta.</h1>
                  <p>Registra tu jornada. Ten tus cuentas a la mano.</p>
                </div>
                <span className="date-badge">
                  <CalendarDays size={19} />
                  {formatDate(now)}
                </span>
              </div>
              <div className="home-grid">
                <section className={`clock-card ${active ? 'running' : ''}`}>
                  <div className="section-row">
                    <span className="eyebrow">TU JORNADA DE HOY</span>
                    <span className="clock-status">
                      <span className="status-dot" />
                      {active ? (pause ? 'En descanso' : 'En curso') : 'Lista para empezar'}
                    </span>
                  </div>
                  <div className="clock-face">
                    <Clock3 size={30} />
                    <strong>{clockLabel}</strong>
                    <span>
                      {active
                        ? `Entrada a las ${formatDate(active.startMs, { hour: '2-digit', minute: '2-digit' })}`
                        : 'Comienza cuando estés listo'}
                    </span>
                  </div>
                  <button
                    className="clock-action"
                    disabled={busy}
                    onClick={() =>
                      void update((s) =>
                        active
                          ? finishSession(s, active.id, Date.now())
                          : startSession(s, Date.now()),
                      )
                    }
                  >
                    {active ? (
                      <Square size={19} fill="currentColor" />
                    ) : (
                      <Play size={21} fill="currentColor" />
                    )}
                    {active ? 'Finalizar jornada' : 'Iniciar jornada'}
                  </button>
                  {active && (
                    <div className="break-actions">
                      {!pause && (
                        <label className="sr-only" htmlFor="break-type">
                          Tipo de descanso
                        </label>
                      )}
                      {!pause && (
                        <select
                          id="break-type"
                          value={breakKind}
                          onChange={(e) => setBreakKind(e.target.value as typeof breakKind)}
                        >
                          <option value="meal-on-duty">Comida pagada con obligaciones</option>
                          <option value="short-rest">Descanso corto pagado</option>
                          <option value="unpaid-meal">Comida libre no pagada (mín. 30 min)</option>
                        </select>
                      )}
                      <button
                        disabled={busy}
                        onClick={() =>
                          void update((s) =>
                            pause
                              ? finishBreak(s, pause.id, Date.now())
                              : startBreak(s, active.id, breakKind, Date.now()),
                          )
                        }
                      >
                        <Coffee size={18} />
                        {pause ? 'Terminar descanso' : 'Iniciar descanso'}
                      </button>
                      {pause && (
                        <small>Al finalizar la jornada se cerrará también este descanso.</small>
                      )}
                    </div>
                  )}
                  <button className="clock-manual" onClick={() => setEditor({ session: null })}>
                    <Plus size={17} /> Agregar jornada manual
                  </button>
                </section>
                <section className="card week-card">
                  <div className="section-row">
                    <h2>Esta semana</h2>
                    <span className="calendar-icon">
                      <CalendarDays size={20} />
                    </span>
                  </div>
                  <p className="muted">{labelWeek(currentWeek)}</p>
                  <div className="week-hours">
                    <strong>{hours(currentEstimate.paidMs)}</strong>
                    <span>horas trabajadas registradas</span>
                  </div>
                  <div className="mini-pay">
                    <div>
                      <span>Bruto estimado</span>
                      <strong>{money(currentEstimate.grossCents)}</strong>
                    </div>
                    <div>
                      <span>Neto estimado</span>
                      <strong>{money(currentTaxes.net)}</strong>
                    </div>
                  </div>
                  <button
                    className="text-button full-row"
                    onClick={() => {
                      setViewMs(now);
                      go('summary');
                    }}
                  >
                    Ver desglose semanal <ChevronRight size={18} />
                  </button>
                </section>
              </div>
              {!state.rates.length ? (
                <button className="setup-banner" onClick={() => go('settings')}>
                  <span className="setup-icon">
                    <Settings2 />
                  </span>
                  <span>
                    <strong>Hagamos tus primeras cuentas</strong>
                    <small>Configura tu tarifa y confirma las condiciones de tu trabajo.</small>
                  </span>
                  <ChevronRight />
                </button>
              ) : !currentSettings?.weekConfirmed || !currentSettings.coverageConfirmed ? (
                <button className="setup-banner" onClick={() => go('settings')}>
                  <span className="setup-icon">
                    <Settings2 />
                  </span>
                  <span>
                    <strong>Faltan unas confirmaciones</strong>
                    <small>
                      Tu registro de tiempo está disponible. Completa la configuración para estimar
                      el pago.
                    </small>
                  </span>
                  <ChevronRight />
                </button>
              ) : null}
              <section className="card recent-card">
                <div className="section-row">
                  <h2>Últimas jornadas</h2>
                  <button className="text-button" onClick={() => go('history')}>
                    Ver historial <ChevronRight size={16} />
                  </button>
                </div>
                {history.length ? (
                  history.slice(0, 3).map((s) => (
                    <button
                      className="recent-row"
                      key={s.id}
                      onClick={() => setEditor({ session: s })}
                    >
                      <span className="session-icon">
                        <Clock3 size={19} />
                      </span>
                      <span>
                        <strong>{formatDate(s.startMs, { weekday: 'long' })}</strong>
                        <small>
                          {s.endMs ? 'Jornada finalizada' : 'Jornada abierta'}
                          {s.revision > 2 ? ' · Corregida' : ''}
                        </small>
                      </span>
                      <strong>{hours((s.endMs ?? now) - s.startMs)}</strong>
                      <ChevronRight size={16} />
                    </button>
                  ))
                ) : (
                  <div className="empty-state">
                    <span className="empty-icon">
                      <History size={28} />
                    </span>
                    <h3>Aquí empieza tu registro</h3>
                    <p>Al terminar tu primera jornada, podrás consultarla y corregirla aquí.</p>
                  </div>
                )}
              </section>
              <p className="page-footnote">
                <LockKeyhole size={14} /> Tus registros permanecen en este dispositivo. El pago
                mostrado es una estimación.
              </p>
            </>
          )}
          {page === 'history' && (
            <>
              <div className="page-heading">
                <span className="eyebrow">CADA JORNADA CUENTA</span>
                <h1>Tu historial</h1>
                <p>Consulta tus horas y corrige lo que necesites.</p>
              </div>
              <div className="section-row history-toolbar">
                <span>{history.length} jornadas registradas</span>
                <button className="primary" onClick={() => setEditor({ session: null })}>
                  <Plus size={18} /> Agregar jornada
                </button>
              </div>
              {history.length ? (
                history.map((s) => {
                  const w = weekAt(s.startMs, atDate(state.employment, s.startMs)!);
                  return (
                    <article className="card history-row" key={s.id}>
                      <div className="history-date">
                        <span>{formatDate(s.startMs, { weekday: 'long' })}</span>
                        <strong>{formatDate(s.startMs, { year: 'numeric' })}</strong>
                      </div>
                      <div className="history-time">
                        <strong>{hours(Math.max(0, (s.endMs ?? now) - s.startMs))}</strong>
                        <small>Presencia · {s.endMs ? 'Finalizada' : 'En curso'}</small>
                        <small>
                          {formatDate(s.startMs, { hour: '2-digit', minute: '2-digit' })} →{' '}
                          {s.endMs
                            ? formatDate(s.endMs, { hour: '2-digit', minute: '2-digit' })
                            : 'Abierta'}
                        </small>
                        {s.note && <span>{s.note}</span>}
                      </div>
                      <div className="history-actions">
                        <button
                          className="icon-button"
                          onClick={() => setEditor({ session: s })}
                          aria-label={`Editar jornada del ${dateInput(s.startMs)}`}
                        >
                          <Pencil size={19} />
                        </button>
                        <button
                          className="icon-button danger"
                          aria-label={`Eliminar jornada del ${dateInput(s.startMs)}`}
                          onClick={() => {
                            if (
                              !confirm(
                                '¿Eliminar esta jornada y sus descansos? La corrección quedará en el historial.',
                              )
                            )
                              return;
                            const reason = prompt('Motivo de eliminación:');
                            if (reason)
                              void update((next) => voidSession(next, s.id, reason, Date.now()));
                          }}
                        >
                          <Trash2 size={19} />
                        </button>
                        <button
                          className="text-button"
                          onClick={() => {
                            setViewMs(w.startMs);
                            go('summary');
                          }}
                        >
                          Ver semana
                        </button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <section className="card empty-state">
                  <History size={36} />
                  <h2>Tus jornadas aparecerán aquí</h2>
                  <p>Inicia una jornada o agrega una anterior manualmente.</p>
                </section>
              )}
              <details className="card">
                <summary>Historial de correcciones ({state.audit.length})</summary>
                {[...state.audit]
                  .sort((a, b) => b.atMs - a.atMs)
                  .slice(0, 100)
                  .map((a) => (
                    <p className="audit-row" key={a.id}>
                      <strong>
                        {formatDate(a.atMs, {
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </strong>
                      <span>{a.reason}</span>
                    </p>
                  ))}
                <small>
                  El respaldo JSON conserva todos los eventos y sus valores anteriores y
                  posteriores.
                </small>
              </details>
            </>
          )}
          {page === 'summary' && (
            <Summary
              key={estimate.week.startMs}
              state={state}
              estimate={estimate}
              taxes={taxes}
              changeWeek={setViewMs}
              update={update}
            />
          )}
          {page === 'settings' && (
            <Settings
              key={state.revision}
              state={state}
              update={update}
              restore={async (imported) => {
                setBusy(true);
                try {
                  setState(
                    await (await openRepository()).restoreWithRecovery(state.revision, imported),
                  );
                  setNotice('Respaldo restaurado; copia anterior conservada');
                  return true;
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'No se pudo restaurar.');
                  return false;
                } finally {
                  setBusy(false);
                }
              }}
              exportRecovery={async () => {
                const previous = await (await openRepository()).lastRecovery();
                if (!previous)
                  throw new Error('Todavía no hay una restauración con copia anterior.');
                await saveFile(
                  'mi-jornada-copia-previa.json',
                  backupJson(previous),
                  'application/json',
                );
              }}
            />
          )}
        </main>
      </div>
      {editor && (
        <SessionEditor
          state={state}
          session={editor.session}
          externalError={error}
          onClose={() => setEditor(null)}
          onSave={(session, breaks, reason) =>
            update((s) => saveSession(s, session, breaks, reason, Date.now()))
          }
        />
      )}
    </div>
  );
}
