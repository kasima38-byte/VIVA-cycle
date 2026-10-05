import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

type Props = {
  cycleDay: number;
  cycleLength: number;
};

const SIZE = 190;
const DOT = 8;
const RADIUS = SIZE / 2 - DOT;

export default function CycleProgressRing({ cycleDay, cycleLength }: Props) {
  const dots = Array.from({ length: cycleLength });

  return (
    <View style={[styles.wrap, { width: SIZE, height: SIZE }]}>
      {dots.map((_, i) => {
        const angle = (i / cycleLength) * 2 * Math.PI - Math.PI / 2;
        const x = RADIUS * Math.cos(angle) + SIZE / 2 - DOT / 2;
        const y = RADIUS * Math.sin(angle) + SIZE / 2 - DOT / 2;
        const filled = i < cycleDay;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              { left: x, top: y, backgroundColor: filled ? colors.magenta : colors.pinkSoft },
            ]}
          />
        );
      })}

      <View style={styles.center}>
        <Text style={styles.label}>CYCLE DAY</Text>
        <Text style={styles.day}>{cycleDay}</Text>
        <Text style={styles.of}>of {cycleLength}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2 },
  center: { alignItems: 'center' },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, letterSpacing: 1 },
  day: { fontSize: 44, fontWeight: '800', color: colors.magenta, marginTop: 2 },
  of: { fontSize: 15, color: colors.textSecondary, marginTop: 2 },
});