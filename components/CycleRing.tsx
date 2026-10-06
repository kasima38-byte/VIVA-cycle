import Svg, { Circle, Path } from 'react-native-svg';
import { colors, cycleColors } from '../constants/theme';

// Small, data-driven cycle illustration: one ring = one cycle, starting at the top.
// Pink arc = period days, lavender arc = estimated fertile window,
// purple dot = estimated ovulation, ringed dot = today. Purely decorative.

type Props = {
  cycleLength: number;
  periodDays: number;
  fertileStartDay: number; // cycle days (1-based)
  fertileEndDay: number;
  ovulationDay: number;
  todayDay: number | null;
  size?: number;
};

const STROKE = 10;

export default function CycleRing({
  cycleLength, periodDays, fertileStartDay, fertileEndDay, ovulationDay, todayDay, size = 104,
}: Props) {
  const r = (size - STROKE) / 2 - 4;
  const c = size / 2;
  const angle = (day: number) => ((day / cycleLength) * 360 - 90) * (Math.PI / 180);
  const point = (day: number) => ({ x: c + r * Math.cos(angle(day)), y: c + r * Math.sin(angle(day)) });

  // Arc covering whole days from `from` to `to` (inclusive, 1-based)
  const arc = (from: number, to: number) => {
    const a = point(Math.max(0, from - 1) + 0.15);
    const b = point(Math.min(cycleLength, to) - 0.15);
    const large = to - from + 1 > cycleLength / 2 ? 1 : 0;
    return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
  };
  const mid = (day: number) => point(day - 0.5);
  const ov = mid(ovulationDay);
  const today = todayDay && todayDay >= 1 && todayDay <= cycleLength ? mid(todayDay) : null;

  return (
    <Svg width={size} height={size} accessible={false}>
      <Circle cx={c} cy={c} r={r} stroke={cycleColors.track} strokeWidth={STROKE} fill="none" />
      {periodDays > 0 && (
        <Path d={arc(1, periodDays)} stroke={cycleColors.period} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
      )}
      {fertileEndDay >= fertileStartDay && (
        <Path d={arc(Math.max(1, fertileStartDay), fertileEndDay)} stroke={cycleColors.fertile} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
      )}
      <Circle cx={ov.x} cy={ov.y} r={7} fill={cycleColors.ovulation} stroke={colors.white} strokeWidth={2} />
      {today && <Circle cx={today.x} cy={today.y} r={6.5} fill={colors.white} stroke={colors.magenta} strokeWidth={3} />}
    </Svg>
  );
}
