// VIVA Cycle - the "Delete all my data" confirmation flow (pure, testable).
// The screen hook (lib/useDeleteAllData.ts) plugs in the phone's dialogs and navigation.
//
// Rules:
//  - nothing is deleted unless she confirms TWICE (closing a dialog counts as Cancel);
//  - the reusable deletion operation (lib/dataDeletionService.ts) does the deleting;
//  - "deleted" is only ever said when it is true (lib/dataDeletion.ts wording);
//  - she is sent to Welcome only when no VIVA data is left on the phone.

import { DELETE_ALL_CONFIRM, DELETE_ALL_FINAL, DeleteAllResult, deleteAllResultMessage } from './dataDeletion';

export type Dialog = { title: string; body: string; cancel: string; confirm: string };
export type Message = { title: string; body: string };

export type DeleteFlowDeps = {
  /** Show a dialog. Resolves true ONLY when she taps the confirm button. */
  ask: (dialog: Dialog) => Promise<boolean>;
  /** The reusable deletion operation. */
  run: () => Promise<DeleteAllResult>;
  /** Show the outcome. `then` runs after she dismisses it. */
  tell: (message: Message, then?: () => void) => void;
  /** Leave the screen for the safe place to start again (Welcome). */
  goToSafeScreen: () => void;
};

export type DeleteFlowOutcome = { kind: 'cancelled' } | { kind: 'finished'; result: DeleteAllResult; message: Message };

export const FIRST_DIALOG: Dialog = {
  title: DELETE_ALL_CONFIRM.title,
  body: DELETE_ALL_CONFIRM.body,
  cancel: DELETE_ALL_CONFIRM.cancel,
  confirm: DELETE_ALL_CONFIRM.continue,
};

export const FINAL_DIALOG: Dialog = {
  title: DELETE_ALL_FINAL.title,
  body: DELETE_ALL_FINAL.body,
  cancel: DELETE_ALL_FINAL.cancel,
  confirm: DELETE_ALL_FINAL.confirm,
};

const UNEXPECTED_FAILURE: DeleteAllResult = { status: 'failed', dataDeleted: 'nothing', remindersCancelled: false };

export async function runDeleteFlow(deps: DeleteFlowDeps): Promise<DeleteFlowOutcome> {
  if (!(await deps.ask(FIRST_DIALOG))) return { kind: 'cancelled' };
  if (!(await deps.ask(FINAL_DIALOG))) return { kind: 'cancelled' };

  let result: DeleteAllResult;
  try {
    result = await deps.run();
  } catch {
    // Something unexpected: we can't know what was removed, so we never say it was
    result = UNEXPECTED_FAILURE;
  }

  const message = deleteAllResultMessage(result);
  if (result.dataDeleted === 'all') deps.tell(message, deps.goToSafeScreen);
  else deps.tell(message); // stays on Privacy & Security so she can try again
  return { kind: 'finished', result, message };
}
