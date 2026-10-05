import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

export type BarDatum = {
  label: string;
  value: number;
  current?: boolean;
};

type Props = {
  data: BarDatum[];
  maxHeight?: number;
  accessibilityLabel?: string;
};

export default function MiniBarChart({ data, maxHeight = 90, accessibilityLabel }: Props) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={styles.row} accessibilityLabel={accessibilityLabel}>
      {data.map((d, i) => {
        const height = Math.max(8, (d.value / max) * maxHeight);
        return (
          <View key={d.label + i} style={styles.col}>
            <Text style={styles.value}>{d.value}</Text>
            <View
              style={[
                styles.bar,
                { height },
                { backgroundColor: d.current ? colors.magenta : i % 2 === 0 ? '#F7B6D6' : '#EFC3EA' },
              ]}
            />
            <Text style={styles.label} numberOfLines={1}>
              {d.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 4,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  value: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.navy,
  },
  bar: {
    width: '70%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  label: {
    fontSize: 10.5,
    color: colors.textSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 4,
    width: '100%',
    textAlign: 'center',
  },
});