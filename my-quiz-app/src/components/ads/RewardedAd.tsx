"use client";

import { useState } from "react";
import {
  rewardClaimInputSchema,
  rewardClaimOutputSchema,
} from "@/lib/api/schemas";
import { fetcher } from "@/lib/api/fetcher";

type RewardedAdProps = {
  requestAdProof: () => Promise<string>;
  onRewardGranted?: (mockCredits: number) => void;
};

export function RewardedAd({ requestAdProof, onRewardGranted }: RewardedAdProps) {
  const [isWatching, setIsWatching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function watchAd() {
    if (isWatching) {
      return;
    }
    setIsWatching(true);
    setMessage(null);

    try {
      const proof = await requestAdProof();
      const input = rewardClaimInputSchema.parse({ proof });
      const response: unknown = await fetcher("/api/ads/reward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = rewardClaimOutputSchema.parse(response);
      onRewardGranted?.(result.mockCredits);
      setMessage(`Mock unlocked. You have ${result.mockCredits} mock credit(s).`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "The ad reward could not be claimed.");
    } finally {
      setIsWatching(false);
    }
  }

  return (
    <section aria-label="Rewarded advertisement" className="rounded-lg border p-4">
      <p>Watch an ad to unlock 1 extra mock.</p>
      <button type="button" onClick={() => void watchAd()} disabled={isWatching}>
        {isWatching ? "Waiting for ad completion…" : "Watch ad to unlock 1 extra mock"}
      </button>
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}