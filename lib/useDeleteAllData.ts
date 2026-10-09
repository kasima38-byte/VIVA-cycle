// VIVA Cycle - "Delete all my data" for screens (used by app/privacy-security.tsx).
// Nothing is deleted when a screen opens: requestDeleteAll() only shows the first confirmation,
// and deletion starts only after she confirms twice (rules in lib/deleteFlow.ts).

import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';
import { deleteAllUserData } from './dataDeletionService';
import { Dialog, DeleteFlowOutcome, Message, runDeleteFlow } from './deleteFlow';

/** A phone dialog that resolves true only for the confirm button (back/outside tap = cancel). */
function ask(d: Dialog): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      d.title,
      d.body,
      [
        { text: d.cancel, style: 'cancel', onPress: () => resolve(false) },
        { text: d.confirm, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

function tell(m: Message, then?: () => void) {
  AccessibilityInfo.announceForAccessibility(m.title);
  Alert.alert(m.title, m.body, [{ text: 'OK', onPress: then }], { cancelable: !then });
}

export function useDeleteAllData() {
  const [deleting, setDeleting] = useState(false);
  const [lastOutcome, setLastOutcome] = useState<DeleteFlowOutcome | null>(null);
  const busy = useRef(false);

  const requestDeleteAll = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const outcome = await runDeleteFlow({
        ask,
        run: async () => {
          setDeleting(true);
          try {
            return await deleteAllUserData();
          } finally {
            setDeleting(false);
          }
        },
        tell,
        goToSafeScreen: () => router.replace('/welcome'),
      });
      setLastOutcome(outcome);
    } finally {
      busy.current = false;
    }
  }, []);

  return { requestDeleteAll, deleting, lastOutcome };
}
