import { requireRole } from "@/lib/auth/session";
import { BoatForm } from "@/components/boat-form";

export default async function NewBoatPage() {
  await requireRole("OWNER");
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold text-zinc-900">List a new boat</h1>
      <BoatForm />
    </main>
  );
}
