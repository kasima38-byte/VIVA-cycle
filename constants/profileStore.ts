import { useSyncExternalStore } from 'react';
import { userProfile } from './profileData';

export type Units = 'Metric' | 'Imperial';

export type Profile = {
  name: string;
  tagline: string;
  photoUri: string | null;
  dateOfBirth: string; // YYYY-MM-DD
  email: string;
  phone: string;
  units: Units;
};

// Demo values. Replace with the signed-in user's real data later.
let profile: Profile = {
  name: userProfile.name,
  tagline: userProfile.tagline,
  photoUri: null,
  dateOfBirth: '1996-04-02',
  email: 'kasima@example.com',
  phone: '',
  units: 'Metric',
};

const listeners = new Set<() => void>();

export function getProfile(): Profile {
  return profile;
}

export function updateProfile(patch: Partial<Profile>) {
  profile = { ...profile, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Any screen that calls this re-renders when the profile changes.
export function useProfile(): Profile {
  return useSyncExternalStore(subscribe, getProfile);
}