"use client";

import { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { updateNotificationToken } from "@/lib/api/notifications";

async function getMessagingRegistration(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser does not support service workers.");
  }

  const isProduction = process.env.NODE_ENV === "production";
  const firebaseConfig = new URLSearchParams({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  });
  const workerUrl = isProduction
    ? "/sw.js"
    : `/firebase-messaging-sw.js?${firebaseConfig.toString()}`;
  const registration = await navigator.serviceWorker.register(workerUrl, { scope: "/" });
  if (registration.active) {
    return registration;
  }

  const readyRegistration = await navigator.serviceWorker.ready;
  if (readyRegistration.scope !== `${window.location.origin}/`) {
    throw new Error("The Firebase messaging service worker could not be activated.");
  }
  return readyRegistration;
}

function getVapidKey(): string {
  const key = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!key) {
    throw new Error("Push notifications are not configured for this app.");
  }
  return key;
}

export function NotificationSetup() {
  const { user } = useAuth();
  const { isVerified } = useUserRole();
  const [isBusy, setIsBusy] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enableNotifications() {
    if (!user || !isVerified || isBusy) {
      return;
    }
    setIsBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (!("Notification" in window)) {
        throw new Error("This browser does not support notifications.");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error(
          permission === "denied"
            ? "Notifications are blocked in browser settings."
            : "Notification permission was not granted.",
        );
      }

      const messagingModule = await import("firebase/messaging");
      if (!(await messagingModule.isSupported())) {
        throw new Error("Push notifications are not supported in this browser.");
      }

      const registration = await getMessagingRegistration();
      const token = await messagingModule.getToken(messagingModule.getMessaging(), {
        vapidKey: getVapidKey(),
        serviceWorkerRegistration: registration,
      });
      if (!token) {
        throw new Error("Firebase did not return a notification token.");
      }
      const result = await updateNotificationToken({ action: "register", token });
      setIsEnabled(true);
      setMessage(result.message);
    } catch (enableError: unknown) {
      setError(enableError instanceof Error ? enableError.message : "Could not enable notifications.");
    } finally {
      setIsBusy(false);
    }
  }

  async function disableNotifications() {
    if (!user || !isVerified || isBusy) {
      return;
    }
    setIsBusy(true);
    setError(null);
    setMessage(null);
    try {
      const messagingModule = await import("firebase/messaging");
      if (!(await messagingModule.isSupported())) {
        setIsEnabled(false);
        setMessage("Notifications are unavailable in this browser.");
        return;
      }
      const token = await messagingModule.getToken(messagingModule.getMessaging(), {
        vapidKey: getVapidKey(),
        serviceWorkerRegistration: await getMessagingRegistration(),
      });
      if (token) {
        await updateNotificationToken({ action: "unregister", token });
        await messagingModule.deleteToken(messagingModule.getMessaging());
      }
      setIsEnabled(false);
      setMessage("Push notifications disabled.");
    } catch (disableError: unknown) {
      setError(disableError instanceof Error ? disableError.message : "Could not disable notifications.");
    } finally {
      setIsBusy(false);
    }
  }

  if (!isVerified) {
    return <p className="text-sm text-muted-foreground">Push notifications are available after email verification.</p>;
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h2 className="font-semibold">Push notifications</h2>
        <p className="text-sm text-muted-foreground">
          Get a reminder when your spaced-repetition questions are due.
        </p>
      </div>
      <button
        className="rounded-md border px-3 py-2"
        type="button"
        disabled={isBusy}
        onClick={() => void (isEnabled ? disableNotifications() : enableNotifications())}
      >
        {isBusy ? "Saving…" : isEnabled ? "Turn off notifications" : "Enable notifications"}
      </button>
      {message ? <p role="status" className="text-sm">{message}</p> : null}
      {error ? <p role="alert" className="text-sm">{error}</p> : null}
    </section>
  );
}
