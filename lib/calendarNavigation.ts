// Hand-off from the Year Overview back to the detailed Calendar:
// the Year Overview stores the picked month, the Calendar takes it when it regains focus.

let pending: { year: number; monthIndex: number } | null = null;

export function setPendingMonth(year: number, monthIndex: number): void {
  pending = { year, monthIndex };
}

/** Returns the picked month once, then clears it. */
export function takePendingMonth(): { year: number; monthIndex: number } | null {
  const picked = pending;
  pending = null;
  return picked;
}
