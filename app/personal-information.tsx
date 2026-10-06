import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FormField from '../components/FormField';
import { Units, getProfile, updateProfile } from '../constants/profileStore';
import { colors, radius, spacing } from '../constants/theme';

type Errors = { name?: string; email?: string; phone?: string; dob?: string };

function toDate(key: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return new Date(2000, 0, 1); // date of birth not set yet
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toKey(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + mm + '-' + dd;
}

function formatDisplay(key: string) {
  if (!key) return 'Not set';
  return toDate(key).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export default function PersonalInformationScreen() {
  const saved = getProfile();

  const [name, setName] = useState(saved.name);
  const [dob, setDob] = useState(saved.dateOfBirth);
  const [email, setEmail] = useState(saved.email);
  const [phone, setPhone] = useState(saved.phone);
  const [units, setUnits] = useState<Units>(saved.units);
  const [photoUri, setPhotoUri] = useState<string | null>(saved.photoUri);
  const [showPicker, setShowPicker] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const dirty =
    name !== saved.name ||
    dob !== saved.dateOfBirth ||
    email !== saved.email ||
    phone !== saved.phone ||
    units !== saved.units ||
    photoUri !== saved.photoUri;

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in Settings to take a photo.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!res.canceled) setPhotoUri(res.assets[0].uri);
  };

  const choosePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photo access needed', 'Allow photo access in Settings to choose a photo.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!res.canceled) setPhotoUri(res.assets[0].uri);
  };

  const changePhoto = () => {
    Alert.alert('Change photo', undefined, [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Photos', onPress: choosePhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const validate = (): Errors => {
    const e: Errors = {};
    const n = name.trim();
    if (!n) e.name = 'Please enter your name.';
    else if (n.length > 60) e.name = 'Please keep your name under 60 characters.';

    const em = email.trim();
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      e.email = 'Please enter a valid email address.';
    }

    const ph = phone.trim();
    if (ph) {
      const digits = ph.replace(/\D/g, '');
      if (!/^[+\d\s()-]+$/.test(ph) || digits.length < 7 || digits.length > 15) {
        e.phone = 'Please enter a valid phone number.';
      }
    }

    if (toDate(dob) > new Date()) e.dob = 'Please choose a date in the past.';
    return e;
  };

  const handleSave = () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    try {
      updateProfile({
        name: name.trim(),
        dateOfBirth: dob,
        email: email.trim(),
        phone: phone.trim(),
        units,
        photoUri,
      });
      Alert.alert('Profile updated.', undefined, [{ text: 'OK', onPress: () => router.back() }]);
    } catch {
      Alert.alert("Couldn't save your changes. Please try again.");
    }
  };

  const goBack = () => {
    if (!dirty) {
      router.back();
      return;
    }
    Alert.alert('Discard changes?', 'You have unsaved changes. Are you sure you want to leave?', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  };
  
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerTopRow}>
              <Pressable
                onPress={goBack}
                hitSlop={14}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="chevron-back" size={26} color={colors.navy} />
              </Pressable>
              <View style={{ width: 90, height: 40 }} />
            </View>

            <View style={styles.header}>
              <Text style={styles.title}>Personal Information</Text>
              <Text style={styles.subtitle}>Keep your profile information up to date.</Text>
            </View>

            <View style={styles.photoWrap}>
              <View style={styles.avatar} accessibilityLabel="Profile photo">
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.initials}>{initialsOf(name)}</Text>
                )}
              </View>
              <Pressable onPress={changePhoto} accessibilityRole="button" accessibilityLabel="Change photo">
                <Text style={styles.changePhoto}>Change Photo</Text>
              </Pressable>
            </View>
            
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Personal Details</Text>

              <FormField
                label="Full Name"
                value={name}
                onChangeText={setName}
                error={errors.name}
                autoCapitalize="words"
                maxLength={60}
              />

              <View style={styles.fieldWrap}>
                <Text style={styles.fieldLabel}>Date of Birth</Text>
                <Pressable
                  style={[styles.dobButton, errors.dob ? styles.dobError : null]}
                  onPress={() => setShowPicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel={'Date of birth, ' + formatDisplay(dob)}
                >
                  <Text style={styles.dobText}>{formatDisplay(dob)}</Text>
                  <Ionicons name="calendar-outline" size={18} color={colors.magenta} />
                </Pressable>
                {errors.dob ? <Text style={styles.errorText}>{errors.dob}</Text> : null}
                {showPicker && (
                  <DateTimePicker
                    value={toDate(dob)}
                    mode="date"
                    maximumDate={new Date()}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(_, selected) => {
                      if (Platform.OS !== 'ios') setShowPicker(false);
                      if (selected) setDob(toKey(selected));
                    }}
                  />
                )}
                {showPicker && Platform.OS === 'ios' && (
                  <Pressable onPress={() => setShowPicker(false)} accessibilityRole="button">
                    <Text style={styles.changePhoto}>Done</Text>
                  </Pressable>
                )}
              </View>

              <FormField
                label="Email"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <FormField
                label="Phone Number"
                value={phone}
                onChangeText={setPhone}
                error={errors.phone}
                keyboardType="phone-pad"
                placeholder="Optional"
              />
            </View>
            
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Personal Preferences</Text>
              <Text style={styles.fieldLabel}>Units</Text>
              <View style={styles.unitsRow}>
                {(['Metric', 'Imperial'] as Units[]).map((u) => {
                  const active = units === u;
                  return (
                    <Pressable
                      key={u}
                      onPress={() => setUnits(u)}
                      style={[styles.unitOption, active && styles.unitActive]}
                      accessibilityRole="button"
                      accessibilityLabel={'Units ' + u}
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.unitText, active && styles.unitTextActive]}>{u}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Pressable
              onPress={handleSave}
              style={styles.saveButton}
              accessibilityRole="button"
              accessibilityLabel="Save changes"
            >
              <Text style={styles.saveText}>Save Changes</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screen },
  safe: { flex: 1 },
  content: {
    paddingHorizontal: spacing.screenH,
    paddingBottom: 60,
    gap: spacing.lg,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  header: { gap: 6 },
  title: { fontSize: 28, fontWeight: '700', color: colors.navy },
  subtitle: { fontSize: 15, color: colors.textSecondary },
  photoWrap: { alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 96, height: 96 },
  initials: { fontSize: 32, fontWeight: '700', color: colors.magenta },
  changePhoto: { color: colors.magenta, fontWeight: '600', fontSize: 14.5 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.navy },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  dobButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  dobError: { borderColor: colors.magenta },
  dobText: { fontSize: 15.5, color: colors.navy },
  errorText: { fontSize: 12.5, color: colors.magenta },
  unitsRow: { flexDirection: 'row', gap: spacing.sm },
  unitOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.pinkVerySoft,
  },
  unitActive: { borderColor: colors.magenta, backgroundColor: colors.white },
  unitText: { fontSize: 14.5, fontWeight: '600', color: colors.navy },
  unitTextActive: { color: colors.magenta },
  saveButton: {
    backgroundColor: colors.magenta,
    borderRadius: radius.pill,
    paddingVertical: 18,
    alignItems: 'center',
  },
  saveText: { color: colors.white, fontWeight: '700', fontSize: 17 },
});