import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';
import { MOOD_OPTIONS, MoodValue } from '../lib/dailyTracking';

export type { MoodValue };

// Labels come from MOOD_OPTIONS (lib/dailyTracking.ts) - the one central mapping
const ICONS: Record<MoodValue, React.ComponentProps<typeof Ionicons>['name']> = {
  very_low: 'sad',
  low: 'sad-outline',
  okay: 'remove-circle-outline',
  good: 'happy-outline',
  great: 'happy',
};

type Props = {
  value: MoodValue | null; // null = not tracked (nothing highlighted)
  onChange: (mood: MoodValue) => void;
  disabled?: boolean;
  dayLabel?: string; // "today's" or "this day's" - for screen readers
};

export default function MoodSelector({ value, onChange, disabled = false, dayLabel = "today's" }: Props) {
  return (
    <View style={[styles.row, disabled && styles.disabled]} accessibilityRole="radiogroup" accessibilityLabel="Mood">
      {MOOD_OPTIONS.map((mood) => (
        <MoodOption
          key={mood.value}
          value={mood.value}
          label={mood.label}
          selected={mood.value === value}
          disabled={disabled}
          dayLabel={dayLabel}
          onPress={() => onChange(mood.value)}
        />
      ))}
    </View>
  );
}

function MoodOption({
  value, label, selected, disabled, dayLabel, onPress,
}: {
  value: MoodValue; label: string; selected: boolean; disabled: boolean; dayLabel: string; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => springTo(0.92)}
      onPressOut={() => springTo(1)}
      disabled={disabled}
      style={styles.item}
      accessibilityRole="radio"
      accessibilityLabel={label + ' mood'}
      accessibilityHint={selected ? 'Currently selected' : 'Select to record ' + label + ' as ' + dayLabel + ' mood'}
      accessibilityState={{ selected, checked: selected, disabled }}
    >
      <Animated.View style={[styles.circle, selected && styles.circleSelected, { transform: [{ scale }] }]}>
        <Ionicons name={ICONS[value]} size={22} color={colors.magenta} />
        {selected && (
          <View style={styles.badge}>
            <Ionicons name="checkmark" size={10} color={colors.white} />
          </View>
        )}
      </Animated.View>
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
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
    minHeight: 72,
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
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.magenta,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
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
