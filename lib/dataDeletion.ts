// VIVA Cycle - "Delete all my data": result shape and every word she sees (pure, testable).
// Wording rules: say exactly what was removed, never claim more. The app can only delete what
// it stores on this phone, so it never claims to remove phone or cloud backups.

export type DeleteAllResult = {
  /** 'deleted' only when every VIVA key is gone AND every reminder is cancelled. */
  status: 'deleted' | 'failed';
  /** all: no VIVA key left on the phone. partial: some removed, some left. nothing: unchanged. */
  dataDeleted: 'all' | 'partial' | 'nothing';
  remindersCancelled: boolean;
};

export const DELETE_ALL_CONFIRM = {
  title: 'Delete all your VIVA Cycle data?',
  body:
    'This removes all VIVA Cycle records and settings stored on this phone: your periods, Daily Tracking, ' +
    'cycle settings, goal, profile details and reminder choices.\n\n' +
    'All scheduled VIVA reminders will be cancelled.\n\n' +
    "This can't be undone. It only removes what the VIVA Cycle app stores on this phone, not copies " +
    'made outside the app, such as phone or cloud backups.',
  cancel: 'Cancel',
  continue: 'Continue',
};

export const DELETE_ALL_FINAL = {
  title: 'Are you sure?',
  body: "Your VIVA Cycle data will be permanently deleted from this phone. You can't get it back.",
  cancel: 'Cancel',
  confirm: 'Delete Everything',
};

/** What to tell her afterwards. Never says "deleted" unless it really all was. */
export function deleteAllResultMessage(r: DeleteAllResult): { title: string; body: string } {
  if (r.status === 'deleted') {
    return {
      title: 'Your data has been deleted',
      body: 'All VIVA Cycle records and settings on this phone have been removed, and your reminders are cancelled.',
    };
  }
  if (r.dataDeleted === 'all') {
    return {
      title: 'Data deleted, but reminders may still appear',
      body:
        'All VIVA Cycle records and settings on this phone have been removed, but we couldn\'t confirm that every ' +
        'scheduled reminder was cancelled. You can turn off notifications for VIVA Cycle in your phone settings.',
    };
  }
  if (r.dataDeleted === 'nothing') {
    return {
      title: 'Nothing was deleted',
      body: "We couldn't delete your data, so nothing was changed. Please try again.",
    };
  }
  return {
    title: 'Not all of your data was deleted',
    body:
      'Some VIVA Cycle data is still stored on this phone. What remains is shown in the app. Please try again.',
  };
}
