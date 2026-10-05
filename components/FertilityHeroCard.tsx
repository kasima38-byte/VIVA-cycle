import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';
import FertilityIllustration from './FertilityIllustration';

type Props = {
  dateRange: string;
  daysLeft: number;
  onLogSymptoms?: () => void;
};

export default function FertilityHeroCard({ dateRange, daysLeft, onLogSymptoms }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.leftCol}>
          <Text style={styles.eyebrow}>You're in your</Text>
          <Text style={styles.heading}>Fertile Window</Text>
          <Text style={styles.body}>Higher chance of conception</Text>

          <View style={styles.dateRow}>
            <View style={styles.calendarIcon}>
              <Ionicons name="calendar" size={14} color={colors.magenta} />
            </View>
            <View>
              <Text style={styles.dateText}>{dateRange}</Text>
              <Text style={styles.daysLeftText}>{daysLeft} days left</Text>
            </View>
          </View>

          <Pressable onPress={onLogSymptoms} style={styles.ctaButton} accessibilityRole="button">
            <Text style={styles.ctaText}>Log Today's Symptoms</Text>
          </Pressable>
        </View>

        <View style={styles.illustrationCol}>
          <View style={styles.speechBubble}>
            <Text style={styles.speechText}>
              "Your body gives you signs. We help you understand them."
            </Text>
          </View>
          <FertilityIllustration />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.pinkVerySoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
  },
  leftCol: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  eyebrow: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.navy,
  },
  heading: {
    fontSize: 27,
    fontWeight: '800',
    color: colors.magenta,
    marginTop: 2,
  },
  body: {
    fontSize: 14.5,
    color: colors.textSecondary,
    marginTop: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: 8,
  },
  calendarIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.navy,
  },
  daysLeftText: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 1,
  },
  ctaButton: {
    backgroundColor: colors.magenta,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginTop: spacing.lg,
    alignSelf: 'flex-start',
  },
  ctaText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13.5,
  },
  illustrationCol: {
    width: 150,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  speechBubble: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 8,
    width: 128,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    zIndex: 2,
  },
  speechText: {
    fontSize: 10.5,
    color: colors.magenta,
    fontWeight: '600',
    lineHeight: 14,
  },
});