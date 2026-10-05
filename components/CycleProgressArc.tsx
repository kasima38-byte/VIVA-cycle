import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '../constants/theme';

type Props = {
  cycleDay: number;
  cycleLength: number;
};

const SIZE = 160;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function CycleProgressArc({ cycleDay, cycleLength }: Props) {
  const progress = Math.max(0, Math.min(1, cycleDay / cycleLength));
  const offset = CIRCUMFERENCE * (1 - progress);

  return (
    <View style={[styles.wrap, { width: SIZE, height: SIZE }]}>
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={colors.pinkSoft}
          strokeWidth={STROKE}
          fill="none"
        />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={colors.magenta}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          fill="none"
          rotation="-90"
          originX={SIZE / 2}
          originY={SIZE / 2}
        />
      </Svg>

      <View style={styles.center}>
        <Text style={styles.label}>Cycle Day</Text>
        <Text style={styles.day}>{cycleDay}</Text>
        <Text style={styles.of}>of {cycleLength}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center' },
  label: { fontSize: 13, color: colors.textSecondary },
  day: { fontSize: 40, fontWeight: '800', color: colors.navy, marginTop: 2 },
  of: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
});