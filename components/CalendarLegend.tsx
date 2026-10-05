import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

const items: { label: string; color: string; icon?: 'heart' }[] = [
  { label: 'Period', color: colors.magenta },
  { label: 'Fertile window', color: colors.pinkSoft },
  { label: 'Ovulation', color: '#8B45E8' },
  { label: 'Sex', color: colors.magenta, icon: 'heart' },
  { label: 'Note', color: colors.mutedGray },
];

export default function CalendarLegend() {
  return (
    <View style={styles.wrap}>
      {items.map((item) => (
        <View key={item.label} style={styles.item}>
          {item.icon === 'heart' ? (
            <Ionicons name="heart" size={12} color={item.color} />
          ) : (
            <View style={[styles.dot, { backgroundColor: item.color }]} />
          )}
          <Text style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.pinkVerySoft,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: 14,
    justifyContent: 'center',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  label: {
    fontSize: 13,
    color: colors.navySoft,
    fontWeight: '500',
  },
});