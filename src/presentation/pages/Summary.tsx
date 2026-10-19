import { useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Download, ReceiptText } from 'lucide-react';
import {
  atDate,
  WEEK,
  type AppState,
  type Deductions,
  type WeekEstimate,
  type WeeklyPaymentRecord,
} from '../../shared/models';
import { dateInput, formatDate, labelWeek } from '../../domain/time';
import { hours, money, parseMoney } from '../../domain/money';
import { audit, uid } from '../../application/commands';
import { csvWeek, saveFile } from '../../infrastructure/backup/files';

export function Summary({
  state,
  estimate,
  taxes,
  changeWeek,
  update,
}: {
  state: AppState;
  estimate: WeekEstimate;
  taxes: Deductions;
  changeWeek: (ms: number) => void;
  update: (mutate: (s: AppState) => void) => Promise<boolean>;
}) {
  const [error, setError] = useState('');
  const payment = state.payments.find((p) => p.weekStartMs === estimate.week.startMs);
  const settings = atDate(state.payroll, estimate.week.startMs)!;
  async function savePayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    try {
      const f = new FormData(e.currentTarget),
        amount = (key: string) => String(f.get(key) ?? '').trim();
      const next: WeeklyPaymentRecord = {
        id: payment?.id ?? uid(),
        weekStartMs: estimate.week.startMs,
        payDate: amount('payDate') || null,
        ytdBeforeCents: amount('ytd') ? parseMoney(amount('ytd')) : null,
        receivedNetCents: amount('received') ? parseMoney(amount('received')) : null,
      };
      await update((s) => {
        const old = s.payments.find((p) => p.weekStartMs === next.weekStartMs);
        s.payments = [...s.payments.filter((p) => p.weekStartMs !== next.weekStartMs), next];
        audit(s, 'payment', next.id, old, next, 'Datos semanales según recibo o pago previsto');
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    }
  }
  const sessions = state.sessions
    .filter(
      (s) =>
        s.voidedAtMs === null &&
        s.startMs < estimate.week.endMs &&
        (s.endMs ?? Date.now()) > estimate.week.startMs,
    )
    .sort((a, b) => a.startMs - b.startMs);
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">LAS CUENTAS, CLARAS</span>
        <h1>Resumen semanal</h1>
        <p>Una estimación de tu tiempo y de tu pago.</p>
      </div>
      <div className="week-switch">
        <button
          className="icon-button"
          onClick={() => changeWeek(estimate.week.startMs - 1)}
          aria-label="Semana anterior"
        >
          <ChevronLeft />
        </button>
        <div>
          <strong>{labelWeek(estimate.week)}</strong>
          <small>Periodo fijo de 168 horas · Las Vegas</small>
        </div>
        <button
          className="icon-button"
          onClick={() => changeWeek(estimate.week.endMs + 1)}
          aria-label="Semana siguiente"
        >
          <ChevronRight />
        </button>
      </div>
      <section className="pay-card">
        <div>
          <span className="eyebrow">PAGO NETO ESTIMADO</span>
          <strong>{money(taxes.net)}</strong>
          <small>Después de deducciones estimadas</small>
        </div>
        <ReceiptText size={44} />
      </section>
      <div className="stats-grid">
        <div className="stat card">
          <span>Horas trabajadas</span>
          <strong>{hours(estimate.paidMs)}</strong>
          <small>Tiempo computable y remunerado</small>
        </div>
        <div className="stat card">
          <span>Horas ordinarias</span>
          <strong>{hours(estimate.ordinaryMs)}</strong>
        </div>
        <div className="stat card">
          <span>Horas extra</span>
          <strong>{hours(estimate.extraMs)}</strong>
          <small>Multiplicador general 1.5×</small>
        </div>
      </div>
      <div className="two-column">
        <section className="card">
          <h2>Desglose del pago</h2>
          <dl className="pay-lines">
            <div>
              <dt>Importe base registrado</dt>
              <dd>{money(estimate.baseCents)}</dd>
            </div>
            <div>
              <dt>Recargo por horas extra</dt>
              <dd>{money(estimate.premiumCents)}</dd>
            </div>
            <div className="subtotal">
              <dt>Pago bruto estimado</dt>
              <dd>{money(estimate.grossCents)}</dd>
            </div>
            {[
              ['Social Security (6.2 %)', taxes.socialSecurity],
              ['Medicare (1.45 %)', taxes.medicare],
              ['Medicare adicional (0.9 % si corresponde)', taxes.additionalMedicare],
              [`Federal estimado (${settings.federalBps / 100} %)`, taxes.federal],
              ['Renta estatal de Nevada', taxes.state],
              ['Otras deducciones', taxes.other],
            ].map(([name, value]) => (
              <div key={String(name)}>
                <dt>{name}</dt>
                <dd>{value === null ? 'Pendiente' : `−${money(value as number)}`}</dd>
              </div>
            ))}
            <div className="subtotal">
              <dt>Neto estimado</dt>
              <dd>{money(taxes.net)}</dd>
            </div>
          </dl>
          <p className="muted">
            Los campos pendientes no equivalen a cero. El importe base por sí solo no es el pago
            total.
          </p>
        </section>
        <section className="card">
          <h2>Datos de este pago</h2>
          <p className="muted">
            Consulta el recibo de este empleador. No ingreses salarios de otros empleadores ni sumes
            de nuevo el pago actual.
          </p>
          <form onSubmit={savePayment} key={payment?.id ?? estimate.week.startMs}>
            <label>
              Fecha de pago prevista o recibida
              <input type="date" name="payDate" defaultValue={payment?.payDate ?? ''} />
            </label>
            <label>
              Salarios sujetos a FICA acumulados antes de este pago (USD)
              <input
                name="ytd"
                inputMode="decimal"
                placeholder="Pendiente; escribe 0 solo si lo confirmaste"
                defaultValue={
                  payment?.ytdBeforeCents == null ? '' : (payment.ytdBeforeCents / 100).toFixed(2)
                }
              />
              <small>
                Necesario para el límite anual de Social Security y Medicare adicional. No se
                calcula con semanas trabajadas aún sin pagar.
              </small>
            </label>
            <label>
              Pago neto recibido, opcional (USD)
              <input
                name="received"
                inputMode="decimal"
                placeholder="Según recibo"
                defaultValue={
                  payment?.receivedNetCents == null
                    ? ''
                    : (payment.receivedNetCents / 100).toFixed(2)
                }
              />
            </label>
            {error && (
              <p className="alert error" role="alert">
                {error}
              </p>
            )}
            <button className="primary">Guardar datos del pago</button>
          </form>
          {payment?.receivedNetCents != null && (
            <div className="comparison">
              <span>Neto recibido</span>
              <strong>{money(payment.receivedNetCents)}</strong>
              <small>
                {taxes.net === null
                  ? 'Completa la estimación para comparar.'
                  : `Diferencia frente a estimación: ${money(payment.receivedNetCents - taxes.net)}`}
              </small>
            </div>
          )}
        </section>
      </div>
      {(estimate.warnings.length > 0 || taxes.warnings.length > 0) && (
        <section className="card notice">
          <h2>Antes de tomar el total como referencia</h2>
          <ul>
            {[...estimate.warnings, ...taxes.warnings].map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}
      <section className="card">
        <div className="section-row">
          <h2>Jornadas de la semana</h2>
          <span className="tag">{sessions.length} registros</span>
        </div>
        {sessions.length ? (
          sessions.map((s) => (
            <div className="summary-session" key={s.id}>
              <strong>{formatDate(s.startMs, { weekday: 'short' })}</strong>
              <span>
                {formatDate(s.startMs, { hour: '2-digit', minute: '2-digit' })} →{' '}
                {s.endMs ? formatDate(s.endMs, { hour: '2-digit', minute: '2-digit' }) : 'En curso'}
              </span>
            </div>
          ))
        ) : (
          <p className="muted">No hay jornadas en este periodo.</p>
        )}
        <details>
          <summary>Cómo se calculó</summary>
          <ul>
            {estimate.explanation.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p>
            Presencia: {hours(estimate.presenceMs)}. Actividad fuera de pausas:{' '}
            {hours(estimate.activeMs)}. Candidato diario: {hours(estimate.dailyExtraMs)}. Candidato
            semanal: {hours(estimate.weeklyExtraMs)}.
          </p>
          <p>
            Versión: {estimate.ruleVersion}. Neto: tasas 2026; federal por porcentaje editable. No
            es garantía de pago ni declaración fiscal.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Intervalo (Las Vegas)</th>
                  <th>Tarifa/h</th>
                  <th>Pagado</th>
                  <th>Candidato diario</th>
                </tr>
              </thead>
              <tbody>
                {estimate.segments.map((s, i) => (
                  <tr key={i}>
                    <td>
                      {formatDate(s.startMs, { hour: '2-digit', minute: '2-digit' })} →{' '}
                      {formatDate(s.endMs, { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>{money(s.hourlyCents)}</td>
                    <td>{s.paid ? 'Sí' : 'No'}</td>
                    <td>{s.dailyOvertime ? 'Extra' : 'Ordinario'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <button
          className="secondary"
          onClick={() =>
            void saveFile(
              `mi-jornada-${dateInput(estimate.week.startMs)}.csv`,
              csvWeek(state, estimate),
              'text/csv;charset=utf-8',
            ).catch((e) => setError(String(e)))
          }
        >
          <Download size={18} /> Exportar esta semana CSV
        </button>
      </section>
    </>
  );
}
