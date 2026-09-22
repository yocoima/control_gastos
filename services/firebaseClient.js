import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBCWEncZRmIC0CInMFiN5XoGvVPSk0bl60',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'control-de-gastos-e858a.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'control-de-gastos-e858a',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'control-de-gastos-e858a.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '788485557323',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:788485557323:web:6842cbfbbe6e4f78b3d1ce'
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const functions = getFunctions(firebaseApp);
export const storage = getStorage(firebaseApp);

