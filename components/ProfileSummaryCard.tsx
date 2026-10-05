import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

type Props = {
  name: string;
  tagline: string;
  onChangePhoto?: () => void;
};

export default function ProfileSummaryCard({ name, tagline, onChangePhoto }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={54} color={colors.magenta} style={{ opacity: 0.55 }} />
        </View>
        <Pressable
          onPress={onChangePhoto}
          style={styles.cameraButton}
          accessibilityRole="button"
          accessibilityLabel="Change photo"
        >
          <Ionicons name="camera" size={16} color={colors.white} />
        </Pressable>
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.tagline}>{tagline}</Text>

        <Pressable
          onPress={onChangePhoto}
          style={styles.changePhotoButton}
          accessibilityRole="button"
        >
          <Text style={styles.changePhotoText}>Change photo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.pinkVerySoft,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.magenta,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.pinkVerySoft,
  },
  info: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  name: {
    fontSize: 21,
    fontWeight: '700',
    color: colors.navy,
  },
  tagline: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 3,
  },
  changePhotoButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.pinkSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 10,
  },
  changePhotoText: {
    color: colors.magenta,
    fontWeight: '600',
    fontSize: 14,
  },
});