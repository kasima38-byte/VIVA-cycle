import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { loadVivaStore, useVivaStore } from '../lib/vivaStore';

export default function RootLayout() {
  const { loaded } = useVivaStore();

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

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}