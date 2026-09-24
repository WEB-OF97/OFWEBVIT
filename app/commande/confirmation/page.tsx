import { Confirmation } from "@/components/Confirmation";

export const metadata = { title: "Confirmation", robots: { index: false } };

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) {
    return (
      <div className="wrap page">
        <h1>Commande</h1>
        <p>Aucune commande à afficher.</p>
      </div>
    );
  }
  return (
    <div className="wrap page">
      <Confirmation id={id} />
    </div>
  );
}
