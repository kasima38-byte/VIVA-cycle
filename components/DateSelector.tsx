import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

export type DateItem = {
  key: string;
  weekday: string;
  day: number;
  hasDot: boolean;
};

type Props = {
  dates: DateItem[];
  selectedKey: string;
  onSelect: (key: string) => void;
  onPrev: () => void;
  onNext: () => void;
};

export default function DateSelector({ dates, selectedKey, onSelect, onPrev, onNext }: Props) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onPrev} hitSlop={10} accessibilityRole="button" accessibilityLabel="Previous dates">
        <Ionicons name="chevron-back" size={20} color={colors.navy} />
      </Pressable>

      <View style={styles.pill}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {dates.map((date) => {
            const selected = date.key === selectedKey;
            return (
              <Pressable
                key={date.key}
                onPress={() => onSelect(date.key)}
                style={styles.dayWrap}
                accessibilityRole="button"
                accessibilityLabel={`Select ${date.weekday} ${date.day}`}
              >
                <View style={[styles.dayCircle, selected && styles.dayCircleSelected]}>
                  <Text style={[styles.weekday, selected && styles.textSelected]}>{date.weekday}</Text>
                  <Text style={[styles.dayNum, selected && styles.textSelected]}>{date.day}</Text>
                </View>
                <View style={styles.dotSlot}>{date.hasDot && !selected && <View style={styles.dot} />}</View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <Pressable onPress={onNext} hitSlop={10} accessibilityRole="button" accessibilityLabel="Next dates">
        <Ionicons name="chevron-forward" size={20} color={colors.navy} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pill: {
    flex: 1,
    backgroundColor: colors.pinkVerySoft,
    borderRadius: radius.pill,
    paddingVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  dayWrap: {
    alignItems: 'center',
    width: 46,
  },
  dayCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: {
    backgroundColor: colors.magenta,
  },
  weekday: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dayNum: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.navy,
    marginTop: 1,
  },
  textSelected: {
    color: colors.white,
  },
  dotSlot: {
    height: 8,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.magenta,
  },
});