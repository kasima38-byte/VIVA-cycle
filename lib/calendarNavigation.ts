// Hand-off from the Year Overview to the detailed Calendar.
//
// The Year Overview records the exact year + month (0-11) that was tapped. The Calendar is
// subscribed while it is mounted, so it switches to that month immediately - before the Year
// Overview even closes. The Calendar also checks on focus, as a backup (e.g. opened fresh).
// Whichever comes first takes the month ONCE; then it is cleared, so a stale pick never returns.

type PickedMonth = { year: number; monthIndex: number };

let pending: PickedMonth | null = null;
const listeners = new Set<() => void>();

export function setPendingMonth(year: number, monthIndex: number): void {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return;
  if (!Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) return;
  pending = { year, monthIndex };
  listeners.forEach((listener) => listener());
}

/** Returns the picked month once, then clears it. */
export function takePendingMonth(): PickedMonth | null {
  const picked = pending;
  pending = null;
  return picked;
}

/** The Calendar listens while mounted; returns the unsubscribe function. */
export function subscribePendingMonth(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
