"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useUserStore } from "@/stores/userStore";

type AuthProviderProps = {
  children: ReactNode;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to sign in anonymously.";
}

export function AuthProvider({ children }: AuthProviderProps) {
  const signInPending = useRef(false);
  const setAuthState = useUserStore((state) => state.setAuthState);
  const setAuthError = useUserStore((state) => state.setAuthError);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        signInPending.current = false;
        setAuthState(user);
        return;
      }

      if (signInPending.current) {
        return;
      }

      signInPending.current = true;
      void signInAnonymously(auth)
        .then(({ user: anonymousUser }) => {
          setAuthState(anonymousUser);
        })
        .catch((error: unknown) => {
          setAuthError(getErrorMessage(error));
        })
        .finally(() => {
          signInPending.current = false;
        });
    });

    return unsubscribe;
  }, [setAuthError, setAuthState]);

  return children;
}