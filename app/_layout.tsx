import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { loadVivaStore, retryLoadVivaStore, useVivaStore } from '../lib/vivaStore';

export default function RootLayout() {
  const { loaded, loadError } = useVivaStore();

  useEffect(() => {
    loadVivaStore();
  }, []);

  if (!loaded) {
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