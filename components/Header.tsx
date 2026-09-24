"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCart } from "./CartProvider";

export function Header() {
  const { count, ready } = useCart();
  const params = useSearchParams();
  const q = params.get("q") ?? "";

  return (
    <header className="site-header">
      <div className="wrap header-row">
        <Link href="/" className="brand">
          <span className="mark">OF</span>
          <span>
            <strong>Office Fournitures</strong>
            <small>Saint-Martin</small>
          </span>
        </Link>
        <form className="search" action="/recherche" method="get">
          <label className="sr" htmlFor="q">
            Rechercher
          </label>
          <input id="q" name="q" type="search" placeholder="Nom, référence ou code-barres" defaultValue={q} />
          <button type="submit">Rechercher</button>
        </form>
        <Link href="/panier" className="cart-link">
          Panier
          <span>{ready ? count : 0}</span>
        </Link>
      </div>
    </header>
  );
}
