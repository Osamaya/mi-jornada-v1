import type { AppState } from '../../shared/models';
import { initialState } from '../../application/defaults';
import { audit, uid } from '../../application/commands';
import { upgradeState, validateState } from '../../domain/work/validate';
import type { Driver } from './driver';
import { migration1, migration2 } from './schema';

const tables = {
  employment: 'employment_settings',
  payroll: 'payroll_settings',
  rates: 'pay_rate_history',
  sessions: 'work_sessions',
  breaks: 'break_periods',
  payments: 'weekly_payment_records',
  audit: 'audit_events',
} as const;
export class Repository {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private driver: Driver) {}
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const task = this.queue.then(work, work);
    this.queue = task.catch(() => {});
    return task;
  }
  private async migrate() {
    await this.driver.execute(migration1);
    const versions = await this.driver.query('SELECT version FROM schema_migrations');
    if (versions.some((v) => v.version !== 1 && v.version !== 2))
      throw new Error('La base requiere una versión más reciente de Mi Jornada.');
    if (!versions.length)
      await this.driver.run('INSERT INTO schema_migrations VALUES(1,?)', [Date.now()]);
    if (!versions.some((v) => v.version === 2)) {
      await this.driver.execute(migration2);
      await this.driver.run('INSERT INTO schema_migrations VALUES(2,?)', [Date.now()]);
    }
  }
  private async read(): Promise<AppState | null> {
    const revision = (
      await this.driver.query('SELECT revision FROM app_state WHERE singleton=1')
    )[0]?.revision;
    if (revision === undefined) return null;
    const state: AppState = {
      schemaVersion: 2,
      revision: Number(revision),
      profile: {
        displayName: String(
          (await this.driver.query('SELECT display_name FROM user_profile WHERE singleton=1'))[0]
            ?.display_name ?? '',
        ),
      },
      employment: [],
      payroll: [],
      rates: [],
      sessions: [],
      breaks: [],
      payments: [],
      audit: [],
    };
    for (const [key, table] of Object.entries(tables)) {
      const rows = await this.driver.query(`SELECT payload FROM ${table}`);
      (state as unknown as Record<string, unknown>)[key] = rows.map((row) =>
        JSON.parse(String(row.payload)),
      );
    }
    validateState(state);
    return state;
  }
  private async write(state: AppState) {
    await this.driver.run('INSERT OR REPLACE INTO user_profile VALUES(1,?)', [
      state.profile.displayName,
    ]);
    // Reemplazo pequeño y atómico de un único perfil; conserva recovery_snapshots.
    for (const table of [
      'break_periods',
      'work_sessions',
      'employment_settings',
      'payroll_settings',
      'pay_rate_history',
      'weekly_payment_records',
      'audit_events',
    ])
      await this.driver.execute(`DELETE FROM ${table};`);
    for (const s of state.employment)
      await this.driver.run('INSERT INTO employment_settings VALUES(?,?,?)', [
        s.id,
        s.effectiveFromMs,
        JSON.stringify(s),
      ]);
    for (const s of state.payroll)
      await this.driver.run('INSERT INTO payroll_settings VALUES(?,?,?)', [
        s.id,
        s.effectiveFromMs,
        JSON.stringify(s),
      ]);
    for (const r of state.rates)
      await this.driver.run('INSERT INTO pay_rate_history VALUES(?,?,?,?)', [
        r.id,
        r.effectiveFromMs,
        r.hourlyCents,
        JSON.stringify(r),
      ]);
    for (const s of state.sessions)
      await this.driver.run('INSERT INTO work_sessions VALUES(?,?,?,?,?)', [
        s.id,
        s.startMs,
        s.endMs,
        s.voidedAtMs,
        JSON.stringify(s),
      ]);
    for (const b of state.breaks)
      await this.driver.run('INSERT INTO break_periods VALUES(?,?,?,?,?,?)', [
        b.id,
        b.sessionId,
        b.startMs,
        b.endMs,
        b.voidedAtMs,
        JSON.stringify(b),
      ]);
    for (const p of state.payments)
      await this.driver.run('INSERT INTO weekly_payment_records VALUES(?,?,?)', [
        p.id,
        p.weekStartMs,
        JSON.stringify(p),
      ]);
    for (const a of state.audit)
      await this.driver.run('INSERT INTO audit_events VALUES(?,?,?)', [
        a.id,
        a.atMs,
        JSON.stringify(a),
      ]);
    await this.driver.run('INSERT OR REPLACE INTO app_state VALUES(1,?)', [state.revision]);
  }
  load(): Promise<AppState> {
    return this.exclusive(async () => {
      await this.driver.refresh?.();
      return this.driver.atomic(async () => {
        await this.migrate();
        const stored = await this.read();
        if (stored) return stored;
        const state = initialState();
        await this.write(state);
        return state;
      });
    });
  }
  update(expectedRevision: number, mutate: (state: AppState) => void): Promise<AppState> {
    return this.exclusive(async () => {
      await this.driver.refresh?.();
      return this.driver.atomic(async () => {
        await this.migrate();
        const current = await this.read();
        if (!current || current.revision !== expectedRevision)
          throw new Error('Los datos cambiaron. Actualiza la pantalla y vuelve a intentar.');
        const next = structuredClone(current);
        mutate(next);
        next.revision = current.revision + 1;
        validateState(next);
        await this.write(next);
        return next;
      });
    });
  }
  restoreWithRecovery(expectedRevision: number, imported: AppState): Promise<AppState> {
    return this.exclusive(async () => {
      validateState(imported);
      await this.driver.refresh?.();
      return this.driver.atomic(async () => {
        await this.migrate();
        const current = await this.read();
        if (!current || current.revision !== expectedRevision)
          throw new Error(
            'Los datos cambiaron desde la vista previa. Vuelve a revisar la restauración.',
          );
        const recoveryId = uid();
        await this.driver.run('INSERT INTO recovery_snapshots VALUES(?,?,?)', [
          recoveryId,
          Date.now(),
          JSON.stringify(current),
        ]);
        const next = structuredClone(imported);
        next.revision = current.revision + 1;
        audit(
          next,
          'restore',
          recoveryId,
          null,
          { sessions: next.sessions.length },
          'Respaldo validado restaurado; copia previa conservada',
        );
        validateState(next);
        await this.write(next);
        return next;
      });
    });
  }
  lastRecovery(): Promise<AppState | null> {
    return this.exclusive(async () => {
      await this.driver.refresh?.();
      const row = (
        await this.driver.query(
          'SELECT payload FROM recovery_snapshots ORDER BY at_ms DESC LIMIT 1',
        )
      )[0];
      if (!row) return null;
      return upgradeState(JSON.parse(String(row.payload)));
    });
  }
}
