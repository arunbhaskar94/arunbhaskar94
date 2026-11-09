import { signInAnonymously } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useUserStore } from "@/stores/userStore";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to sign in anonymously.";
}

export async function retryAnonymousSignIn(): Promise<void> {
  const store = useUserStore.getState();
  store.clearAuthError();

  try {
    const credential = await signInAnonymously(auth);
    useUserStore.getState().setAuthState(credential.user);
  } catch (error: unknown) {
    useUserStore.getState().setAuthError(getErrorMessage(error));
  }
}

export function useAuth() {
  const user = useUserStore((state) => state.user);
  const isLoading = useUserStore((state) => state.isLoading);
  const error = useUserStore((state) => state.error);

  return {
    user,
    isLoading,
    error,
    isAuthenticated: user !== null,
    retryAnonymousSignIn,
  };
}