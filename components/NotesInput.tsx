import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  maxLength?: number;
  placeholder?: string;
};

export default function NotesInput({ value, onChangeText, maxLength = 200, placeholder }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.inputRow}>
        <Ionicons name="document-text-outline" size={18} color={colors.textSecondary} style={styles.icon} />
        <TextInput
          value={value}
          onChangeText={(text) => onChangeText(text.slice(0, maxLength))}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          multiline
          style={styles.input}
          accessibilityLabel="Notes about how you're feeling today"
        />
      </View>
      <Text style={styles.counter}>
        {value.length}/{maxLength}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  icon: {
    marginTop: 2,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    color: colors.navy,
    minHeight: 40,
    padding: 0,
  },
  counter: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: 4,
  },
});