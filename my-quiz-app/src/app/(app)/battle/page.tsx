import Link from "next/link";

export default function BattlePage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">1v1 battles</h1>
      <p className="text-muted-foreground">
        Live matchmaking is being prepared. Keep practicing and check back soon.
      </p>
      <Link className="inline-block rounded-md border px-4 py-2" href="/home">Back to practice</Link>
    </main>
  );
}