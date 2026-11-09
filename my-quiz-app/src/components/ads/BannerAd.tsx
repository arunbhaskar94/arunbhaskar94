"use client";

import Script from "next/script";
import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

export function BannerAd() {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  const slotId = process.env.NEXT_PUBLIC_ADSENSE_SLOT_ID;

  useEffect(() => {
    if (!clientId || !slotId) {
      return;
    }

    try {
      (window.adsbygoogle ??= []).push({});
    } catch (error: unknown) {
      console.error("Could not request the AdSense banner.", error);
    }
  }, [clientId, slotId]);

  return (
    <aside aria-label="Advertisement" className="w-full border-t p-3 text-center">
      {clientId && slotId ? (
        <>
          <Script
            async
            crossOrigin="anonymous"
            strategy="afterInteractive"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`}
          />
          <ins
            className="adsbygoogle block min-h-14"
            style={{ display: "block" }}
            data-ad-client={clientId}
            data-ad-slot={slotId}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        </>
      ) : (
        <div className="rounded border border-dashed p-3 text-sm text-muted-foreground">
          Advertisement
        </div>
      )}
    </aside>
  );
}