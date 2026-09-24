import { CartView } from "@/components/CartView";

export const metadata = { title: "Panier", robots: { index: false } };

export default function CartPage() {
  return (
    <div className="wrap page">
      <h1>Panier</h1>
      <CartView />
    </div>
  );
}
