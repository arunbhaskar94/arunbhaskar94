import { useUserStore } from "@/stores/userStore";
import type { UserRole } from "@/types/user";

export function useUserRole() {
  const user = useUserStore((state) => state.user);
  const isLoading = useUserStore((state) => state.isLoading);

  const role: UserRole = !user || user.isAnonymous || !user.emailVerified ? "anon" : "verified";

  return {
    role,
    isLoading,
    isAnonymous: role === "anon",
    isVerified: role === "verified",
    isAdmin: false,
  };
}