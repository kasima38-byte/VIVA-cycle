// VIVA Cycle - every statement on the Privacy & Security screen (pure, so tests can check it).
//
// Each line must stay TRUE for the current app. Checked against the code (Oct 2026):
//  - all records are saved with AsyncStorage on the phone (lib/vivaStore.ts, lib/dailyStorage.ts);
//  - there is no backend, no account/login and no network code (no fetch, no analytics SDK);
//  - every saved value is encrypted with AES-256-GCM (expo-crypto) under one random key kept in
//    expo-secure-store (Keychain / Keystore), separate from the records (lib/cipher.ts,
//    lib/secureStorage.ts, lib/dataKey.ts, lib/encryptionSetup.ts). The key does NOT depend on
//    the PIN: App Lock is a separate door. Not end-to-end encryption (nothing is sent anywhere);
//  - Android: app.json allowBackup=false + plugins/withNoBackup.js data-extraction rules exclude all
//    app data from Google backup and device transfer (checked in the generated manifest by expo
//    prebuild; NOT yet checked on a real device). Existing backups are not removed. iOS unchanged:
//    iCloud / computer backups follow the phone's settings;
//  - permissions asked: notifications (lib/notifications.ts, only when a reminder is switched on)
//    and camera / photo library (app/personal-information.tsx, only when changing the photo).
// If any of that changes, update this file AND tests/privacySecurity.test.ts.

import type { ReminderSyncResult } from './notifications';

export type InfoItem = {
  icon: 'phone-portrait-outline' | 'person-circle-outline' | 'lock-closed-outline' | 'cloud-upload-outline'
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
      icon: 'lock-closed-outline',
      title: 'Encrypted on this phone',
      body:
        'VIVA Cycle encrypts the records it saves (AES-256-GCM). The key is kept in the phone\'s secure ' +
        'storage (iPhone Keychain / Android Keystore), separate from your records. This protects the saved ' +
        'files, for example a copy of the app\'s storage. It is not the same as end-to-end encryption, and it ' +
        "doesn't stop someone who can unlock this phone from opening the app: App Lock is for that.",
    },
    {
      icon: 'cloud-upload-outline',
      title: 'Backups',
      body:
        'On Android, VIVA Cycle asks the phone to leave its data out of Google backups and transfers to a new ' +
        "phone. This doesn't remove backups made before. On iPhone, iCloud and computer backups follow your " +
        'phone settings.',
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
        'Asked when you turn on a reminder. Reminders are scheduled on this phone and may show on your lock ' +
        'screen. Discreet Notifications decides how much they say.',
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

export const DISCREET = {
  sectionTitle: 'Notifications',
  sectionSubtitle: 'What your reminders show.',
  title: 'Discreet Notifications',
  description: 'Hide sensitive details in VIVA Cycle notifications.',
  onNote: 'On: every VIVA reminder only says "VIVA Cycle. You have a reminder." Open the app to see the details.',
  offNote:
    'Off: reminders can include details, such as estimated period or fertile-window dates, and may show on your ' +
    'lock screen.',
  scope: "This only changes reminder text. It doesn't hide anything inside the app once your phone is unlocked.",
  retry: 'Try again',
};

export type DiscreetNotice = { kind: 'error' | 'info'; text: string; canRetry: boolean };

/** What to tell her after the setting changes. Never says reminders were updated unless they were. */
export function discreetNotice(saved: boolean, sync: ReminderSyncResult | null): DiscreetNotice | null {
  if (!saved) return { kind: 'error', text: "We couldn't save this setting. Please try again.", canRetry: false };
  if (!sync || sync.status === 'ok') return null;
  if (sync.status === 'noPermission') {
    return {
      kind: 'info',
      text: 'Setting saved. Notifications are turned off for VIVA Cycle in your phone settings, so no reminders will show.',
      canRetry: false,
    };
  }
  if (sync.status === 'cancelFailed') {
    return {
      kind: 'error',
      text:
        "Setting saved, but we couldn't update reminders that were already scheduled, so some may still show " +
        'their old text. Try again, or turn off notifications for VIVA Cycle in your phone settings.',
      canRetry: true,
    };
  }
  return {
    kind: 'error',
    text: "Setting saved, but some of your reminders couldn't be scheduled again. Please try again.",
    canRetry: true,
  };
}
