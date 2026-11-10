"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authorizeAdmin } from "@/lib/api/admin";
import { useAuth } from "@/lib/hooks/useAuth";

type AdminLayoutProps = {
  children: ReactNode;
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (isAuthLoading) {
      return () => {
        active = false;
      };
    }
    if (!user || user.isAnonymous || !user.emailVerified) {
      router.replace("/home");
      setIsChecking(false);
      return () => {
        active = false;
      };
    }

    void authorizeAdmin()
      .then(() => {
        if (active) {
          setIsChecking(false);
          setError(null);
        }
      })
      .catch((authorizationError: unknown) => {
        if (active) {
          setError(
            authorizationError instanceof Error
              ? authorizationError.message
              : "Administrator authorization failed.",
          );
          setIsChecking(false);
          router.replace("/home");
        }
      });

    return () => {
      active = false;
    };
  }, [isAuthLoading, router, user]);

  if (isAuthLoading || isChecking) {
    return <main aria-live="polite">Checking administrator access…</main>;
  }
  if (error || !user?.emailVerified) {
    return <main role="alert">Administrator access is required.</main>;
  }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[14rem_1fr]">
      <aside className="border-b p-4 md:border-b-0 md:border-r">
        <Link className="font-bold" href="/admin">QuizMaster Admin</Link>
        <nav className="mt-4 flex gap-3 overflow-x-auto md:flex-col">
          <Link href="/admin">Overview</Link>
          <Link href="/admin/questions">Questions</Link>
          <Link href="/admin/ai-queue">AI review</Link>
          <Link href="/admin/users">Users</Link>
          <Link href="/admin/analytics">Analytics</Link>
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  );
}