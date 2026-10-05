import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

export type MoodValue = 'veryLow' | 'low' | 'okay' | 'good' | 'great';

const moods: { key: MoodValue; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'veryLow', label: 'Very low', icon: 'sad' },
  { key: 'low', label: 'Low', icon: 'sad-outline' },
  { key: 'okay', label: 'Okay', icon: 'remove-circle-outline' },
  { key: 'good', label: 'Good', icon: 'happy-outline' },
  { key: 'great', label: 'Great', icon: 'happy' },
];

type Props = {
  value: MoodValue;
  onChange: (mood: MoodValue) => void;
};

export default function MoodSelector({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {moods.map((mood) => {
        const selected = mood.key === value;
        return (
          <Pressable
            key={mood.key}
            onPress={() => onChange(mood.key)}
            style={styles.item}
            accessibilityRole="button"
            accessibilityLabel={`Select ${mood.label.toLowerCase()} mood`}
            accessibilityState={{ selected }}
          >
            <View style={[styles.circle, selected && styles.circleSelected]}>
              <Ionicons name={mood.icon} size={22} color={colors.magenta} />
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