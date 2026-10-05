import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { todayLocal } from './cycleEngine';

/** Today's LOCAL date; updates at midnight and when the app comes back to the foreground. */
export function useToday(): string {
  const [today, setToday] = useState(todayLocal());

  useEffect(() => {
    const refresh = () => setToday(todayLocal());
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    const now = new Date();
    const msToMidnight =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime() + 1000;
    const timer = setTimeout(refresh, msToMidnight);
    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, [today]);

  return today;
}
