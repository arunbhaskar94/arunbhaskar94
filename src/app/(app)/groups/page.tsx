import Link from "next/link";

export default function GroupsPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">Study groups</h1>
      <p className="text-muted-foreground">
        Study group creation and shared chat are being prepared. Check back soon.
      </p>
      <Link className="inline-block rounded-md border px-4 py-2" href="/home">Back to practice</Link>
    </main>
  );
}