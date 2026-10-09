// VIVA Cycle - the phone side of "Export my data" (expo-file-system + expo-sharing, SDK 57).
// The file is written to the app's private CACHE folder (not backed up; the phone may clear it),
// in its own sub-folder that is emptied before every export, so at most one export file exists.

import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { ExportIO } from './exportFlow';

const exportDir = () => new Directory(Paths.cache, 'viva-export');

export const phoneExportIO: ExportIO = {
  canShare: () => Sharing.isAvailableAsync(),

  writeFile(name, text) {
    const dir = exportDir();
    if (dir.exists) dir.delete(); // remove any earlier export
    dir.create({ intermediates: true });
    const file = new File(dir, name);
    file.create();
    file.write(text);
    return file.uri;
  },

  share: (uri) =>
    Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      UTI: 'public.json',
      dialogTitle: 'Export VIVA Cycle data',
    }),

  remove(uri) {
    const file = new File(uri);
    if (file.exists) file.delete();
  },

  // iOS has finished with the file when the share sheet closes. On Android the receiving app may
  // still be reading it, so it stays in the cache until the next export (or the phone clears it).
  removeAfterShare: Platform.OS === 'ios',
};
