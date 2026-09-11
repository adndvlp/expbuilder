export type PublicFirebaseWebConfig = {
  apiKey?: string;
  authDomain?: string;
  databaseURL?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
};

export type ResolvedPublicFirebaseConfig = {
  apiKey: string | undefined;
  authDomain: string | undefined;
  databaseURL: string | undefined;
  projectId: string | undefined;
  storageBucket: string | undefined;
  messagingSenderId: string | undefined;
  appId: string | undefined;
};

/**
 * Resolves the Firebase web config baked into generated PUBLIC experiments.
 *
 * Builds without Firebase env vars (e.g. a member's machine) would otherwise
 * bake `"undefined"` strings, and the Firebase SDK dies at startup with
 * "Cannot parse Firebase url". Values resolve from the ACTIVE backend
 * (the operator/member Firebase config) with the build env as fallback.
 * databaseURL is only derived when missing: custom Realtime Database
 * instances cannot be guessed from the project id.
 */
export function resolvePublicFirebaseConfig(
  env: Record<string, string | undefined>,
  active: PublicFirebaseWebConfig | null,
): ResolvedPublicFirebaseConfig {
  const present = (value: string | undefined): string | undefined => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  };
  const projectId =
    present(active?.projectId) ?? present(env.VITE_FIREBASE_PROJECT_ID);
  return {
    apiKey: present(active?.apiKey) ?? present(env.VITE_FIREBASE_API_KEY),
    authDomain:
      present(active?.authDomain) ?? present(env.VITE_FIREBASE_AUTH_DOMAIN),
    databaseURL:
      present(env.VITE_FIREBASE_DATABASE_URL) ??
      (projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : undefined),
    projectId,
    storageBucket:
      present(active?.storageBucket) ?? present(env.VITE_FIREBASE_STORAGE_BUCKET),
    messagingSenderId:
      present(active?.messagingSenderId) ??
      present(env.VITE_FIREBASE_MESSAGING_SENDER_ID),
    appId: present(active?.appId) ?? present(env.VITE_FIREBASE_APP_ID),
  };
}
