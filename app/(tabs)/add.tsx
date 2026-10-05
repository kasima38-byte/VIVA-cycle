import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../../constants/theme';

export default function AddScreen() {
  const openNotes = () => {
    // Notes destination does not yet exist — placeholder only.
    console.log('Notes tapped — no destination yet');
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.content}>
          <Pressable
            style={styles.card}
            onPress={() => router.push('/period-log')}
            accessibilityRole="button"
            accessibilityLabel="Log Period. Record your period."
          >
            <View style={styles.iconCircle}>
              <Ionicons name="water" size={26} color={colors.magenta} />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.title}>Log Period</Text>
              <Text style={styles.subtitle}>Record your period.</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.magenta} />
          </Pressable>

          <Pressable
            style={styles.card}
            onPress={openNotes}
            accessibilityRole="button"
            accessibilityLabel="Notes. Add a note about your cycle."
          >
            <View style={styles.iconCircle}>
              <Ionicons name="document-text" size={24} color={colors.magenta} />
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.title}>Notes</Text>
              <Text style={styles.subtitle}>Add a note about your cycle.</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.magenta} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screen },
  safe: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenH,
    gap: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.pinkVerySoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    minHeight: 100,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: { fontSize: 19, fontWeight: '700', color: colors.navy },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 3 },
});