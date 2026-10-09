import { useSyncExternalStore } from 'react';
import { getVivaState, setDateOfBirth, setName, useVivaStore } from '../lib/vivaStore';
import { userProfile } from './profileData';

export type Units = 'Metric' | 'Imperial';

export type Profile = {
  name: string;          // saved in lib/vivaStore.ts (single source, set at onboarding)
  tagline: string;
  photoUri: string | null;
  dateOfBirth: string;   // YYYY-MM-DD, saved in lib/vivaStore.ts
  email: string;
  phone: string;
  units: Units;
};

// Non-cycle extras (not yet saved between sessions).
let extras: Omit<Profile, 'name' | 'dateOfBirth'> = {
  tagline: userProfile.tagline,
  photoUri: null,
  email: '',
  phone: '',
  units: 'Metric',
};

const listeners = new Set<() => void>();
let cached: Profile | null = null;
let cachedFrom: { extras: typeof extras; name: string; dob: string | null } | null = null;

export function getProfile(): Profile {
  const v = getVivaState();
  if (!cached || !cachedFrom || cachedFrom.extras !== extras || cachedFrom.name !== v.name || cachedFrom.dob !== v.dateOfBirth) {
    cached = { ...extras, name: v.name, dateOfBirth: v.dateOfBirth ?? '' };
    cachedFrom = { extras, name: v.name, dob: v.dateOfBirth };
  }
  return cached;
}

export function updateProfile(patch: Partial<Profile>) {
  const { name, dateOfBirth, ...rest } = patch;
  if (name !== undefined) setName(name);
  if (dateOfBirth !== undefined) setDateOfBirth(dateOfBirth || null);
  if (Object.keys(rest).length) {
    extras = { ...extras, ...rest };
    listeners.forEach((l) => l());
  }
}

/** After "Delete all my data": forget the photo, email, phone and units held in memory. */
export function resetProfileExtras() {
  extras = {
    tagline: userProfile.tagline,
    photoUri: null,
    email: '',
    phone: '',
    units: 'Metric',
  };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Re-renders when either the saved VIVA profile or the extras change.
export function useProfile(): Profile {
  useVivaStore();
  return useSyncExternalStore(subscribe, getProfile);
}
