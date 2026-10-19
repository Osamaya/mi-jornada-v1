import initSqlJs, { type Database } from 'sql.js';
import { Capacitor } from '@capacitor/core';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
export type SqlValue = string | number | null;
export interface Driver {
  execute(sql: string): Promise<void>;
  run(sql: string, values?: SqlValue[]): Promise<void>;
  query(sql: string, values?: SqlValue[]): Promise<Record<string, unknown>[]>;
  atomic<T>(work: () => Promise<T>): Promise<T>;
  refresh?(): Promise<void>;
}
function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('mi-jornada-local', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('sqlite');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
interface Stored {
  revision: number;
  bytes: Uint8Array;
}
async function readBytes(): Promise<Stored | undefined> {
  const db = await idbOpen();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction('sqlite', 'readonly').objectStore('sqlite').get('mijornada');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
async function writeBytes(bytes: Uint8Array, expected: number): Promise<void> {
  const db = await idbOpen();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sqlite', 'readwrite'),
        store = tx.objectStore('sqlite');
      let conflict = false;
      const r = store.get('mijornada');
      r.onsuccess = () => {
        if ((r.result?.revision ?? 0) !== expected) {
          conflict = true;
          tx.abort();
        } else store.put({ revision: expected + 1, bytes }, 'mijornada');
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(
          new Error(
            conflict
              ? 'Los datos cambiaron en otra pestaña. Actualiza y vuelve a intentar.'
              : 'No se pudo guardar. Revisa el espacio disponible.',
          ),
        );
    });
  } finally {
    db.close();
  }
}
export async function webDriver(): Promise<Driver> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  let db: Database;
  let storedRevision = 0;
  const driver: Driver = {
    async refresh() {
      const stored = await readBytes();
      const next = stored ? new SQL.Database(stored.bytes) : new SQL.Database();
      if (db) db.close();
      db = next;
      storedRevision = stored?.revision ?? 0;
      db.run('PRAGMA foreign_keys=ON');
    },
    async execute(sql) {
      db.exec(sql);
    },
    async run(sql, values = []) {
      db.run(sql, values);
    },
    async query(sql, values = []) {
      const stmt = db.prepare(sql);
      try {
        stmt.bind(values);
        const rows: Record<string, unknown>[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        return rows;
      } finally {
        stmt.free();
      }
    },
    async atomic(work) {
      const before = db.export();
      db.run('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE');
      try {
        const result = await work();
        db.run('COMMIT');
        await writeBytes(db.export(), storedRevision);
        storedRevision++;
        return result;
      } catch (error) {
        db.close();
        db = new SQL.Database(before);
        db.run('PRAGMA foreign_keys=ON');
        throw error;
      }
    },
  };
  await driver.refresh!();
  return driver;
}
export async function openDriver(): Promise<Driver> {
  if (!Capacitor.isNativePlatform()) return webDriver();
  const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  const db = await sqlite.createConnection('mijornada', false, 'no-encryption', 1, false);
  await db.open();
  await db.execute('PRAGMA foreign_keys = ON;', false);
  return {
    async execute(sql) {
      await db.execute(sql, false);
    },
    async run(sql, values = []) {
      await db.run(sql, values, false);
    },
    async query(sql, values = []) {
      return (await db.query(sql, values)).values ?? [];
    },
    async atomic(work) {
      await db.beginTransaction();
      try {
        const result = await work();
        await db.commitTransaction();
        return result;
      } catch (error) {
        try {
          await db.rollbackTransaction();
        } catch {
          /* mantener error original */
        }
        throw error;
      }
    },
  };
}
