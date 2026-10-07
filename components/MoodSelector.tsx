import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';
import { MOOD_OPTIONS, MoodValue } from '../lib/dailyTracking';

export type { MoodValue };

const ICONS: Record<MoodValue, React.ComponentProps<typeof Ionicons>['name']> = {
  veryLow: 'sad',
  low: 'sad-outline',
  okay: 'remove-circle-outline',
  good: 'happy-outline',
  great: 'happy',
};

type Props = {
  value: MoodValue | null; // null = not tracked (nothing highlighted)
  onChange: (mood: MoodValue) => void;
  disabled?: boolean;
};

export default function MoodSelector({ value, onChange, disabled = false }: Props) {
  return (
    <View style={[styles.row, disabled && styles.disabled]} accessibilityRole="radiogroup" accessibilityLabel="Mood">
      {MOOD_OPTIONS.map((mood) => {
        const selected = mood.value === value;
        return (
          <Pressable
            key={mood.value}
            onPress={() => onChange(mood.value)}
            disabled={disabled}
            style={styles.item}
            accessibilityRole="radio"
            accessibilityLabel={mood.label + ' mood'}
            accessibilityState={{ selected, checked: selected, disabled }}
          >
            <View style={[styles.circle, selected && styles.circleSelected]}>
              <Ionicons name={ICONS[mood.value]} size={22} color={colors.magenta} />
            </View>
            <Text style={[styles.label, selected && styles.labelSelected]}>{mood.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  disabled: {
    opacity: 0.5,
  },
  item: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  circle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSelected: {
    borderWidth: 2,
    borderColor: colors.magenta,
    backgroundColor: colors.white,
  },
  label: {
    fontSize: 11.5,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  labelSelected: {
    color: colors.magenta,
    fontWeight: '700',
  },
});
