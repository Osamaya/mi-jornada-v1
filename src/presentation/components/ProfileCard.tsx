import { useState, type FormEvent } from 'react';
import { UserRound } from 'lucide-react';
import { audit } from '../../application/commands';
import type { AppState } from '../../shared/models';

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/u)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => Array.from(part)[0])
      .join('')
      .toLocaleUpperCase('es') || 'MJ'
  );
}

export function ProfileCard({
  state,
  update,
}: {
  state: AppState;
  update: (mutate: (s: AppState) => void) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const displayName = String(new FormData(event.currentTarget).get('displayName') ?? '').trim();
    setBusy(true);
    try {
      await update((s) => {
        const before = { ...s.profile };
        s.profile = { displayName };
        audit(s, 'profile', 'personal-profile', before, s.profile, 'Nombre de uso actualizado');
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card profile-card">
      <div className="section-row">
        <div>
          <span className="eyebrow">TU ESPACIO</span>
          <h2>Hazla tuya</h2>
        </div>
        <span className="profile-avatar" aria-hidden="true">
          {state.profile.displayName ? (
            initials(state.profile.displayName)
          ) : (
            <UserRound size={24} />
          )}
        </span>
      </div>
      <p className="muted">Un nombre basta para que Mi Jornada se sienta más tuya.</p>
      <form onSubmit={save} key={state.profile.displayName}>
        <label>
          ¿Cómo te gusta que te llamen?
          <input
            name="displayName"
            autoComplete="given-name"
            maxLength={60}
            defaultValue={state.profile.displayName}
            placeholder="Tu nombre o apodo"
          />
          <small>Es opcional. Solo se guarda en este dispositivo y en tus respaldos.</small>
        </label>
        <button className="secondary" disabled={busy}>
          Guardar mi nombre
        </button>
      </form>
    </section>
  );
}
