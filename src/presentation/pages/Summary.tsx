import { useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import {
  atDate,
  type AppState,
  type Deductions,
  type WeekEstimate,
  type WeeklyPaymentRecord,
} from '../../shared/models';
import { dateInput, formatDate, labelWeek } from '../../domain/time';
import { hours, money, parseMoney } from '../../domain/money';
import { audit, uid } from '../../application/commands';
import { csvWeek, saveFile } from '../../infrastructure/backup/files';
import { HelpHint } from '../components/HelpHint';

export function Summary({
  state,
  estimate,
  taxes,
  changeWeek,
  update,
  onSettings,
}: {
  state: AppState;
  estimate: WeekEstimate;
  taxes: Deductions;
  changeWeek: (ms: number) => void;
  update: (mutate: (s: AppState) => void) => Promise<boolean>;
  onSettings: () => void;
}) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const payment = state.payments.find((p) => p.weekStartMs === estimate.week.startMs);
  const [priorWages, setPriorWages] = useState(
    payment?.ytdBeforeCents == null ? '' : (payment.ytdBeforeCents / 100).toFixed(2),
  );
  const settings = atDate(state.payroll, estimate.week.startMs)!;
  async function savePayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
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
    } finally {
      setSaving(false);
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
  const warnings = [...estimate.warnings, ...taxes.warnings].filter(
    (w) => !w.startsWith('Semana en curso:'),
  );
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">TUS CUENTAS</span>
        <h1>Resumen semanal</h1>
        <p>Lo que trabajaste y cuánto podrías recibir.</p>
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
          <small>Tu semana de trabajo · Las Vegas</small>
        </div>
        <button
          className="icon-button"
          onClick={() => changeWeek(estimate.week.endMs + 1)}
          aria-label="Semana siguiente"
        >
          <ChevronRight />
        </button>
      </div>
      <section className="pay-card pay-overview">
        <div>
          <span className="eyebrow">ANTES DE DESCUENTOS</span>
          <strong>{money(estimate.grossCents)}</strong>
          <small>Por las horas registradas de esta semana</small>
        </div>
        <div className="pay-after">
          <span className="eyebrow">DESPUÉS DE DESCUENTOS</span>
          <strong>{money(taxes.net)}</strong>
          {taxes.net === null ? (
            <a href="#payment-details">
              Completar datos de mi recibo <ChevronRight size={15} />
            </a>
          ) : (
            <small>Lo que podrías recibir</small>
          )}
        </div>
      </section>
      <HelpHint title="¿Qué significa antes y después de descuentos?">
        <p>
          Antes de descuentos es todo lo que suman tus horas normales y extra. En un recibo suele
          llamarse “pago bruto”. Después de descuentos es lo que queda tras quitar impuestos y otros
          cobros: “pago neto”.
        </p>
        <p>
          Ejemplo: $1,000 antes de descuentos menos $100 de descuentos dejan $900. Tu cuenta real
          depende de tus horas y de tu recibo.
        </p>
      </HelpHint>
      <div className="stats-grid">
        <div className="stat card">
          <span>Horas trabajadas</span>
          <strong>{hours(estimate.paidMs)}</strong>
          <small>Incluye tus descansos pagados</small>
        </div>
        <div className="stat card">
          <span>Horas normales</span>
          <strong>{hours(estimate.ordinaryMs)}</strong>
        </div>
        <div className="stat card">
          <span>Horas extra</span>
          <strong>{hours(estimate.extraMs)}</strong>
          <small>Se pagan a una vez y media cuando corresponde</small>
        </div>
      </div>
      <div className="two-column">
        <section className="card">
          <h2>Así se forma tu pago</h2>
          <dl className="pay-lines">
            <div>
              <dt>Tus horas al pago normal</dt>
              <dd>{money(estimate.baseCents)}</dd>
            </div>
            <div>
              <dt>Dinero adicional por horas extra</dt>
              <dd>{money(estimate.premiumCents)}</dd>
            </div>
            <div className="subtotal">
              <dt>Antes de descuentos</dt>
              <dd>{money(estimate.grossCents)}</dd>
            </div>
            {[
              ['Seguro Social (6.2 %)', taxes.socialSecurity],
              ['Medicare (1.45 %)', taxes.medicare],
              ...(taxes.additionalMedicare
                ? [['Medicare adicional', taxes.additionalMedicare]]
                : []),
              ['Impuesto federal (' + settings.federalBps / 100 + ' %)', taxes.federal],
              ['Impuesto estatal de Nevada', taxes.state],
              ['Otros descuentos', taxes.other],
            ].map(([name, value]) => (
              <div key={String(name)}>
                <dt>{name}</dt>
                <dd>{value === null ? 'Pendiente' : '−' + money(value as number)}</dd>
              </div>
            ))}
            <div className="subtotal">
              <dt>Después de descuentos</dt>
              <dd>{money(taxes.net)}</dd>
            </div>
          </dl>
          <HelpHint title="¿Qué son estos descuentos?">
            <p>
              <strong>Seguro Social:</strong> impuesto para programas federales, como jubilación. En
              inglés puede decir “Social Security”.
            </p>
            <p>
              <strong>Medicare:</strong> impuesto para un programa federal de seguro médico. Estos
              dos impuestos se agrupan bajo la ley llamada FICA.
            </p>
            <p>
              <strong>Federal:</strong> el descuento aproximado de impuesto sobre la renta. El
              porcentaje se toma de tus ajustes, no de una tasa igual para todos.
            </p>
            <p>
              <strong>Otros:</strong> el monto semanal que hayas indicado. El Medicare adicional
              solo se aplica al superar el umbral de salarios del empleador.
            </p>
          </HelpHint>
          <p className="muted">
            “Pendiente” significa que falta información. No quiere decir que el descuento sea cero.
          </p>
        </section>
        <section className="card payment-card" id="payment-details">
          <span className="eyebrow">PUEDES COMPLETARLO DESPUÉS</span>
          <h2>Con tu recibo a la mano</h2>
          <p className="muted">
            Estos datos ayudan a calcular lo que queda después de los descuentos. Si no los tienes,
            tus horas y tu pago antes de descuentos siguen disponibles.
          </p>
          <form
            onSubmit={savePayment}
            key={payment?.id ?? estimate.week.startMs}
            aria-busy={saving}
          >
            <label htmlFor="pay-date">¿Qué día te pagan?</label>
            <input
              id="pay-date"
              type="date"
              name="payDate"
              defaultValue={payment?.payDate ?? ''}
              disabled={saving}
            />
            <label htmlFor="prior-wages">Lo que esta empresa ya te pagó este año (USD)</label>
            <input
              id="prior-wages"
              name="ytd"
              disabled={saving}
              inputMode="decimal"
              placeholder="Puedes dejarlo pendiente"
              value={priorWages}
              onChange={(e) => setPriorWages(e.target.value)}
              aria-describedby="prior-wages-note"
            />
            <small id="prior-wages-note">
              El acumulado del recibo anterior, antes de este pago. No es lo que te depositaron.
            </small>
            <HelpHint title="¿Dónde encuentro este dato? ¿Qué es FICA?">
              <p>
                Busca el recibo anterior de esta misma empresa y de este mismo año. Revisa “Social
                Security wages YTD” y “Medicare wages YTD”. Son los salarios acumulados que se usan
                para esos impuestos. “YTD” quiere decir “en lo que va del año”.
              </p>
              <p>
                FICA es el nombre de la ley que agrupa Seguro Social y Medicare. La app necesita el
                acumulado para respetar sus límites; no necesita tu número de Seguro Social.
              </p>
              <p>
                <strong>Ejemplo:</strong> si ambos acumulados del recibo anterior dicen $12,500 y
                esta semana vas a ganar $600, aquí escribes 12500. No sumes todavía los $600.
              </p>
              <p>
                Si los dos acumulados son distintos, solo tienes el recibo actual, no tienes recibos
                o no encuentras la cifra, deja este campo pendiente. No uses lo depositado, los
                salarios de otra empresa ni un cero por adivinar.
              </p>
            </HelpHint>
            <button
              type="button"
              className="text-button unknown-value"
              disabled={saving}
              onClick={() => setPriorWages('')}
            >
              No sé este dato; lo dejo pendiente
            </button>
            <label htmlFor="received-pay">¿Cuánto recibiste? (USD, opcional)</label>
            <input
              id="received-pay"
              name="received"
              disabled={saving}
              inputMode="decimal"
              placeholder="El dinero que recibiste o te depositaron"
              defaultValue={
                payment?.receivedNetCents == null ? '' : (payment.receivedNetCents / 100).toFixed(2)
              }
            />
            <small>Sirve para comparar con la estimación. No hace falta subir un recibo.</small>
            {error && (
              <p className="alert error" role="alert">
                {error}
              </p>
            )}
            <button className="primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar datos del pago'}
            </button>
          </form>
          {payment?.receivedNetCents != null && (
            <div className="comparison">
              <span>Dinero que recibiste</span>
              <strong>{money(payment.receivedNetCents)}</strong>
              <small>
                {taxes.net === null
                  ? 'La comparación estará disponible al completar los descuentos.'
                  : 'Diferencia frente a la estimación: ' +
                    money(payment.receivedNetCents - taxes.net)}
              </small>
            </div>
          )}
        </section>
      </div>
      {!!warnings.length && (
        <section className="card notice">
          <h2>Para completar tu cuenta</h2>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          {(!settings.ficaConfirmed ||
            !settings.federalConfirmed ||
            estimate.grossCents === null) && (
            <button className="secondary" onClick={onSettings}>
              Revisar mis ajustes
            </button>
          )}
        </section>
      )}
      <section className="card">
        <div className="section-row">
          <h2>Tus jornadas de la semana</h2>
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
          <p className="muted">Todavía no hay jornadas en esta semana.</p>
        )}
        {estimate.provisional && (
          <p className="muted week-progress-note">
            La semana sigue en curso. Las cantidades cambian al agregar o corregir jornadas.
          </p>
        )}
        <details>
          <summary>Ver cómo se calculan mis horas</summary>
          <p>
            Se suman tus horas pagadas. La comida pagada y los descansos cortos pagados no se
            restan. Cuando corresponden horas extra, se añade el dinero adicional una sola vez.
          </p>
          <p>
            Tiempo total entre entrada y salida: {hours(estimate.presenceMs)}. Actividad fuera de
            pausas: {hours(estimate.activeMs)}.
          </p>
          <details>
            <summary>Reglas y detalle técnico</summary>
            <ul>
              {estimate.explanation.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
            <p>
              Evaluación diaria: {hours(estimate.dailyExtraMs)}. Evaluación semanal:{' '}
              {hours(estimate.weeklyExtraMs)}. Versión: {estimate.ruleVersion}.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Horario (Las Vegas)</th>
                    <th>Pago por hora</th>
                    <th>Pagado</th>
                    <th>Evaluación diaria</th>
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
                      <td>{s.dailyOvertime ? 'Extra' : 'Normal'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </details>
        <button
          className="secondary"
          onClick={() =>
            void saveFile(
              'mi-jornada-' + dateInput(estimate.week.startMs) + '.csv',
              csvWeek(state, estimate),
              'text/csv;charset=utf-8',
            ).catch((e) => setError(String(e)))
          }
        >
          <Download size={18} /> Guardar resumen para Excel
        </button>
        <small className="export-note">
          Se guarda como tabla CSV. Es una estimación de pago; no es tu declaración de impuestos.
        </small>
      </section>
    </>
  );
}
