"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./CartProvider";

export function CheckoutForm() {
  const { items, ready, clear } = useCart();
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (!ready) return <p>Chargement…</p>;
  if (!items.length) return <p className="empty">Votre panier est vide.</p>;

  return (
    <form
      className="checkout"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setPending(true);
        const form = new FormData(event.currentTarget);
        try {
          const response = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customer_name: form.get("customer_name"),
              customer_email: form.get("customer_email"),
              customer_phone: form.get("customer_phone"),
              shipping_address: form.get("shipping_address"),
              items: items.map((item) => ({ codpro: item.codpro, qty: item.qty })),
            }),
          });
          const payload = (await response.json()) as {
            id?: string;
            error?: string;
            demo?: boolean;
            total_ht?: number | null;
            total_ttc?: number | null;
            lines?: number;
          };
          if (!response.ok || !payload.id) {
            setError(payload.error || "Commande impossible.");
            setPending(false);
            return;
          }
          sessionStorage.setItem(
            `of-order-${payload.id}`,
            JSON.stringify({
              id: payload.id,
              demo: payload.demo,
              total_ht: payload.total_ht,
              total_ttc: payload.total_ttc,
              lines: payload.lines,
            }),
          );
          clear();
          router.push(`/commande/confirmation?id=${payload.id}`);
        } catch {
          setError("Commande impossible.");
          setPending(false);
        }
      }}
    >
      <label>
        Nom
        <input name="customer_name" required autoComplete="name" />
      </label>
      <label>
        Email
        <input name="customer_email" type="email" required autoComplete="email" />
      </label>
      <label>
        Téléphone
        <input name="customer_phone" required autoComplete="tel" />
      </label>
      <label>
        Adresse de livraison
        <textarea name="shipping_address" required rows={4} autoComplete="street-address" />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button type="submit" className="btn" disabled={pending}>
        {pending ? "Envoi…" : "Confirmer la commande"}
      </button>
      <p className="muted">Paiement à brancher plus tard. Aucune carte bancaire n&apos;est demandée.</p>
    </form>
  );
}
