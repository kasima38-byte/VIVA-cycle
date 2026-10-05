import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

type Props = {
  dateKey: string; // YYYY-MM-DD
  onChange: (dateKey: string) => void;
};

function toDate(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toKey(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + mm + '-' + dd;
}

function formatDisplay(key: string) {
  return toDate(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function DateFieldCard({ dateKey, onChange }: Props) {
  const [showPicker, setShowPicker] = require('react').useState(false);

  return (
    <View style={styles.row}>
      <View style={styles.iconCircle}>
        <Ionicons name="calendar" size={20} color={colors.magenta} />
      </View>

      <Pressable
        style={styles.valueBox}
        onPress={() => setShowPicker(true)}
        accessibilityRole="button"
        accessibilityLabel={'Start date, ' + formatDisplay(dateKey)}
      >
        <Text style={styles.valueText}>{formatDisplay(dateKey)}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </Pressable>

      {showPicker && (
        <DateTimePicker
          value={toDate(dateKey)}
          mode="date"
          maximumDate={new Date()}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_: any, selected?: Date) => {
            if (Platform.OS !== 'ios') setShowPicker(false);
            if (selected) onChange(toKey(selected));
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueBox: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  valueText: { fontSize: 17, fontWeight: '700', color: colors.navy },
});