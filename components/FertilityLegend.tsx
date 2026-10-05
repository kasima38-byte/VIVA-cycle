import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';

const items = [
  { label: 'Period', color: colors.magenta },
  { label: 'Fertile window', color: colors.lightPurple },
  { label: 'Ovulation', color: colors.ovulationPurple },
  { label: 'Other days', color: colors.border },
];

export default function FertilityLegend() {
  return (
    <View style={styles.wrap}>
      {items.map((item) => (
        <View key={item.label} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: item.color }]} />
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
    gap: 16,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    fontSize: 13,
    color: colors.navySoft,
    fontWeight: '500',
  },
});