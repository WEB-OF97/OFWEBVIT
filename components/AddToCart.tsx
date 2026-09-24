"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./CartProvider";

export function AddToCart({
  codpro,
  slug,
  name,
  imageUrl,
  unitHt,
  unitTtc,
  showPrice,
  disabled,
}: {
  codpro: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  unitHt: number | null;
  unitTtc: number | null;
  showPrice: boolean;
  disabled: boolean;
}) {
  const { addItem } = useCart();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  return (
    <form
      className="add-row"
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled) return;
        addItem(
          {
            codpro,
            slug,
            name,
            image_url: imageUrl,
            unit_ht: unitHt,
            unit_ttc: unitTtc,
            show_price: showPrice,
          },
          qty,
        );
        setAdded(true);
        router.push("/panier");
      }}
    >
      <label>
        Quantité
        <input
          type="number"
          min={1}
          max={99}
          value={qty}
          onChange={(event) => setQty(Math.min(99, Math.max(1, Number(event.target.value) || 1)))}
          disabled={disabled}
        />
      </label>
      <button type="submit" className="btn" disabled={disabled}>
        {disabled ? "Épuisé" : "Ajouter au panier"}
      </button>
      {added ? <p className="muted">Ajouté au panier.</p> : null}
    </form>
  );
}
