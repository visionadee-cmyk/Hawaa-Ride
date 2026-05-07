import Constants from 'expo-constants';
import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore } from 'firebase/firestore';

type FirebaseExtra = {
  firebase?: {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
    measurementId?: string;
  };
};

const extra = (Constants.expoConfig?.extra ?? {}) as FirebaseExtra;
const firebaseConfig = extra.firebase ?? {};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
  throw new Error(
    'Firebase config missing. Fill expo.extra.firebase in app.json (apiKey, projectId, appId) then restart Expo with --clear.'
  );
}

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);
export const rtdb = getDatabase(app);
