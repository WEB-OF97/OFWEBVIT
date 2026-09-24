import { CheckoutForm } from "@/components/CheckoutForm";

export const metadata = { title: "Commande", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="wrap page">
      <h1>Commande</h1>
      <CheckoutForm />
    </div>
  );
}
