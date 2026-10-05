import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

type Props = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  selected: boolean;
  onPress: () => void;
};

export default function SymptomCard({ icon, label, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, selected && styles.cardSelected]}
      accessibilityRole="button"
      accessibilityLabel={`Select ${label.toLowerCase()} symptom`}
      accessibilityState={{ selected }}
    >
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={20} color={colors.magenta} />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.pinkVerySoft,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 6,
  },
  cardSelected: {
    backgroundColor: colors.white,
    borderColor: colors.magenta,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.navy,
    textAlign: 'center',
  },
});