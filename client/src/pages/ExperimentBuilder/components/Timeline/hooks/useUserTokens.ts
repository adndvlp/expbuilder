import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../../../lib/firebase";

export type UserTokens = {
  drive: boolean;
  dropbox: boolean;
  osf: boolean;
  github: boolean;
};

const EMPTY_TOKENS: UserTokens = {
  drive: false,
  dropbox: false,
  osf: false,
  github: false,
};

export async function getUserTokens(uid: string): Promise<UserTokens> {
  const cacheKey = `userTokens_${uid}`;
  const cacheTtl = 5 * 60 * 1000;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { tokens, ts } = JSON.parse(cached);
      if (Date.now() - ts < cacheTtl) return tokens;
    }
  } catch {
    // Ignore malformed or unavailable cache entries and load fresh tokens.
  }

  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const { db } = await import("../../../../../lib/firebase");
    const docSnapshot = await getDoc(doc(db, "users", uid));
    if (!docSnapshot.exists()) {
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ tokens: EMPTY_TOKENS, ts: Date.now() }),
      );
      return EMPTY_TOKENS;
    }
    const data = docSnapshot.data();
    const tokens = {
      drive: !!data.googleDriveTokens,
      dropbox: !!data.dropboxTokens,
      osf: !!data.osfTokens,
      github: !!data.githubTokens,
    };
    localStorage.setItem(cacheKey, JSON.stringify({ tokens, ts: Date.now() }));
    return tokens;
  } catch {
    return EMPTY_TOKENS;
  }
}

export function useUserTokens() {
  const [userTokens, setUserTokens] = useState<UserTokens | null>(null);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser?.uid) {
        getUserTokens(firebaseUser.uid).then(setUserTokens);
      } else {
        setUserTokens(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const isDisabledByTokens = () =>
    !(
      userTokens?.github &&
      (userTokens.drive || userTokens.dropbox || userTokens.osf)
    );
  return { getUserTokens, isDisabledByTokens };
}
