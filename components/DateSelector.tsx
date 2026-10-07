import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

export type DateItem = {
  key: string;
  weekday: string;
  day: number;
  hasDot: boolean;
  isToday?: boolean;
  isFuture?: boolean;
  label?: string; // full spoken name, e.g. "Today, Wednesday, October 7"
};

type Props = {
  dates: DateItem[];
  selectedKey: string;
  onSelect: (key: string) => void;
  onPrev: () => void;
  onNext: () => void;
  prevLabel?: string;
  nextLabel?: string;
};

const ITEM_WIDTH = 46;

export default function DateSelector({
  dates, selectedKey, onSelect, onPrev, onNext, prevLabel = 'Previous day', nextLabel = 'Next day',
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const selectedIndex = dates.findIndex((d) => d.key === selectedKey);

  // Keep the selected date in view on narrow phones
  useEffect(() => {
    if (selectedIndex >= 0) {
      scrollRef.current?.scrollTo({ x: Math.max(0, (selectedIndex - 2) * ITEM_WIDTH), animated: true });
    }
  }, [selectedIndex]);

  return (
    <View style={styles.row}>
      <Pressable onPress={onPrev} hitSlop={12} style={styles.arrow} accessibilityRole="button" accessibilityLabel={prevLabel}>
        <Ionicons name="chevron-back" size={20} color={colors.navy} />
      </Pressable>

      <View style={styles.pill}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {dates.map((date) => {
            const selected = date.key === selectedKey;
            return (
              <Pressable
                key={date.key}
                onPress={() => onSelect(date.key)}
                style={styles.dayWrap}
                accessibilityRole="button"
                accessibilityLabel={date.label ?? date.weekday + ' ' + date.day}
                accessibilityHint={date.hasDot ? 'Has saved tracking' : undefined}
                accessibilityState={{ selected }}
              >
                <View
                  style={[
                    styles.dayCircle,
                    date.isToday && !selected && styles.dayCircleToday,
                    selected && styles.dayCircleSelected,
                  ]}
                >
                  <Text style={[styles.weekday, date.isFuture && !selected && styles.textFuture, selected && styles.textSelected]}>
                    {date.weekday}
                  </Text>
                  <Text style={[styles.dayNum, date.isFuture && !selected && styles.textFuture, selected && styles.textSelected]}>
                    {date.day}
                  </Text>
                </View>
                <View style={styles.dotSlot}>{date.hasDot && !selected && <View style={styles.dot} />}</View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <Pressable onPress={onNext} hitSlop={12} style={styles.arrow} accessibilityRole="button" accessibilityLabel={nextLabel}>
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
  arrow: {
    minWidth: 40,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
    width: ITEM_WIDTH,
  },
  dayCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleToday: {
    borderWidth: 1.5,
    borderColor: colors.magenta,
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
  textFuture: {
    opacity: 0.45,
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
