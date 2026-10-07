import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  primaryLabel?: string;        // defaults to "Done"
  onPrimary?: () => void;       // defaults to onClose
  primaryDisabled?: boolean;
};

export default function BottomSheet({
  visible, title, onClose, children, primaryLabel = 'Done', onPrimary, primaryDisabled = false,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
        <View style={styles.content}>{children}</View>
        <Pressable
          style={[styles.doneButton, primaryDisabled && styles.doneDisabled]}
          onPress={onPrimary ?? onClose}
          disabled={primaryDisabled}
          accessibilityRole="button"
          accessibilityLabel={primaryLabel}
          accessibilityState={{ disabled: primaryDisabled }}
        >
          <Text style={[styles.doneText, primaryDisabled && styles.doneTextDisabled]}>{primaryLabel}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,31,79,0.35)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.md,
    paddingBottom: 36,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.navy },
  content: { marginTop: spacing.md, gap: spacing.sm },
  doneButton: {
    backgroundColor: colors.magenta,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  doneText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  doneDisabled: { backgroundColor: colors.pinkSoft },
  doneTextDisabled: { color: colors.magenta },
});