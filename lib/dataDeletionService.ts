// VIVA Cycle - "Delete all my data" (one operation, used by the Privacy & Security screen).
//
// Removes every VIVA Cycle key from this phone (lib/vivaStore.ts deleteAllStoredData), cancels
// every scheduled reminder, and clears what is held in memory. Reports success only when all
// of it really happened. Call it only after her explicit confirmation (lib/useDeleteAllData.ts).

import { resetProfileExtras } from '../constants/profileStore';
import { DeleteAllResult } from './dataDeletion';
import {
  pauseSettingsWrites, reloadSettingsAfterFailedDeletion, resetSettingsAfterDeletion,
} from './dailyTrackingSettingsService';
import { cancelAllReminders, syncReminders } from './notifications';
import { deleteAllStoredData, getVivaState } from './vivaStore';
import { forgetDataKey } from './encryptionSetup';
import { forgetAppLock } from './appLockSession';

let running: Promise<DeleteAllResult> | null = null;

/** Safe to call twice: a second call while one is running gets the same result. */
export function deleteAllUserData(): Promise<DeleteAllResult> {
  if (!running) {
    running = run().finally(() => {
      running = null;
    });
  }
  return running;
}

async function run(): Promise<DeleteAllResult> {
  // 1. Reminders first, so none can fire about data that is being deleted
  let remindersCancelled = true;
  try {
    await cancelAllReminders();
  } catch {
    console.warn('VIVA: could not cancel reminders'); // never log the data itself
    remindersCancelled = false;
  }

  // 2. Every VIVA key on the phone (settings writes are paused so none can land afterwards)
  await pauseSettingsWrites();
  const wiped = await deleteAllStoredData();

  if (wiped.ok) {
    // Every record is gone; now the key too, so no leftover copy anywhere can be decrypted.
    // A key that won't delete unlocks nothing (there are no records), so this is not a failure.
    try {
      await forgetDataKey();
    } catch {
      console.warn('VIVA: could not remove the encryption key');
    }
    // App Lock settings go too: a fresh start has no PIN (her explicit, double-confirmed choice)
    try {
      await forgetAppLock();
    } catch {
      console.warn('VIVA: could not remove App Lock settings');
    }
    resetSettingsAfterDeletion();
    resetProfileExtras();
    return { status: remindersCancelled ? 'deleted' : 'failed', dataDeleted: 'all', remindersCancelled };
  }

  // 3. Failed or partial: the store now shows what is really saved. Put back the reminders
  //    she still has switched on, so cancelling them wasn't a silent side effect.
  await reloadSettingsAfterFailedDeletion();
  await syncReminders(getVivaState());
  return { status: 'failed', dataDeleted: wiped.deleted, remindersCancelled };
}
