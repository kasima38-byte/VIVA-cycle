import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

type Props = {
  value: boolean;
  onChange: (value: boolean) => void;
};

export default function YesNoSelector({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(true)}
        style={[styles.card, value && styles.cardSelected]}
        accessibilityRole="button"
        accessibilityLabel="Sexual activity yes"
        accessibilityState={{ selected: value }}
      >
        <Ionicons name="heart" size={22} color={value ? colors.magenta : colors.mutedGray} />
        <Text style={[styles.label, value && styles.labelSelected]}>Yes</Text>
      </Pressable>

      <Pressable
        onPress={() => onChange(false)}
        style={[styles.card, !value && styles.cardSelected]}
        accessibilityRole="button"
        accessibilityLabel="Sexual activity no"
        accessibilityState={{ selected: !value }}
      >
        <Ionicons name="heart" size={22} color={!value ? colors.magenta : colors.mutedGray} />
        <Text style={[styles.label, !value && styles.labelSelected]}>No</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
  },
  cardSelected: {
    backgroundColor: colors.pinkVerySoft,
    borderColor: colors.magenta,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.navy,
  },
  labelSelected: {
    color: colors.magenta,
  },
});