import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { AccessibilityActionEvent, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';
import { ENERGY_BUTTON_STEP, ENERGY_START, energyLabel, snapEnergy } from '../lib/dailyTracking';

type Props = {
  value: number | null; // 0-100, null = not tracked
  onChange: (value: number) => void;
  disabled?: boolean;
};

const TRACK_HEIGHT = 8;
const THUMB = 30;
const TOUCH_HEIGHT = 48; // comfortable touch target around the track

export default function EnergySlider({ value, onChange, disabled = false }: Props) {
  const width = useRef(0);
  const startX = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const valueRef = useRef(value);
  valueRef.current = value;

  // Snap to steps of 5 and only report real changes (smooth dragging, no jitter)
  const setFromX = (x: number) => {
    if (width.current <= 0) return;
    const next = snapEnergy((x / width.current) * 100);
    if (next !== valueRef.current) {
      valueRef.current = next;
      onChangeRef.current(next);
    }
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

  // - / + buttons and screen readers: one step of 10. From "not tracked", the first step sets Moderate.
  const step = (dir: 1 | -1) => {
    if (disabled) return;
    onChange(value === null ? ENERGY_START : snapEnergy(value + dir * ENERGY_BUTTON_STEP));
  };

  const onAction = (e: AccessibilityActionEvent) => {
    step(e.nativeEvent.actionName === 'increment' ? 1 : -1);
  };

  return (
    <View style={disabled && styles.disabled}>
      <View style={styles.controlRow}>
        <StepButton
          icon="remove"
          label="Lower energy"
          onPress={() => step(-1)}
          disabled={disabled || (tracked && percent <= 0)}
        />

        <View
          style={styles.touchArea}
          onLayout={(e) => {
            width.current = e.nativeEvent.layout.width;
          }}
          {...pan.panHandlers}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Energy level"
          accessibilityValue={
            tracked ? { min: 0, max: 100, now: percent, text: label + ', ' + percent + ' out of 100' } : { text: 'Not tracked' }
          }
          accessibilityHint={disabled ? undefined : 'Swipe up or down to change'}
          accessibilityState={{ disabled }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={onAction}
        >
          <View style={styles.track} pointerEvents="none">
            {tracked && <View style={[styles.activeTrack, { width: `${percent}%` }]} />}
          </View>
          <View
            pointerEvents="none"
            style={[styles.thumb, { left: `${percent}%` }, !tracked && styles.thumbUntracked]}
          />
        </View>

        <StepButton
          icon="add"
          label="Raise energy"
          onPress={() => step(1)}
          disabled={disabled || (tracked && percent >= 100)}
        />
      </View>

      <View style={styles.labelsRow}>
        <Text style={styles.labelText}>Very low</Text>
        <Text style={[styles.labelText, tracked ? styles.labelActive : styles.labelUntracked]}>
          {tracked ? percent + ' · ' + label : label}
        </Text>
        <Text style={styles.labelText}>Very high</Text>
      </View>
    </View>
  );
}

function StepButton({
  icon, label, onPress, disabled,
}: { icon: 'add' | 'remove'; label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.stepButton, disabled && styles.stepOff, pressed && styles.stepPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Moves energy by one step"
      accessibilityState={{ disabled }}
    >
      <Ionicons name={icon} size={18} color={colors.magenta} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.5,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  touchArea: {
    flex: 1,
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
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepOff: {
    opacity: 0.4,
  },
  stepPressed: {
    opacity: 0.7,
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
