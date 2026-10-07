import { useRef } from 'react';
import { AccessibilityActionEvent, PanResponder, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';
import { ENERGY_START, energyLabel } from '../lib/dailyTracking';

type Props = {
  value: number | null; // 0-100, null = not tracked
  onChange: (value: number) => void;
  disabled?: boolean;
};

const TRACK_HEIGHT = 6;
const THUMB = 26;
const TOUCH_HEIGHT = 44; // comfortable touch target around the thin track

export default function EnergySlider({ value, onChange, disabled = false }: Props) {
  const width = useRef(0);
  const startX = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const setFromX = (x: number) => {
    if (width.current <= 0) return;
    const ratio = Math.max(0, Math.min(1, x / width.current));
    onChangeRef.current(Math.round(ratio * 100));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        startX.current = e.nativeEvent.locationX;
        setFromX(startX.current);
      },
      onPanResponderMove: (_, g) => setFromX(startX.current + g.dx),
    })
  ).current;

  const tracked = value !== null;
  const percent = Math.max(0, Math.min(100, value ?? ENERGY_START));
  const label = tracked ? energyLabel(percent) : 'Not tracked';

  // Screen readers: swipe up/down moves one whole level
  const onAction = (e: AccessibilityActionEvent) => {
    if (disabled) return;
    if (!tracked) {
      onChange(ENERGY_START);
      return;
    }
    const level = Math.min(4, Math.floor(percent / 20));
    const next = e.nativeEvent.actionName === 'increment' ? Math.min(4, level + 1) : Math.max(0, level - 1);
    onChange(next * 20 + 10);
  };

  return (
    <View style={disabled && styles.disabled}>
      <View
        style={styles.touchArea}
        onLayout={(e) => {
          width.current = e.nativeEvent.layout.width;
        }}
        {...pan.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Energy level"
        accessibilityValue={{ text: label }}
        accessibilityState={{ disabled }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAction}
      >
        <View style={styles.track} pointerEvents="none">
          {tracked && <View style={[styles.activeTrack, { width: `${percent}%` }]} />}
        </View>
        <View pointerEvents="none" style={[styles.thumb, { left: `${percent}%` }, !tracked && styles.thumbUntracked]} />
      </View>

      <View style={styles.labelsRow}>
        <Text style={styles.labelText}>Very low</Text>
        <Text style={[styles.labelText, tracked ? styles.labelActive : styles.labelUntracked]}>{label}</Text>
        <Text style={styles.labelText}>Very high</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.5,
  },
  touchArea: {
    height: TOUCH_HEIGHT,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  activeTrack: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.magenta,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    top: (TOUCH_HEIGHT - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.magenta,
    borderWidth: 3,
    borderColor: colors.white,
    marginLeft: -THUMB / 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  thumbUntracked: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.mutedGray,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  labelText: {
    fontSize: 12.5,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  labelActive: {
    color: colors.magenta,
    fontWeight: '700',
  },
  labelUntracked: {
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});
