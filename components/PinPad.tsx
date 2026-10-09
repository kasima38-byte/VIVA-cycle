// VIVA Cycle - six dots and a number pad for entering a PIN.
// The digits are never shown (dots only) and never leave the screen that owns `value`.

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';
import { PIN_LENGTH } from '../lib/appLock';

type Props = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export default function PinPad({ value, onChange, disabled }: Props) {
  const press = (k: string) => {
    if (disabled) return;
    if (k === 'del') onChange(value.slice(0, -1));
    else if (value.length < PIN_LENGTH) onChange(value + k);
  };

  return (
    <View style={styles.wrap}>
      <View
        style={styles.dots}
        accessible
        accessibilityRole="text"
        accessibilityLabel={`PIN, ${value.length} of ${PIN_LENGTH} digits entered`}
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View key={i} style={[styles.dot, i < value.length && styles.dotFilled]} />
        ))}
      </View>
      <View style={styles.grid}>
        {KEYS.map((k, i) =>
          k === '' ? (
            <View key={i} style={styles.key} />
          ) : (
            <Pressable
              key={i}
              onPress={() => press(k)}
              disabled={disabled}
              style={({ pressed }) => [styles.key, styles.keyButton, pressed && styles.keyPressed, disabled && styles.keyDisabled]}
              accessibilityRole="button"
              accessibilityLabel={k === 'del' ? 'Delete last digit' : k}
            >
              {k === 'del' ? (
                <Ionicons name="backspace-outline" size={26} color={colors.navy} />
              ) : (
                <Text style={styles.keyText}>{k}</Text>
              )}
            </Pressable>
          )
        )}
      </View>
    </View>
  );
}

const KEY = 72;
const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.xxl },
  dots: { flexDirection: 'row', gap: 14 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.navySoft },
  dotFilled: { backgroundColor: colors.magenta, borderColor: colors.magenta },
  grid: { width: KEY * 3 + 24 * 2, flexDirection: 'row', flexWrap: 'wrap', columnGap: 24, rowGap: 14 },
  key: { width: KEY, height: KEY, alignItems: 'center', justifyContent: 'center' },
  keyButton: { borderRadius: KEY / 2, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  keyPressed: { backgroundColor: colors.pinkSoft },
  keyDisabled: { opacity: 0.4 },
  keyText: { fontSize: 28, fontWeight: '600', color: colors.navy },
});
