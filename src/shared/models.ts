export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const WEEK = 7 * DAY;
export const ZONE = 'America/Los_Angeles';
export interface EmploymentSettings {
  id: string;
  effectiveFromMs: number;
  zone: typeof ZONE;
  weekAnchorMs: number;
  weekConfirmed: boolean;
  coverageConfirmed: boolean;
  mode: 'standard' | 'four-ten';
  agreementConfirmed: boolean;
  scheduledDays: number[];
}
export interface PayrollSettings {
  id: string;
  effectiveFromMs: number;
  ficaConfirmed: boolean;
  federalBps: number;
  federalConfirmed: boolean;
  otherWeeklyCents: number;
}
export interface PayRate {
  id: string;
  effectiveFromMs: number;
  hourlyCents: number;
}
export interface WorkSession {
  id: string;
  startMs: number;
  endMs: number | null;
  zone: typeof ZONE;
  source: 'clock' | 'manual';
  note: string;
  revision: number;
  voidedAtMs: number | null;
}
export interface BreakPeriod {
  id: string;
  sessionId: string;
  startMs: number;
  endMs: number | null;
  kind: 'meal-on-duty' | 'short-rest' | 'unpaid-meal';
  revision: number;
  voidedAtMs: number | null;
}
export interface WeeklyPaymentRecord {
  id: string;
  weekStartMs: number;
  payDate: string | null;
  ytdBeforeCents: number | null;
  receivedNetCents: number | null;
}
export interface AuditEvent {
  id: string;
  atMs: number;
  action: string;
  entityId: string;
  reason: string;
  beforeJson: string | null;
  afterJson: string | null;
}
export interface AppState {
  schemaVersion: 1;
  revision: number;
  employment: EmploymentSettings[];
  payroll: PayrollSettings[];
  rates: PayRate[];
  sessions: WorkSession[];
  breaks: BreakPeriod[];
  payments: WeeklyPaymentRecord[];
  audit: AuditEvent[];
}
export interface Interval {
  startMs: number;
  endMs: number;
}
export interface PaySegment extends Interval {
  sessionId: string;
  breakId: string | null;
  hourlyCents: number | null;
  paid: boolean;
  active: boolean;
  dailyOvertime: boolean;
  workdayStartMs: number;
}
export interface WeekEstimate {
  week: Interval;
  paidMs: number;
  activeMs: number;
  presenceMs: number;
  dailyExtraMs: number;
  weeklyExtraMs: number;
  ordinaryMs: number | null;
  extraMs: number | null;
  baseCents: number | null;
  premiumCents: number | null;
  grossCents: number | null;
  baseExact: { numerator: string; denominator: string };
  segments: PaySegment[];
  warnings: string[];
  explanation: string[];
  provisional: boolean;
  ruleVersion: string;
}
export interface Deductions {
  socialSecurity: number | null;
  medicare: number | null;
  additionalMedicare: number | null;
  federal: number | null;
  state: number;
  other: number;
  net: number | null;
  warnings: string[];
}
export function atDate<T extends { effectiveFromMs: number }>(
  values: T[],
  atMs: number,
): T | undefined {
  return [...values]
    .sort((a, b) => b.effectiveFromMs - a.effectiveFromMs)
    .find((v) => v.effectiveFromMs <= atMs);
}
