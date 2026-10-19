import { useState, type FormEvent } from 'react';
import { Download, FileUp, ShieldCheck } from 'lucide-react';
import {
  atDate,
  type AppState,
  type EmploymentSettings,
  type PayrollSettings,
} from '../../shared/models';
import { audit, uid } from '../../application/commands';
import {
  dateInput,
  formatDate,
  localInput,
  localInstant,
  mondayDate,
  weekday,
} from '../../domain/time';
import { money, parseMoney, parsePercent } from '../../domain/money';
import { backupJson, parseBackup, saveFile } from '../../infrastructure/backup/files';
import { ProfileCard } from '../components/ProfileCard';
import { HelpHint } from '../components/HelpHint';

export function Settings({
  state,
  update,
  restore,
  exportRecovery,
}: {
  state: AppState;
  update: (mutate: (s: AppState) => void) => Promise<boolean>;
  restore: (s: AppState) => Promise<boolean>;
  exportRecovery: () => Promise<void>;
}) {
  const now = Date.now(),
    current = atDate(state.employment, now)!,
    payroll = atDate(state.payroll, now)!;
  const [mode, setMode] = useState(current.mode),
    [days, setDays] = useState(current.scheduledDays);
  const [error, setError] = useState(''),
    [pending, setPending] = useState<AppState | null>(null),
    [busy, setBusy] = useState(false);
  const monday = localInstant(mondayDate(now) + 'T00:00');
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const f = new FormData(event.currentTarget),
        get = (key: string) => String(f.get(key) ?? '');
      const anchor = localInstant(get('anchorDate') + 'T' + get('anchorTime'));
      if (weekday(anchor) !== 1)
        throw new Error('Selecciona un lunes para iniciar la semana laboral.');
      if (get('anchorDate') < dateInput(monday))
        throw new Error(
          'Los cambios de condiciones se aplican a esta semana o una futura; no se reescriben semanas anteriores.',
        );
      const employment: EmploymentSettings = {
        id: uid(),
        effectiveFromMs: anchor,
        zone: 'America/Los_Angeles',
        weekAnchorMs: anchor,
        weekConfirmed: f.has('weekConfirmed'),
        coverageConfirmed: f.has('coverage'),
        mode,
        agreementConfirmed: f.has('agreement'),
        scheduledDays: days,
      };
      const tax: PayrollSettings = {
        id: uid(),
        effectiveFromMs: anchor,
        ficaConfirmed: f.has('fica'),
        federalBps: parsePercent(get('federal')),
        federalConfirmed: f.has('federalConfirmed'),
        otherWeeklyCents: parseMoney(get('other')),
      };
      const rateText = get('rate'),
        rateStart = localInstant(get('rateDate') + 'T00:00');
      const rate = rateText
        ? { id: uid(), effectiveFromMs: rateStart, hourlyCents: parseMoney(rateText) }
        : null;
      if (rate && rate.hourlyCents === 0) throw new Error('La tarifa debe ser mayor a cero.');
      await update((s) => {
        const before = {
          employment: atDate(s.employment, anchor),
          payroll: atDate(s.payroll, anchor),
        };
        s.employment = [...s.employment.filter((x) => x.effectiveFromMs !== anchor), employment];
        s.payroll = [...s.payroll.filter((x) => x.effectiveFromMs !== anchor), tax];
        if (rate) {
          const old = s.rates.find((r) => r.effectiveFromMs === rateStart);
          s.rates = [...s.rates.filter((x) => x.effectiveFromMs !== rateStart), rate];
          audit(s, 'rate', rate.id, old, rate, 'Tarifa configurada por el usuario');
        }
        audit(
          s,
          'settings',
          employment.id,
          before,
          { employment, payroll: tax },
          'Configuración con vigencia explícita',
        );
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">TU ESPACIO PERSONAL</span>
        <h1>Configuración</h1>
        <p>Tu nombre, tu pago y tus horarios. Un paso a la vez.</p>
      </div>
      <ProfileCard state={state} update={update} />
      <div className="setup-guide">
        <strong>Primero, lo básico</strong>
        <p>
          Guarda cuánto te pagan y cuándo comienza tu semana. Los datos del recibo pueden esperar:
          puedes registrar tus jornadas desde ahora.
        </p>
      </div>
      <form onSubmit={save} className="settings-form">
        <section className="card">
          <div className="section-row">
            <h2>1. Tu pago por hora</h2>
            <span className="tag">{state.rates.length ? 'Configurado' : 'Por completar'}</span>
          </div>
          <p className="muted">
            Es el pago de una hora normal, antes de que te descuenten impuestos.
          </p>
          <div className="form-grid">
            <label>
              ¿Cuánto te pagan por hora? (USD)
              <input
                name="rate"
                inputMode="decimal"
                aria-label="¿Cuánto te pagan por hora? (USD)"
                placeholder={
                  atDate(state.rates, now)
                    ? 'Actual: ' + money(atDate(state.rates, now)!.hourlyCents)
                    : 'Por ejemplo: 20.00'
                }
              />
              <small>Déjalo vacío si tu tarifa actual sigue igual.</small>
            </label>
            <label>
              ¿Desde qué fecha te pagan esa cantidad?
              <input name="rateDate" type="date" required defaultValue={dateInput(monday)} />
            </label>
          </div>
          {!!state.rates.length && (
            <details>
              <summary>Ver mis tarifas anteriores</summary>
              <ul className="rate-list">
                {[...state.rates]
                  .sort((a, b) => b.effectiveFromMs - a.effectiveFromMs)
                  .map((r) => (
                    <li key={r.id}>
                      <strong>{money(r.hourlyCents)}/h</strong>
                      <span>Desde {formatDate(r.effectiveFromMs, { year: 'numeric' })}</span>
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </section>
        <details
          className="card settings-section"
          open={!current.weekConfirmed || !current.coverageConfirmed}
        >
          <summary>
            <span>2. Tu horario y horas extra</span>
            <span className="tag">
              {current.weekConfirmed && current.coverageConfirmed ? 'Revisado' : 'Por revisar'}
            </span>
          </summary>
          <div className="settings-section-body">
            <p className="muted">
              Trabajo por hora en Las Vegas, Nevada. Los horarios anteriores se conservan.
            </p>
            <div className="form-grid">
              <label>
                Tu horario de trabajo
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as EmploymentSettings['mode'])}
                >
                  <option value="standard">Horario normal</option>
                  <option value="four-ten">Cuatro días de diez horas (4×10)</option>
                </select>
              </label>
              <label>
                Aplicar estos ajustes desde el lunes
                <input name="anchorDate" type="date" required defaultValue={dateInput(monday)} />
              </label>
              <label>
                ¿A qué hora comienza tu semana de trabajo?
                <input
                  name="anchorTime"
                  type="time"
                  required
                  defaultValue={localInput(current.weekAnchorMs).slice(11, 16)}
                />
              </label>
            </div>
            <HelpHint title="¿Cómo sé cuándo empieza mi semana?">
              <p>
                Es el periodo que usa la empresa para sumar tus horas. Puede empezar el lunes a
                medianoche o a otra hora. Confírmalo con tu empleador; la fecha en que recibes el
                pago puede ser distinta.
              </p>
              <p>
                La cuenta usa siete periodos de 24 horas. Si cambia el horario de verano, revisa la
                hora con la empresa.
              </p>
            </HelpHint>
            <label className="check">
              <input type="checkbox" name="weekConfirmed" defaultChecked={current.weekConfirmed} />
              <span>Ya confirmé con mi empleador este inicio de semana.</span>
            </label>
            <label className="check">
              <input type="checkbox" name="coverage" defaultChecked={current.coverageConfirmed} />
              <span>
                Confirmé que a mi trabajo le corresponden las reglas generales de horas extra de
                Nevada.
              </span>
            </label>
            <HelpHint title="¿Qué estoy confirmando sobre las horas extra?">
              <p>
                El cálculo general es para empleados por hora que tienen derecho a horas extra. Los
                contratos sindicales, algunas excepciones y las obras públicas pueden usar otras
                reglas.
              </p>
              <p>
                El término legal es “empleado cubierto y no exento”. No se determina por tu
                situación migratoria. Si no lo sabes, deja la casilla sin marcar: tus horas se
                guardan y el pago queda pendiente de confirmar.
              </p>
            </HelpHint>
            <p className="muted">
              La comida pagada en la que sigues atendiendo tareas cuenta como tiempo trabajado.
            </p>
            {mode === 'four-ten' && (
              <div className="inset">
                <label className="check">
                  <input
                    type="checkbox"
                    name="agreement"
                    defaultChecked={current.agreementConfirmed}
                  />
                  <span>Mi empleador y yo acordamos trabajar cuatro días de diez horas.</span>
                </label>
                <p>Días que acordamos trabajar</p>
                <div className="day-picker">
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day, i) => (
                    <label key={i}>
                      <input
                        type="checkbox"
                        checked={days.includes(i + 1)}
                        onChange={(e) =>
                          setDays(
                            e.target.checked ? [...days, i + 1] : days.filter((d) => d !== i + 1),
                          )
                        }
                      />
                      <span>{day}</span>
                    </label>
                  ))}
                </div>
                <small>
                  Elige cuatro días. Si una semana no sigue el acuerdo, la app pedirá revisar el
                  cálculo.
                </small>
              </div>
            )}
          </div>
        </details>
        <details className="card settings-section">
          <summary>
            <span>3. Descuentos de tu pago</span>
            <span className="tag">Cuando tengas tu recibo</span>
          </summary>
          <div className="settings-section-body">
            <p className="muted">
              Son las cantidades que te quitan del pago por impuestos u otros conceptos. Puedes
              completar esto después.
            </p>
            <label className="check">
              <input type="checkbox" name="fica" defaultChecked={payroll.ficaConfirmed} />
              <span>
                Confirmé que a mi pago le corresponden los descuentos de Seguro Social y Medicare.
              </span>
            </label>
            <HelpHint title="¿Qué son Seguro Social, Medicare y FICA?">
              <p>
                Seguro Social es un programa federal de beneficios, como jubilación. Medicare es un
                programa federal de seguro médico. FICA es el nombre de la ley que agrupa estos dos
                impuestos.
              </p>
              <p>
                En un recibo pueden aparecer como “Social Security” y “Medicare”. No necesitas
                escribir tu número de Seguro Social para usar esta app. Si no sabes si te
                corresponden, deja la casilla sin marcar y consulta tu recibo o a quien prepara tu
                pago.
              </p>
            </HelpHint>
            <div className="form-grid">
              <label>
                Impuesto federal que te descuentan (%)
                <input
                  name="federal"
                  aria-label="Impuesto federal que te descuentan (%)"
                  inputMode="decimal"
                  required
                  defaultValue={(payroll.federalBps / 100).toFixed(2)}
                />
                <small>El 10 % inicial es solo un ejemplo. Cámbialo según tu recibo.</small>
              </label>
              <label>
                Otros descuentos por semana (USD)
                <input
                  name="other"
                  inputMode="decimal"
                  required
                  defaultValue={(payroll.otherWeeklyCents / 100).toFixed(2)}
                />
              </label>
            </div>
            <HelpHint title="¿Cómo obtengo el porcentaje de mi recibo?">
              <p>
                Busca solo el impuesto federal (“Federal income tax”). Divide esa cantidad entre el
                pago antes de descuentos y multiplica por 100.
              </p>
              <p>
                Ejemplo: si el pago antes de descuentos es $1,000 y el impuesto federal es $80,
                escribe 8. No sumes aquí Seguro Social ni Medicare: se calculan aparte.
              </p>
              <p>
                Otros descuentos: escribe el monto fijo que te quitan después de impuestos, o 0 si
                no tienes. Los beneficios antes de impuestos necesitan una revisión aparte.
              </p>
            </HelpHint>
            <label className="check">
              <input
                name="federalConfirmed"
                type="checkbox"
                defaultChecked={payroll.federalConfirmed}
              />
              <span>Ya revisé este porcentaje aproximado con mi recibo o lo confirmé.</span>
            </label>
            <HelpHint title="¿Necesito papeles o un número para usar la app?">
              <p>
                No necesitas dar estatus migratorio, SSN, ITIN ni documentos. Tu registro de horas
                funciona sin esos datos.
              </p>
              <p>
                La situación migratoria y la residencia fiscal son cosas distintas. No tener estatus
                regular no elimina automáticamente los impuestos ni los derechos salariales. Si hay
                dudas sobre los descuentos de tu caso, déjalos pendientes y consulta a un
                profesional.
              </p>
              <p>
                Las horas extra no se consideran automáticamente libres de impuestos. El resultado
                es una estimación de tu pago, no una declaración anual.
              </p>
              <a href="https://www.irs.gov/taxtopics/tc751" target="_blank" rel="noreferrer">
                IRS: Seguro Social y Medicare
              </a>
              <br />
              <a href="https://www.irs.gov/taxtopics/tc851" target="_blank" rel="noreferrer">
                IRS: residencia fiscal
              </a>
              <small>Los enlaces necesitan Internet. La app funciona sin conexión.</small>
            </HelpHint>
          </div>
        </details>
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        <div className="settings-save">
          <button className="primary save-settings" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar mis ajustes'}
          </button>
          <small>Puedes guardar aunque tengas confirmaciones pendientes.</small>
        </div>
      </form>
      <details className="card backup-card settings-section">
        <summary>
          <span>Copias de mis registros</span>
          <ShieldCheck size={20} />
        </summary>
        <div className="settings-section-body">
          <p className="muted">
            Guarda una copia fuera de la app para recuperar tus jornadas si cambias de teléfono. En
            Android, elige una carpeta del teléfono, por ejemplo Descargas.
          </p>
          <div className="button-row">
            <button
              className="secondary"
              onClick={() =>
                void saveFile(
                  'mi-jornada-' + dateInput(now) + '.json',
                  backupJson(state),
                  'application/json',
                ).catch((e) => setError(String(e)))
              }
            >
              <Download size={18} /> Guardar respaldo
            </button>
            <label className="secondary file-button">
              <FileUp size={18} /> Revisar respaldo
              <input
                type="file"
                accept=".json,application/json"
                onChange={async (e) => {
                  setError('');
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  try {
                    if (file.size > 10_000_000) throw new Error('El respaldo supera 10 MB.');
                    setPending(parseBackup(await file.text()));
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Archivo inválido.');
                  }
                }}
              />
            </label>
            <button
              className="text-button"
              onClick={() => void exportRecovery().catch((e) => setError(String(e)))}
            >
              Guardar la copia anterior a mi última recuperación
            </button>
          </div>
          <HelpHint title="¿Qué pasa al recuperar una copia?">
            <p>
              La copia reemplaza tus registros actuales. Primero puedes revisar cuántas jornadas
              tiene y cancelar si no es la correcta. La app conserva una copia previa, pero también
              conviene guardar un respaldo fuera de ella.
            </p>
          </HelpHint>
          {pending && (
            <div className="alert">
              <h3>Revisar antes de reemplazar</h3>
              <p>
                La copia tiene {pending.sessions.filter((s) => s.voidedAtMs === null).length}{' '}
                jornadas y {pending.rates.length} tarifas. Reemplazará tus{' '}
                {state.sessions.filter((s) => s.voidedAtMs === null).length} jornadas actuales. Se
                guardará una copia local del estado anterior.
              </p>
              <div className="button-row">
                <button className="secondary" onClick={() => setPending(null)}>
                  Cancelar
                </button>
                <button
                  className="danger-button"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      !confirm(
                        '¿Reemplazar tus registros con esta copia? Se conservará una copia local previa.',
                      )
                    )
                      return;
                    setBusy(true);
                    try {
                      if (await restore(pending)) setPending(null);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Restaurar y reemplazar
                </button>
              </div>
            </div>
          )}
        </div>
      </details>
    </>
  );
}
