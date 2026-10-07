// VIVA Cycle - Daily Tracking Settings
// Navigation is live. The settings themselves will be built in a later step:
// nothing here changes any saved data.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../constants/theme';

export default function DailyTrackingSettingsScreen() {
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back to Daily Tracking"
          >
            <Ionicons name="chevron-back" size={26} color={colors.navy} />
          </Pressable>

          <Text style={styles.title} accessibilityRole="header">
            Daily Tracking Settings
          </Text>
          <Text style={styles.subtitle}>Choose how Daily Tracking works for you.</Text>

          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Ionicons name="options-outline" size={20} color={colors.magenta} />
            </View>
            <Text style={styles.cardText}>
              Daily Tracking settings will appear here. Your saved tracking is not affected.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screen },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: spacing.screenH,
    paddingBottom: 40,
    gap: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    marginLeft: -10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.navy,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.pinkVerySoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    fontSize: 14.5,
    color: colors.navy,
    lineHeight: 20,
  },
});
