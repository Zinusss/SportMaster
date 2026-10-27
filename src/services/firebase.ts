import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, Auth } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, Firestore } from 'firebase/firestore';

const CONFIG_STORAGE_KEY = 'sportmaster_firebase_config_v1';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

export function getSavedFirebaseConfig(): FirebaseConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function saveFirebaseConfig(cfg: FirebaseConfig) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg));
  } catch (e) {
    console.error('Failed to save Firebase config', e);
  }
}

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

export function getFirebaseServices(): { auth: Auth | null; db: Firestore | null; isReady: boolean } {
  if (appInstance && authInstance && dbInstance) {
    return { auth: authInstance, db: dbInstance, isReady: true };
  }

  const cfg = getSavedFirebaseConfig();
  if (!cfg || !cfg.apiKey || !cfg.projectId) {
    return { auth: null, db: null, isReady: false };
  }

  try {
    if (!getApps().length) {
      appInstance = initializeApp(cfg);
    } else {
      appInstance = getApps()[0];
    }
    authInstance = getAuth(appInstance);
    dbInstance = getFirestore(appInstance);
    return { auth: authInstance, db: dbInstance, isReady: true };
  } catch (e) {
    console.warn('Firebase init error', e);
    return { auth: null, db: null, isReady: false };
  }
}

export async function loginWithFirebaseGoogle(): Promise<{ email: string; name: string; avatar: string; uid: string }> {
  const { auth, isReady } = getFirebaseServices();
  if (!isReady || !auth) {
    throw new Error('Firebase ще не налаштовано');
  }

  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  return {
    email: user.email || '',
    name: user.displayName || user.email?.split('@')[0] || 'Користувач',
    avatar: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.email}`,
    uid: user.uid
  };
}

export async function syncDataToFirestore(uid: string, data: { profile: any; days: any; chat: any }) {
  const { db, isReady } = getFirebaseServices();
  if (!isReady || !db) return false;

  try {
    const userDoc = doc(db, 'sportmaster_users', uid);
    await setDoc(userDoc, {
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return true;
  } catch (e) {
    console.error('Failed to sync to Firestore', e);
    return false;
  }
}

export async function loadDataFromFirestore(uid: string): Promise<any | null> {
  const { db, isReady } = getFirebaseServices();
  if (!isReady || !db) return null;

  try {
    const userDoc = doc(db, 'sportmaster_users', uid);
    const snap = await getDoc(userDoc);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (e) {
    console.error('Failed to read from Firestore', e);
    return null;
  }
}
