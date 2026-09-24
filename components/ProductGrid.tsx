import Link from "next/link";
import type { Product } from "@/lib/types";
import { PriceTag } from "./PriceTag";
import { StockBadge } from "./StockBadge";

export function ProductImage({ product }: { product: Product }) {
  if (product.image_url) {
    return <img src={product.image_url} alt="" />;
  }
  return (
    <span className="img-fallback" aria-hidden="true">
      {product.codpro}
    </span>
  );
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="card">
      <Link href={`/produit/${product.slug}`} className="card-media">
        <ProductImage product={product} />
      </Link>
      <div className="card-body">
        <p className="ref">Réf. {product.codpro}</p>
        <h3>
          <Link href={`/produit/${product.slug}`}>{product.name}</Link>
        </h3>
        {product.category_name ? <p className="muted">{product.category_name}</p> : null}
        <PriceTag product={product} />
        <StockBadge product={product} />
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  if (!products.length) return <p className="empty">Aucun produit.</p>;
  return (
    <div className="grid">
      {products.map((product) => (
        <ProductCard key={product.codpro} product={product} />
      ))}
    </div>
  );
}
