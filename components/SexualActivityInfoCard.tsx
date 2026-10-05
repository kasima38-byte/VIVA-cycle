import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

type Props = {
  title: string;
  body: string;
};

export default function SexualActivityInfoCard({ title, body }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.leftCol}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>

      <View style={styles.rightCol}>
        <Text style={styles.sideText}>IT'S{'\n'}A PART{'\n'}OF YOUR{'\n'}JOURNEY</Text>
        <Ionicons name="heart" size={11} color={colors.magenta} style={{ alignSelf: 'flex-end', marginTop: 2 }} />

        <View style={styles.heartsWrap}>
          <Ionicons name="heart" size={46} color={colors.magenta} style={styles.heartBig} />
          <Ionicons name="heart" size={30} color={colors.pinkSoft} style={styles.heartSmall} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.pinkVerySoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
  },
  leftCol: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.navy,
  },
  body: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  rightCol: {
    width: 100,
    alignItems: 'flex-end',
  },
  sideText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: colors.magenta,
    textAlign: 'right',
    lineHeight: 12,
  },
  heartsWrap: {
    width: 70,
    height: 50,
    marginTop: 6,
    position: 'relative',
  },
  heartBig: {
    position: 'absolute',
    left: 0,
    bottom: 0,
  },
  heartSmall: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
});