import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from '../lib/useReducedMotion';
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
  const reduceMotion = useReducedMotion();
  const titleRef = useRef<React.ComponentRef<typeof Text>>(null);

  // Screen readers: move focus to the sheet's title when it opens, so she hears what it asks
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      if (titleRef.current) AccessibilityInfo.sendAccessibilityEvent(titleRef.current, 'focus');
    }, reduceMotion ? 50 : 350);
    return () => clearTimeout(t);
  }, [visible, reduceMotion]);

  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Close"
        importantForAccessibility="no"
        accessibilityElementsHidden
      />
      <View style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.handle} />
        <View style={styles.titleRow}>
          <Text ref={titleRef} style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel={'Close ' + title}
          >
            <Ionicons name="close" size={22} color={colors.navy} />
          </Pressable>
        </View>
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
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1 },
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: colors.navy },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
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