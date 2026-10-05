import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

type Props = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
};

export default function IntroCard({ icon, title, description }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={26} color={colors.magenta} />
      </View>

      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      {/* Decorative VIVA leaf graphic reserved here — no official asset yet */}
      <View style={styles.leafWrap} pointerEvents="none">
        <View style={[styles.leaf, { transform: [{ rotate: '-30deg' }], left: 0 }]} />
        <View
          style={[
            styles.leaf,
            { backgroundColor: '#FADCEB', height: 46, left: 16, transform: [{ rotate: '-4deg' }] },
          ]}
        />
        <View style={[styles.leaf, { transform: [{ rotate: '26deg' }], left: 30 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.pinkVerySoft,
    borderRadius: radius.lg,
    padding: spacing.xl,
    overflow: 'hidden',
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.navy,
  },
  description: {
    fontSize: 14.5,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 19,
  },
  leafWrap: {
    width: 60,
    height: 56,
    marginLeft: spacing.sm,
  },
  leaf: {
    position: 'absolute',
    bottom: 0,
    width: 26,
    height: 50,
    backgroundColor: '#F7B9D5',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 4,
  },
});