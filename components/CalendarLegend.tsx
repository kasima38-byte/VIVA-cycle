import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

const items: { label: string; color: string; border?: string; icon?: 'heart' }[] = [
  { label: 'Period', color: colors.magenta },
  { label: 'Predicted period', color: colors.pinkSoft, border: colors.magenta + '55' },
  { label: 'Estimated fertile window', color: colors.lightPurple, border: colors.ovulationPurple + '33' },
  { label: 'Estimated ovulation', color: colors.ovulationPurple },
];

export default function CalendarLegend() {
  return (
    <View style={styles.wrap}>
      {items.map((item) => (
        <View key={item.label} style={styles.item}>
          {item.icon === 'heart' ? (
            <Ionicons name="heart" size={12} color={item.color} />
          ) : (
            <View style={[styles.dot, { backgroundColor: item.color }, item.border ? { borderWidth: 1, borderColor: item.border } : null]} />
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