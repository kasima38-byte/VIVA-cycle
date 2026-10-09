// VIVA Cycle - every statement on the Privacy & Security screen (pure, so tests can check it).
//
// Each line must stay TRUE for the current app. Checked against the code (Oct 2026):
//  - all records are saved with AsyncStorage on the phone (lib/vivaStore.ts, lib/dailyStorage.ts);
//  - there is no backend, no account/login and no network code (no fetch, no analytics SDK);
//  - VIVA adds no encryption of its own;
//  - app.json sets no backup rule, so the phone's backup settings decide (not verified on a build);
//  - permissions asked: notifications (lib/notifications.ts, only when a reminder is switched on)
//    and camera / photo library (app/personal-information.tsx, only when changing the photo).
// If any of that changes, update this file AND tests/privacySecurity.test.ts.

export type InfoItem = {
  icon: 'phone-portrait-outline' | 'person-circle-outline' | 'lock-open-outline' | 'cloud-upload-outline'
    | 'notifications-outline' | 'camera-outline';
  title: string;
  body: string;
};

export const PRIVACY_HEADER = {
  title: 'Privacy & Security',
  subtitle: 'How VIVA Cycle handles your data.',
  introTitle: 'Your privacy, explained',
  introBody: 'What VIVA Cycle stores, what it asks permission for, and how to delete it.',
};

export const YOUR_DATA: { title: string; subtitle: string; items: InfoItem[] } = {
  title: 'Your Data',
  subtitle: 'Where your information is kept.',
  items: [
    {
      icon: 'phone-portrait-outline',
      title: 'Stored on this phone',
      body:
        'Your periods, Daily Tracking, cycle settings and profile details are saved on this phone, ' +
        "in the app's local storage (AsyncStorage).",
    },
    {
      icon: 'person-circle-outline',
      title: 'No account or VIVA server',
      body:
        "VIVA Cycle has no account or login, and the app doesn't send your records to a VIVA server.",
    },
    {
      icon: 'lock-open-outline',
      title: 'Not end-to-end encrypted',
      body:
        "Local storage is not the same as end-to-end encryption. VIVA Cycle doesn't add its own encryption, " +
        'so anyone who can unlock and use this phone may be able to open the app.',
    },
    {
      icon: 'cloud-upload-outline',
      title: 'Phone backups',
      body:
        "Your phone's own backup settings, such as Google or iCloud backup, may include app data. " +
        'Those backups are controlled by your phone, not by VIVA Cycle.',
    },
  ],
};

export const PERMISSIONS: { title: string; subtitle: string; items: InfoItem[]; settingsButton: string } = {
  title: 'Permissions',
  subtitle: 'VIVA Cycle only asks when you use a feature that needs it.',
  items: [
    {
      icon: 'notifications-outline',
      title: 'Notifications',
      body:
        'Asked when you turn on a reminder. Reminders are scheduled on this phone. Their text, such as a period ' +
        'or fertile-window estimate, may show on your lock screen.',
    },
    {
      icon: 'camera-outline',
      title: 'Camera and photos',
      body: 'Asked only when you take or choose a profile photo. The photo is used for your profile picture.',
    },
  ],
  settingsButton: 'Open phone settings',
};

export const MANAGE_DATA = {
  title: 'Manage Your Data',
  subtitle: 'Remove what VIVA Cycle stores on this phone.',
  deleteTitle: 'Delete all my data',
  deleteBody: 'Deletes your records and settings from this phone and cancels your reminders.',
  deletingLabel: 'Deleting…',
  note: "You'll be asked to confirm twice. Nothing is deleted until you do. This can't be undone.",
};
