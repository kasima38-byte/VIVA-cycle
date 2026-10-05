import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

type Props = {
  label: string;
  dropletCount: number;
  selected: boolean;
  onPress: () => void;
};

export default function FlowIntensityCard({ label, dropletCount, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, selected && styles.cardSelected]}
      accessibilityRole="button"
      accessibilityLabel={`Select ${label.toLowerCase()} flow`}
      accessibilityState={{ selected }}
    >
      <View style={styles.dropletsRow}>
        {Array.from({ length: dropletCount }).map((_, i) => (
          <Ionicons
            key={i}
            name="water"
            size={16}
            color={selected ? colors.magenta : '#F0AFCB'}
            style={i > 0 ? { marginLeft: -3 } : undefined}
          />
        ))}
      </View>
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 8,
  },
  cardSelected: {
    backgroundColor: colors.pinkVerySoft,
    borderColor: colors.magenta,
  },
  dropletsRow: {
    flexDirection: 'row',
    height: 20,
    alignItems: 'center',
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.navy,
    textAlign: 'center',
  },
  labelSelected: {
    color: colors.magenta,
  },
});