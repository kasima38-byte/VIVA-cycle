// VIVA Cycle - "Export my data" flow (pure, testable). lib/useExportData.ts plugs in the phone.
//
// Rules:
//  - she is told exactly what the file holds, and can cancel, BEFORE any file is created;
//  - export only READS the store: it never changes or deletes her records;
//  - the file goes only where she sends it from the phone's share sheet (no server);
//  - never "success": the share sheet doesn't tell the app whether she saved, sent or cancelled;
//  - failures are reported honestly, and the file is removed if sharing didn't open;
//  - nothing from the export is ever logged.

import type { DailyTrackingSettings } from './dailyTrackingSettings';
import { buildExport, describeExport, exportContents, exportFileName } from './myData';
import type { VivaState } from './vivaStore';

export type ExportIO = {
  /** Can this phone open a share sheet for files? */
  canShare: () => Promise<boolean>;
  /** Write the text to a private temporary file (old exports removed first). Returns its uri. */
  writeFile: (name: string, text: string) => string;
  /** Open the share sheet for the file. Resolves when the sheet closes. */
  share: (uri: string) => Promise<void>;
  /** Remove a temporary export file. */
  remove: (uri: string) => void;
  /** True when the file can be removed as soon as the sheet closes (iOS copies it first). */
  removeAfterShare: boolean;
};

export type ExportDeps = {
  getState: () => VivaState;
  getSettings: () => DailyTrackingSettings;
  now: () => Date;
  /** Show the explanation. Resolves true only when she taps Continue. */
  ask: (title: string, body: string) => Promise<boolean>;
  io: ExportIO;
};

export type ExportFailure = 'notReady' | 'unavailable' | 'write' | 'share';
export type ExportOutcome = { kind: 'cancelled' } | { kind: 'offered' } | { kind: 'failed'; reason: ExportFailure };

export async function runExportFlow(deps: ExportDeps): Promise<ExportOutcome> {
  const state = deps.getState();
  if (!state.loaded || state.loadError) return { kind: 'failed', reason: 'notReady' };

  const about = describeExport(exportContents(state));
  if (!(await deps.ask(about.title, about.body))) return { kind: 'cancelled' };

  try {
    if (!(await deps.io.canShare())) return { kind: 'failed', reason: 'unavailable' };
  } catch {
    return { kind: 'failed', reason: 'unavailable' };
  }

  const now = deps.now();
  let uri: string;
  try {
    // Read again: the export holds what is saved at the moment she confirmed
    const text = JSON.stringify(buildExport(deps.getState(), deps.getSettings(), now), null, 2);
    uri = deps.io.writeFile(exportFileName(now), text);
  } catch {
    console.warn('VIVA: could not create the export file'); // never log the export
    return { kind: 'failed', reason: 'write' };
  }

  try {
    await deps.io.share(uri);
  } catch {
    console.warn('VIVA: could not open sharing for the export');
    try { deps.io.remove(uri); } catch { /* removed with the next export */ }
    return { kind: 'failed', reason: 'share' };
  }
  if (deps.io.removeAfterShare) {
    try { deps.io.remove(uri); } catch { /* removed with the next export */ }
  }
  return { kind: 'offered' };
}

/** What she sees afterwards. Never claims the file was saved or sent. */
export function exportMessage(o: ExportOutcome): { kind: 'error' | 'info'; text: string } | null {
  if (o.kind === 'cancelled') return null;
  if (o.kind === 'offered') {
    return {
      kind: 'info',
      text: 'If you saved or shared the file, keep it somewhere private. It contains sensitive health information.',
    };
  }
  const text: Record<ExportFailure, string> = {
    notReady: "Your data isn't loaded yet, so nothing was exported. Please try again.",
    unavailable: "Sharing files isn't available on this phone, so nothing was exported.",
    write: "We couldn't create the export file, so nothing was exported. Please try again.",
    share: "We couldn't open the share options, so nothing was exported. Please try again.",
  };
  return { kind: 'error', text: text[o.reason] };
}
