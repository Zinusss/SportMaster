export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  provider: 'google' | 'password';
  createdAt: string;
  lastLoginAt: string;
}

export interface UserAccountCredentials {
  email: string;
  passwordHash: string;
  user: AuthUser;
}

export interface CloudSyncConfig {
  enabled: boolean;
  apiKey?: string;
  projectId?: string;
  lastSyncedAt?: string;
}
