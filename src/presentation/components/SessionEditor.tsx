import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { localInput, localInstant } from '../../domain/time';
import { uid } from '../../application/commands';
import { ZONE, type AppState, type BreakPeriod, type WorkSession } from '../../shared/models';

export function SessionEditor({
  state,
  session,
  onClose,
  onSave,
  externalError,
}: {
  state: AppState;
  session: WorkSession | null;
  onClose: () => void;
  onSave: (session: WorkSession, breaks: BreakPeriod[], reason: string) => Promise<boolean>;
  externalError?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [breaks, setBreaks] = useState(() =>
    state.breaks
      .filter((b) => b.sessionId === session?.id && b.voidedAtMs === null)
      .map((b) => ({
        ...b,
        start: localInput(b.startMs),
        end: b.endMs === null ? '' : localInput(b.endMs),
      })),
  );
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const f = new FormData(event.currentTarget),
        get = (key: string) => String(f.get(key) ?? '');
      const disambiguation = get('offset') as 'reject' | 'earlier' | 'later';
      // Editar una nota no redondea los segundos/milisegundos del fichaje original.
      const resolve = (value: string, original?: number | null) =>
        original != null && value === localInput(original)
          ? original
          : localInstant(value, disambiguation);
      const next: WorkSession = {
        id: session?.id ?? uid(),
        startMs: resolve(get('start'), session?.startMs),
        endMs: get('end') ? resolve(get('end'), session?.endMs) : null,
        zone: ZONE,
        source: session?.source ?? 'manual',
        note: get('note'),
        revision: session?.revision ?? 0,
        voidedAtMs: null,
      };
      const nextBreaks: BreakPeriod[] = breaks.map((b) => ({
        id: b.id,
        sessionId: next.id,
        startMs: resolve(b.start, b.startMs),
        endMs: b.end ? resolve(b.end, b.endMs) : null,
        kind: b.kind,
        revision: b.revision,
        voidedAtMs: null,
      }));
      if (await onSave(next, nextBreaks, get('reason'))) onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog ref={dialog} className="editor" onCancel={onClose} aria-labelledby="editor-title">
      <div className="dialog-head">
        <div>
          <span className="eyebrow">REGISTRO DE TIEMPO</span>
          <h2 id="editor-title">{session ? 'Editar jornada' : 'Agregar jornada'}</h2>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Cerrar">
          <X />
        </button>
      </div>
      <form onSubmit={submit}>
        <p className="muted">
          Fechas y horas de Las Vegas. Para cruzar medianoche, selecciona la fecha del día
          siguiente.
        </p>
        <div className="form-grid">
          <label>
            Entrada
            <input
              name="start"
              type="datetime-local"
              defaultValue={session ? localInput(session.startMs) : localInput(Date.now())}
              required
            />
          </label>
          <label>
            Salida
            <input
              name="end"
              type="datetime-local"
              aria-label="Salida"
              aria-describedby="exit-help"
              defaultValue={session?.endMs ? localInput(session.endMs) : ''}
            />
            <small id="exit-help">Vacía si la jornada sigue abierta.</small>
          </label>
        </div>
        <label>
          Nota opcional
          <input
            name="note"
            maxLength={2000}
            defaultValue={session?.note ?? ''}
            placeholder="Por ejemplo, trabajo en taller"
          />
        </label>
        <div className="section-row">
          <h3>Descansos</h3>
          <button
            type="button"
            className="text-button"
            onClick={() =>
              setBreaks([
                ...breaks,
                {
                  id: uid(),
                  sessionId: session?.id ?? '',
                  startMs: 0,
                  endMs: null,
                  kind: 'meal-on-duty',
                  revision: 0,
                  voidedAtMs: null,
                  start: session ? localInput(session.startMs) : localInput(Date.now()),
                  end: '',
                },
              ])
            }
          >
            <Plus size={18} /> Agregar
          </button>
        </div>
        {breaks.map((b, index) => (
          <fieldset className="break-editor" key={b.id}>
            <legend>Descanso {index + 1}</legend>
            <label>
              Tipo
              <select
                value={b.kind}
                onChange={(e) =>
                  setBreaks(
                    breaks.map((x) =>
                      x.id === b.id ? { ...x, kind: e.target.value as BreakPeriod['kind'] } : x,
                    ),
                  )
                }
              >
                <option value="meal-on-duty">Comida pagada, con obligaciones</option>
                <option value="short-rest">Descanso corto pagado</option>
                <option value="unpaid-meal">Comida libre no pagada (mín. 30 min)</option>
              </select>
            </label>
            <div className="form-grid">
              <label>
                Inicio del descanso
                <input
                  type="datetime-local"
                  required
                  value={b.start}
                  onChange={(e) =>
                    setBreaks(
                      breaks.map((x) => (x.id === b.id ? { ...x, start: e.target.value } : x)),
                    )
                  }
                />
              </label>
              <label>
                Fin del descanso
                <input
                  type="datetime-local"
                  value={b.end}
                  onChange={(e) =>
                    setBreaks(
                      breaks.map((x) => (x.id === b.id ? { ...x, end: e.target.value } : x)),
                    )
                  }
                />
              </label>
            </div>
            <button
              type="button"
              className="danger text-button"
              onClick={() => setBreaks(breaks.filter((x) => x.id !== b.id))}
            >
              <Trash2 size={16} /> Quitar descanso
            </button>
          </fieldset>
        ))}
        <details>
          <summary>Si la hora coincide con un cambio de horario</summary>
          <label>
            Hora repetida
            <select name="offset">
              <option value="reject">Detectar y pedir revisión</option>
              <option value="earlier">Primera ocurrencia</option>
              <option value="later">Segunda ocurrencia</option>
            </select>
          </label>
          <p className="muted">
            Usa una ocurrencia solo para horas repetidas de otoño. Las horas inexistentes de
            primavera siempre se rechazan.
          </p>
        </details>
        <label>
          Motivo del registro o corrección
          <input
            name="reason"
            required
            maxLength={2000}
            defaultValue={session ? '' : 'Registro manual'}
            placeholder="Por ejemplo, olvidé registrar la salida"
          />
        </label>
        {(error || externalError) && (
          <p className="alert error" role="alert">
            {error || externalError}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancelar
          </button>
          <button disabled={busy} type="submit" className="primary">
            {busy ? 'Guardando…' : 'Guardar jornada'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
