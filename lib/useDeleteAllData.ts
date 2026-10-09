// VIVA Cycle - the confirmation flow for "Delete all my data".
// Nothing is deleted when a screen opens or a row is tapped: requestDeleteAll() only shows the
// first confirmation. Deletion starts only after she confirms twice.
//
// Usage (Privacy & Security screen, next step):
//   const { requestDeleteAll, deleting } = useDeleteAllData();
//   <Pressable onPress={requestDeleteAll} disabled={deleting}>…Delete all my data…</Pressable>

import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';
import { DELETE_ALL_CONFIRM, DELETE_ALL_FINAL, deleteAllResultMessage } from './dataDeletion';
import { deleteAllUserData } from './dataDeletionService';

export function useDeleteAllData() {
  const [deleting, setDeleting] = useState(false);
  const busy = useRef(false);

  const runDelete = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setDeleting(true);
    let result;
    try {
      result = await deleteAllUserData();
    } catch {
      result = { status: 'failed', dataDeleted: 'nothing', remindersCancelled: false } as const;
    } finally {
      busy.current = false;
      setDeleting(false);
    }
    const msg = deleteAllResultMessage(result);
    AccessibilityInfo.announceForAccessibility(msg.title);
    if (result.dataDeleted === 'all') {
      // Everything she set up is gone: start again from Welcome
      Alert.alert(msg.title, msg.body, [{ text: 'OK', onPress: () => router.replace('/welcome') }], {
        cancelable: false,
      });
    } else {
      Alert.alert(msg.title, msg.body);
    }
  }, []);

  const requestDeleteAll = useCallback(() => {
    if (busy.current) return;
    Alert.alert(DELETE_ALL_CONFIRM.title, DELETE_ALL_CONFIRM.body, [
      { text: DELETE_ALL_CONFIRM.cancel, style: 'cancel' },
      {
        text: DELETE_ALL_CONFIRM.continue,
        style: 'destructive',
        onPress: () =>
          Alert.alert(DELETE_ALL_FINAL.title, DELETE_ALL_FINAL.body, [
            { text: DELETE_ALL_FINAL.cancel, style: 'cancel' },
            { text: DELETE_ALL_FINAL.confirm, style: 'destructive', onPress: () => void runDelete() },
          ]),
      },
    ]);
  }, [runDelete]);

  return { requestDeleteAll, deleting };
}
