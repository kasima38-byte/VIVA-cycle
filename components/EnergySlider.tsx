import { useRef } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

type Props = {
  value: number; // 0-100
  onChange: (value: number) => void;
};

const TRACK_HEIGHT = 6;
const THUMB = 26;

export default function EnergySlider({ value, onChange }: Props) {
  const trackWidth = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (trackWidth.current <= 0) return;
        const x = Math.max(0, Math.min(gestureState.moveX - gestureState.x0 + gestureState.dx, trackWidth.current));
        const ratio = Math.max(0, Math.min(1, x / trackWidth.current));
        onChange(Math.round(ratio * 100));
      },
    })
  ).current;

  const percent = Math.max(0, Math.min(100, value));

  const label = percent < 25 ? 'Very low' : percent < 50 ? 'Low' : percent < 75 ? 'Moderate' : 'Very high';

  return (
    <View>
      <View
        style={styles.track}
        onLayout={(e) => {
          trackWidth.current = e.nativeEvent.layout.width;
        }}
        {...panResponder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={`Energy level: ${label}`}
      >
        <View style={[styles.activeTrack, { width: `${percent}%` }]} />
        <View style={[styles.thumb, { left: `${percent}%` }]} />
      </View>

      <View style={styles.labelsRow}>
        <Text style={styles.labelText}>Very low</Text>
        <Text style={[styles.labelText, styles.labelActive]}>{label}</Text>
        <Text style={styles.labelText}>Very high</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: colors.border,
    justifyContent: 'center',
    marginTop: THUMB / 2,
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
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
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
});