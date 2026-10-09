// VIVA Cycle - "Export my data" for screens (used by app/my-data.tsx).
// Nothing happens until she taps Export, reads what the file holds, and taps Continue.

import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo, Alert } from 'react-native';
import { getSettings } from './dailyTrackingSettingsService';
import { phoneExportIO } from './exportIO';
import { ExportOutcome, exportMessage, runExportFlow } from './exportFlow';
import { getVivaState } from './vivaStore';

function ask(title: string, body: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      body,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

export function useExportData() {
  const [exporting, setExporting] = useState(false);
  const [outcome, setOutcome] = useState<ExportOutcome | null>(null);
  const busy = useRef(false);

  const requestExport = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setExporting(true);
    setOutcome(null);
    try {
      const result = await runExportFlow({
        getState: getVivaState,
        getSettings,
        now: () => new Date(),
        ask,
        io: phoneExportIO,
      });
      setOutcome(result);
      const msg = exportMessage(result);
      if (msg) AccessibilityInfo.announceForAccessibility(msg.text);
    } finally {
      busy.current = false;
      setExporting(false);
    }
  }, []);

  return { requestExport, exporting, message: outcome ? exportMessage(outcome) : null };
}
