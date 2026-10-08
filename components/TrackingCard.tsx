import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

type Props = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  status: string;
  onPress?: () => void;
  tracked?: boolean;     // true when she has answered this one
  fullStatus?: string;   // complete value for screen readers (status may be shortened)
  disabled?: boolean;
  muted?: boolean;       // future date: still tappable, so it can explain why it can't be recorded
  ref?: React.Ref<React.ComponentRef<typeof View>>; // lets the screen return focus here after a sheet closes
};

export default function TrackingCard({
  icon, title, status, onPress, tracked = false, fullStatus, disabled = false, muted = false, ref,
}: Props) {
  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        tracked && styles.cardTracked,
        pressed && styles.pressed,
        disabled && styles.disabled,
        muted && styles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title + '. ' + (fullStatus ?? status) + '.'}
      accessibilityHint={
        disabled ? undefined : muted ? 'This is a future date' : (tracked ? 'Edit ' : 'Add ') + title.toLowerCase()
      }
      accessibilityState={{ disabled }}
    >
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={20} color={colors.magenta} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.status, tracked && styles.statusTracked]} numberOfLines={2}>
          {status}
        </Text>
      </View>
      {tracked ? (
        <Ionicons name="chevron-forward" size={18} color={colors.navy} />
      ) : (
        <View style={styles.addPill}>
          <Text style={styles.addText}>Add</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 10,
  },
  cardTracked: {
    borderColor: 'rgba(233,0,111,0.35)',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
  addPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.pinkSoft,
  },
  addText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.magentaText,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.navy,
  },
  status: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  statusTracked: {
    color: colors.navy,
    fontWeight: '600',
  },
});
