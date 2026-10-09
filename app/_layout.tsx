import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { listenForReminderTaps, syncReminders } from '../lib/notifications';
import { getVivaState, loadVivaStore, retryLoadVivaStore, useVivaStore } from '../lib/vivaStore';
import { loadTrackingSettings, useTrackingSettings } from '../lib/dailyTrackingSettingsService';
import AppLockScreen from '../components/AppLockScreen';
import { initAppLock, openWhenUnlocked, rootView, useAppLock } from '../lib/appLockSession';

export default function RootLayout() {
  const { loaded, loadError, periods, baseline, goal, reminders, discreetNotifications } = useVivaStore();
  const { loaded: settingsLoaded } = useTrackingSettings();
  const { gate } = useAppLock();

  useEffect(() => {
    initAppLock();
    loadVivaStore();
    loadTrackingSettings();
    // A reminder tapped while locked opens its screen only after the PIN
    return listenForReminderTaps((url) => openWhenUnlocked(url, (u) => router.push(u as any)));
  }, []);

  // Rebuild reminders whenever anything they depend on changes (and on every launch)
  useEffect(() => {
    if (loaded && !loadError) syncReminders(getVivaState());
  }, [loaded, loadError, periods, baseline, goal, reminders, discreetNotifications]);

  // App Lock comes first: until the PIN is checked, NO VIVA screen is rendered (lib/appLockSession.ts)
  const view = rootView(gate);
  if (view === 'lock') {
    return (
      <SafeAreaProvider>
        <AppLockScreen />
      </SafeAreaProvider>
    );
  }

  if (view === 'loading' || !loaded || !settingsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAEFF5' }}>
        <ActivityIndicator color="#E9006F" />
      </View>
    );
  }

  // Saved data exists but could not be read: never show Welcome (that would
  // start a new profile and overwrite her history). Offer a retry instead.
  if (loadError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#FAEFF5' }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#131633', textAlign: 'center' }}>
          We couldn't load your VIVA data
        </Text>
        <Text style={{ fontSize: 15, color: '#4A5275', textAlign: 'center', marginTop: 10, lineHeight: 21 }}>
          Your saved information has not been changed. Please try again. If this keeps happening, restart your phone.
        </Text>
        <Pressable
          onPress={() => retryLoadVivaStore()}
          accessibilityRole="button"
          style={{ marginTop: 24, backgroundColor: '#E9006F', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 28 }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}