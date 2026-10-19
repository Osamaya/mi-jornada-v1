import { beforeEach, describe, expect, test } from 'vitest';
import initSqlJs, { type Database } from 'sql.js';
import { Repository } from '../src/infrastructure/database/repository';
import type { Driver, SqlValue } from '../src/infrastructure/database/driver';
import { finishSession, startSession } from '../src/application/commands';
import { localInstant } from '../src/domain/time';
import { HOUR } from '../src/shared/models';

let db: Database,
  repository: Repository,
  failInsert = false;
beforeEach(async () => {
  const SQL = await initSqlJs();
  db = new SQL.Database();
  const driver: Driver = {
    async execute(sql) {
      db.exec(sql);
    },
    async run(sql, values: SqlValue[] = []) {
      if (failInsert && sql.startsWith('INSERT INTO work_sessions'))
        throw new Error('Disco sin espacio');
      db.run(sql, values);
    },
    async query(sql, values = []) {
      const st = db.prepare(sql);
      try {
        st.bind(values);
        const result = [];
        while (st.step()) result.push(st.getAsObject());
        return result;
      } finally {
        st.free();
      }
    },
    async atomic(work) {
      db.run('BEGIN IMMEDIATE');
      try {
        const result = await work();
        db.run('COMMIT');
        return result;
      } catch (e) {
        db.run('ROLLBACK');
        throw e;
      }
    },
  };
  failInsert = false;
  repository = new Repository(driver);
});
const now = localInstant('2026-10-19T08:00');
describe('SQLite y transacciones del repositorio real', () => {
  test('migra una instalación v1 con jornada abierta y añade nombre sin perder datos', async () => {
    let state = await repository.load();
    state = await repository.update(state.revision, (s) => startSession(s, now));
    db.exec('DROP TABLE user_profile; DELETE FROM schema_migrations WHERE version=2;');
    const migrated = await repository.load();
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.profile.displayName).toBe('');
    expect(migrated.sessions).toEqual(state.sessions);
    const named = await repository.update(migrated.revision, (s) => {
      s.profile.displayName = 'José';
    });
    expect((await repository.load()).profile).toEqual(named.profile);
  });
  test('migra, inicia y recupera una jornada abierta desde SQLite', async () => {
    const state = await repository.load();
    const next = await repository.update(state.revision, (s) => startSession(s, now));
    const loaded = await repository.load();
    expect(loaded.sessions).toEqual(next.sessions);
    expect(loaded.sessions[0].endMs).toBeNull();
    expect(db.exec('SELECT count(*) FROM schema_migrations')[0].values[0][0]).toBe(2);
  });
  test('corrección y auditoría tienen un solo commit', async () => {
    let state = await repository.load();
    state = await repository.update(state.revision, (s) => startSession(s, now));
    state = await repository.update(state.revision, (s) =>
      finishSession(s, s.sessions[0].id, now + HOUR),
    );
    const saved = await repository.load();
    expect(saved.sessions[0].endMs).toBe(now + HOUR);
    expect(saved.audit).toHaveLength(2);
  });
  test('solapamiento y revisión vieja no modifican la base', async () => {
    const initial = await repository.load();
    const next = await repository.update(initial.revision, (s) => startSession(s, now));
    await expect(
      repository.update(initial.revision, (s) => startSession(s, now + HOUR)),
    ).rejects.toThrow(/cambiaron/);
    await expect(
      repository.update(next.revision, (s) => {
        s.sessions.push({ ...s.sessions[0], id: 'overlap' });
      }),
    ).rejects.toThrow(/solapan/);
    expect(await repository.load()).toEqual(next);
  });
  test('falla a mitad de escritura restaura todas las tablas', async () => {
    const initial = await repository.load();
    failInsert = true;
    await expect(repository.update(initial.revision, (s) => startSession(s, now))).rejects.toThrow(
      'Disco sin espacio',
    );
    failInsert = false;
    expect(await repository.load()).toEqual(initial);
    expect(db.exec('PRAGMA integrity_check')[0].values[0][0]).toBe('ok');
  });
  test('restauración guarda copia previa y auditoría sin borrar fichajes silenciosamente', async () => {
    let state = await repository.load();
    const original = structuredClone(state);
    state = await repository.update(state.revision, (s) => startSession(s, now));
    const next = await repository.restoreWithRecovery(state.revision, original);
    expect(next.sessions).toHaveLength(0);
    expect(next.revision).toBe(state.revision + 1);
    expect(next.audit.at(-1)?.action).toBe('restore');
    expect(await repository.lastRecovery()).toEqual(state);
  });
  test('respaldo inválido o vista previa obsoleta conserva original', async () => {
    let state = await repository.load();
    const imported = structuredClone(state);
    state = await repository.update(state.revision, (s) => startSession(s, now));
    await expect(repository.restoreWithRecovery(state.revision - 1, imported)).rejects.toThrow(
      /cambiaron/,
    );
    const corrupt = { ...imported, schemaVersion: 99 };
    await expect(
      repository.restoreWithRecovery(state.revision, corrupt as never),
    ).rejects.toThrow();
    expect(await repository.load()).toEqual(state);
  });
});
