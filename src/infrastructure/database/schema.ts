/** Migración instalada v1. docs/schema.sql se conserva como propuesta histórica. */
export const migration1 = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at_ms INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS app_state (singleton INTEGER PRIMARY KEY CHECK(singleton=1), revision INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS employment_settings (id TEXT PRIMARY KEY NOT NULL, effective_from_ms INTEGER NOT NULL UNIQUE, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payroll_settings (id TEXT PRIMARY KEY NOT NULL, effective_from_ms INTEGER NOT NULL UNIQUE, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pay_rate_history (id TEXT PRIMARY KEY NOT NULL, effective_from_ms INTEGER NOT NULL UNIQUE, hourly_cents INTEGER NOT NULL CHECK(hourly_cents>0), payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS work_sessions (id TEXT PRIMARY KEY NOT NULL, start_ms INTEGER NOT NULL, end_ms INTEGER CHECK(end_ms IS NULL OR end_ms>start_ms), voided_at_ms INTEGER, payload TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_session ON work_sessions((1)) WHERE end_ms IS NULL AND voided_at_ms IS NULL;
CREATE TABLE IF NOT EXISTS break_periods (id TEXT PRIMARY KEY NOT NULL, session_id TEXT NOT NULL REFERENCES work_sessions(id), start_ms INTEGER NOT NULL, end_ms INTEGER CHECK(end_ms IS NULL OR end_ms>start_ms), voided_at_ms INTEGER, payload TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_break ON break_periods(session_id) WHERE end_ms IS NULL AND voided_at_ms IS NULL;
CREATE TABLE IF NOT EXISTS weekly_payment_records (id TEXT PRIMARY KEY NOT NULL, week_start_ms INTEGER NOT NULL UNIQUE, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY NOT NULL, at_ms INTEGER NOT NULL, payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS recovery_snapshots (id TEXT PRIMARY KEY NOT NULL, at_ms INTEGER NOT NULL, payload TEXT NOT NULL);
`;
