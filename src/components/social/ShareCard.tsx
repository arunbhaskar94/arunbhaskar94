 "use client";

import { useState } from "react";

export type ShareCardProps = {
  displayName: string;
  level: number;
  xp: number;
  streak: number;
};

function drawCard(
  canvas: HTMLCanvasElement,
  { displayName, level, xp, streak }: ShareCardProps,
): void {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not supported in this browser.");
  }

  const scale = 2;
  canvas.width = 1200 * scale;
  canvas.height = 630 * scale;
  context.scale(scale, scale);

  const background = context.createLinearGradient(0, 0, 1200, 630);
  background.addColorStop(0, "#172554");
  background.addColorStop(1, "#2563eb");
  context.fillStyle = background;
  context.fillRect(0, 0, 1200, 630);

  context.fillStyle = "rgba(255,255,255,0.12)";
  context.beginPath();
  context.arc(1050, 80, 260, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#bfdbfe";
  context.font = "700 30px system-ui, sans-serif";
  context.fillText("QUIZMASTER", 76, 82);

  context.fillStyle = "#ffffff";
  context.font = "700 64px system-ui, sans-serif";
  context.fillText(displayName.trim().slice(0, 28) || "Learner", 76, 230);
  context.font = "500 32px system-ui, sans-serif";
  context.fillStyle = "#dbeafe";
  context.fillText("My exam-prep progress", 76, 288);

  const stats = [
    { value: `Level ${Math.min(100, Math.max(1, level))}`, label: "LEVEL" },
    { value: `${Math.max(0, xp).toLocaleString()} XP`, label: "EXPERIENCE" },
    { value: `${Math.max(0, streak)} days`, label: "DAILY STREAK" },
  ];
  stats.forEach((stat, index) => {
    const x = 76 + index * 352;
    context.fillStyle = "rgba(255,255,255,0.14)";
    context.beginPath();
    context.roundRect(x, 365, 320, 170, 22);
    context.fill();
    context.fillStyle = "#ffffff";
    context.font = "700 42px system-ui, sans-serif";
    context.fillText(stat.value, x + 24, 440);
    context.font = "600 20px system-ui, sans-serif";
    context.fillStyle = "#bfdbfe";
    context.fillText(stat.label, x + 24, 485);
  });
}

export function ShareCard(props: ShareCardProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadCard() {
    if (isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      drawCard(canvas, props);
      const image = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Could not create the share image."));
        }, "image/png");
      });
      const url = URL.createObjectURL(image);
      const link = document.createElement("a");
      link.href = url;
      link.download = "quizmaster-progress.png";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (generationError: unknown) {
      setError(generationError instanceof Error ? generationError.message : "Could not create the share image.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h2 className="font-semibold">Share your progress</h2>
        <p className="text-sm text-muted-foreground">Download a share card as a PNG image.</p>
      </div>
      <button className="rounded-md border px-3 py-2" type="button" disabled={isGenerating} onClick={() => void downloadCard()}>
        {isGenerating ? "Creating image…" : "Download share card"}
      </button>
      {error ? <p role="alert" className="text-sm">{error}</p> : null}
    </section>
  );
}