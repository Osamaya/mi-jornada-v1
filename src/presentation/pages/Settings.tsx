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
        <span className="eyebrow">A TU MANERA</span>
        <h1>Configuración</h1>
        <p>Unos datos para que las cuentas sean más claras.</p>
      </div>
      <ProfileCard state={state} update={update} />
      <form onSubmit={save} className="settings-form">
        <section className="card">
          <h2>Tu trabajo</h2>
          <div className="location-line">
            Las Vegas, Nevada <span>USD · America/Los_Angeles</span>
          </div>
          <p className="muted">
            Perfil personal de empleado por hora. La comida pagada con obligaciones cuenta como
            tiempo trabajado.
          </p>
          <label className="check">
            <input type="checkbox" name="coverage" defaultChecked={current.coverageConfirmed} />
            <span>
              Confirmé que soy empleado cubierto y no exento, en trabajo privado, sin convenio ni
              excepción especial.
            </span>
          </label>
          <div className="form-grid">
            <label>
              Modalidad
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as EmploymentSettings['mode'])}
              >
                <option value="standard">Estándar</option>
                <option value="four-ten">Acuerdo 4×10</option>
              </select>
            </label>
            <label>
              Vigencia de condiciones (lunes)
              <input name="anchorDate" type="date" required defaultValue={dateInput(monday)} />
            </label>
            <label>
              Hora de inicio de semana
              <input
                name="anchorTime"
                type="time"
                required
                defaultValue={localInput(current.weekAnchorMs).slice(11, 16)}
              />
            </label>
          </div>
          <label className="check">
            <input type="checkbox" name="weekConfirmed" defaultChecked={current.weekConfirmed} />
            <span>Confirmé con mi empleador este inicio de semana de 168 horas.</span>
          </label>
          <small>
            La hora local puede moverse al cambiar el horario de verano. Revisa el periodo con tu
            empleador.
          </small>
          {mode === 'four-ten' && (
            <div className="inset">
              <label className="check">
                <input
                  type="checkbox"
                  name="agreement"
                  defaultChecked={current.agreementConfirmed}
                />
                <span>Existe un acuerdo mutuo de cuatro jornadas de diez horas.</span>
              </label>
              <p>Días pactados</p>
              <div className="day-picker">
                {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, i) => (
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
                Selecciona cuatro días. Las semanas incompletas o irregulares se marcan para
                revisión; elegir 4×10 no autoriza cualquier horario.
              </small>
            </div>
          )}
        </section>
        <section className="card">
          <h2>Tarifa por hora</h2>
          <p className="muted">
            La tarifa se conserva por fecha. No hace falta volver a ingresarla al cambiar otra
            configuración.
          </p>
          <div className="form-grid">
            <label>
              Nueva tarifa (USD/h)
              <input name="rate" inputMode="decimal" placeholder="Por configurar" />
            </label>
            <label>
              Vigente desde
              <input name="rateDate" type="date" required defaultValue={dateInput(monday)} />
            </label>
          </div>
          {!!state.rates.length && (
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
          )}
        </section>
        <section className="card">
          <h2>Deducciones aproximadas</h2>
          <p className="muted">
            Estimamos retenciones del pago, no tu declaración ni el impuesto anual.
          </p>
          <label className="check">
            <input type="checkbox" name="fica" defaultChecked={payroll.ficaConfirmed} />
            <span>
              Mi nómina está sujeta a Social Security y Medicare bajo el régimen general de
              empleado.
            </span>
          </label>
          <div className="form-grid">
            <label>
              Retención federal estimada (%)
              <input
                name="federal"
                inputMode="decimal"
                required
                defaultValue={(payroll.federalBps / 100).toFixed(2)}
              />
              <small>10 % inicial: supuesto editable, no tasa universal del IRS.</small>
            </label>
            <label>
              Otras deducciones semanales (USD)
              <input
                name="other"
                inputMode="decimal"
                required
                defaultValue={(payroll.otherWeeklyCents / 100).toFixed(2)}
              />
            </label>
          </div>
          <label className="check">
            <input
              name="federalConfirmed"
              type="checkbox"
              defaultChecked={payroll.federalConfirmed}
            />
            <span>Confirmo este porcentaje aproximado. Puedo ajustarlo con un recibo.</span>
          </label>
          <p className="muted">
            Para calibrarlo: retención federal del recibo ÷ bruto del mismo recibo × 100. Social
            Security y Medicare van por separado.
          </p>
          <details>
            <summary>Impuestos y situación migratoria</summary>
            <p>
              La residencia fiscal y el estatus migratorio son distintos. No tener estatus regular
              no elimina automáticamente impuestos ni derechos salariales. Un ITIN sirve para fines
              fiscales; no autoriza a trabajar.
            </p>
            <p>
              Esta app no solicita ni guarda estatus migratorio, SSN, ITIN ni documentos. Tampoco
              supone exenciones por carecer de esos números. Si no conoces tu régimen, deja la
              confirmación pendiente y contrasta las deducciones con un profesional o tu recibo.
            </p>
            <p>
              Las horas extra no se consideran automáticamente libres de impuestos. Nevada no cobra
              impuesto estatal individual sobre la renta.
            </p>
            <a href="https://www.irs.gov/taxtopics/tc851" target="_blank" rel="noreferrer">
              Fuente: IRS — residencia fiscal
            </a>
            <br />
            <a
              href="https://www.irs.gov/individuals/additional-itin-information"
              target="_blank"
              rel="noreferrer"
            >
              Fuente: IRS — ITIN
            </a>
            <br />
            <a
              href="https://www.dol.gov/agencies/whd/compliance-assistance/handy-reference-guide-flsa"
              target="_blank"
              rel="noreferrer"
            >
              Fuente: DOL — protecciones salariales
            </a>
            <small>
              Los enlaces son opcionales y necesitan Internet; el registro y cálculo funcionan
              localmente.
            </small>
          </details>
        </section>
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
        <button className="primary save-settings" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </form>
      <section className="card backup-card">
        <div className="section-row">
          <h2>Cuida tus registros</h2>
          <ShieldCheck />
        </div>
        <p className="muted">
          Los datos viven en este dispositivo. Desinstalar la app puede borrarlos; guarda respaldos
          fuera de ella.
        </p>
        <div className="button-row">
          <button
            className="secondary"
            onClick={() =>
              void saveFile(
                `mi-jornada-${dateInput(now)}.json`,
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
            Exportar copia anterior a la última restauración
          </button>
        </div>
        {pending && (
          <div className="alert">
            <h3>Revisar antes de reemplazar</h3>
            <p>
              El archivo contiene {pending.sessions.filter((s) => s.voidedAtMs === null).length}{' '}
              jornadas y {pending.rates.length} tarifas. Reemplazará{' '}
              {state.sessions.filter((s) => s.voidedAtMs === null).length} jornadas actuales. Se
              conserva una copia local del estado anterior.
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
                      '¿Reemplazar todos los datos actuales con este respaldo? Se conservará una copia local previa.',
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
      </section>
    </>
  );
}
