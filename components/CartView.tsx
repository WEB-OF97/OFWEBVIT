"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { roundMoney } from "@/lib/pricing";
import { useCart } from "./CartProvider";

export function CartView() {
  const { items, ready, setQty, remove } = useCart();

  if (!ready) return <p>Chargement du panier…</p>;
  if (!items.length) {
    return (
      <p className="empty">
        Votre panier est vide. <Link href="/">Voir le catalogue</Link>
      </p>
    );
  }

  const priced = items.filter((item) => item.unit_ht != null && item.unit_ttc != null);
  const unpriced = items.length - priced.length;
  const totalHt = roundMoney(priced.reduce((sum, item) => sum + (item.unit_ht ?? 0) * item.qty, 0));
  const totalTtc = roundMoney(priced.reduce((sum, item) => sum + (item.unit_ttc ?? 0) * item.qty, 0));

  return (
    <div className="cart">
      <ul className="cart-lines">
        {items.map((item) => (
          <li key={item.codpro}>
            <div>
              <Link href={`/produit/${item.slug}`}>{item.name}</Link>
              <p className="ref">Réf. {item.codpro}</p>
            </div>
            <label>
              Qté
              <input
                type="number"
                min={1}
                max={999}
                value={item.qty}
                onChange={(event) => setQty(item.codpro, Number(event.target.value) || 1)}
              />
            </label>
            <strong>
              {item.unit_ttc == null ? "Prix sur demande" : formatMoney(roundMoney(item.unit_ttc * item.qty))}
            </strong>
            <button type="button" className="linkish" onClick={() => remove(item.codpro)}>
              Retirer
            </button>
          </li>
        ))}
      </ul>
      <div className="totals">
        {unpriced > 0 ? <p>Certains articles sont sur devis. Le total ci-dessous ne les inclut pas.</p> : null}
        <p>
          Total HT <strong>{priced.length ? formatMoney(totalHt) : "—"}</strong>
        </p>
        <p>
          Total TTC <strong>{priced.length ? formatMoney(totalTtc) : "—"}</strong>
        </p>
        <Link href="/commande" className="btn">
          Passer commande
        </Link>
      </div>
    </div>
  );
}
