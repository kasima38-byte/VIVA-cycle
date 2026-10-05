import { StyleSheet, View } from 'react-native';
import { colors } from '../constants/theme';

/**
 * Placeholder fertility illustration — layered petal shapes, a central
 * "egg" sphere, and simple sperm-cell silhouettes, built from vector
 * shapes in the VIVA palette. Swap for the official illustration asset
 * when one is supplied.
 */
export default function FertilityIllustration() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={[styles.petal, { backgroundColor: colors.pinkSoft, transform: [{ rotate: '-20deg' }], left: 10, top: 10 }]} />
      <View style={[styles.petal, { backgroundColor: '#F7C7DE', transform: [{ rotate: '20deg' }], right: 6, top: 4 }]} />
      <View style={[styles.petal, { backgroundColor: '#F9D6E6', transform: [{ rotate: '70deg' }], left: 30, bottom: 8 }]} />
      <View style={[styles.petal, { backgroundColor: '#F7C7DE', transform: [{ rotate: '-70deg' }], right: 20, bottom: 4 }]} />

      <View style={styles.egg}>
        <View style={styles.eggHighlight} />
      </View>

      <View style={[styles.sperm, { left: 20, bottom: 26, transform: [{ rotate: '35deg' }] }]}>
        <View style={styles.spermHead} />
        <View style={styles.spermTail} />
      </View>
      <View style={[styles.sperm, { right: 14, bottom: 46, transform: [{ rotate: '-25deg' }] }]}>
        <View style={styles.spermHead} />
        <View style={styles.spermTail} />
      </View>
      <View style={[styles.sperm, { right: 36, bottom: 10, transform: [{ rotate: '10deg' }] }]}>
        <View style={styles.spermHead} />
        <View style={styles.spermTail} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 150,
    height: 150,
    position: 'relative',
  },
  petal: {
    position: 'absolute',
    width: 70,
    height: 100,
    borderTopLeftRadius: 70,
    borderTopRightRadius: 70,
    borderBottomLeftRadius: 70,
    borderBottomRightRadius: 10,
    opacity: 0.85,
  },
  egg: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.magenta,
    left: 48,
    top: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eggHighlight: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignSelf: 'flex-start',
    marginLeft: 8,
    marginTop: 6,
  },
  sperm: {
    position: 'absolute',
  },
  spermHead: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.magenta,
  },
  spermTail: {
    width: 2,
    height: 22,
    backgroundColor: colors.magenta,
    marginLeft: 4,
    borderRadius: 1,
  },
});