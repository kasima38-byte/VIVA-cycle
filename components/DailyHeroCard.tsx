import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

/**
 * Placeholder self-care illustration — a soft figure silhouette with
 * leaf shapes and a heart, built from vector shapes in the VIVA palette.
 * Swap for the official illustration asset when supplied.
 */
function WellnessIllustration() {
  return (
    <View style={illustrationStyles.wrap} pointerEvents="none">
      <View style={[illustrationStyles.leaf, { left: 4, top: 0, transform: [{ rotate: '-20deg' }] }]} />
      <View style={[illustrationStyles.leaf, { right: 10, top: -4, transform: [{ rotate: '20deg' }] }]} />
      <View style={illustrationStyles.headCircle} />
      <View style={illustrationStyles.bodyShape} />
      <Ionicons
        name="heart"
        size={14}
        color={colors.white}
        style={illustrationStyles.heartIcon}
      />
    </View>
  );
}

type Props = {
  title: string;
  subtitle: string;
};

export default function DailyHeroCard({ title, subtitle }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.leftCol}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.rightCol}>
        <Text style={styles.sideText}>YOU{'\n'}GOT{'\n'}THIS</Text>
        <Ionicons name="heart" size={12} color={colors.magenta} style={{ marginTop: 2 }} />
        <WellnessIllustration />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.pinkVerySoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
  },
  leftCol: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.navy,
  },
  subtitle: {
    fontSize: 13.5,
    color: colors.textSecondary,
    marginTop: 6,
  },
  rightCol: {
    width: 100,
    alignItems: 'flex-end',
  },
  sideText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.magenta,
    textAlign: 'right',
    lineHeight: 12,
  },
});

const illustrationStyles = StyleSheet.create({
  wrap: {
    width: 90,
    height: 80,
    marginTop: 4,
    position: 'relative',
  },
  leaf: {
    position: 'absolute',
    width: 28,
    height: 46,
    backgroundColor: '#F7C7DE',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 28,
    opacity: 0.75,
  },
  headCircle: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#8B5A3C',
    top: 10,
    left: 28,
  },
  bodyShape: {
    position: 'absolute',
    width: 50,
    height: 44,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    backgroundColor: colors.magenta,
    opacity: 0.85,
    bottom: 0,
    left: 20,
    alignItems: 'center',
  },
  heartIcon: {
    position: 'absolute',
    bottom: 14,
    left: 38,
  },
});