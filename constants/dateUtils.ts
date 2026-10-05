// Calendar dates are plain "YYYY-MM-DD" strings. All arithmetic is done in UTC
// so the phone's time zone and daylight saving can never shift a date by a day.

import { todayLocal } from '../lib/cycleEngine';

const MS_PER_DAY = 86400000;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function parseDateKey(key: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return { y, m, d };
}

export function isValidDateKey(key: string): boolean {
  return parseDateKey(key) !== null;
}

function toUtcMs(key: string): number {
  const p = parseDateKey(key);
  if (!p) throw new Error('Invalid date: ' + key);
  return Date.UTC(p.y, p.m - 1, p.d);
}

function fromUtcMs(ms: number): string {
  const d = new Date(ms);
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}

export function addDays(key: string, days: number): string {
  return fromUtcMs(toUtcMs(key) + days * MS_PER_DAY);
}

// Whole days from a to b (positive when b is later).
export function dayDiff(a: string, b: string): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / MS_PER_DAY);
}

// The calendar date a person sees on their wall clock. Never use
// toISOString() for this: it converts to UTC and can return the wrong day.
export function dateToKey(d: Date): string {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

// A local-midnight Date for a key, for date pickers.
export function keyToLocalDate(key: string): Date {
  const p = parseDateKey(key);
  if (!p) throw new Error('Invalid date: ' + key);
  return new Date(p.y, p.m - 1, p.d);
}

// One source for "today" (the DEV_TODAY switch lives in lib/cycleEngine.ts)
export function getToday(): string {
  return todayLocal();
}
