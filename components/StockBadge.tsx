import type { Product } from "@/lib/types";

export function StockBadge({ product }: { product: Product }) {
  const inStock = product.stock > 0;
  if (!product.show_stock) {
    return <span className={inStock ? "stock ok" : "stock out"}>{inStock ? "En stock" : "Épuisé"}</span>;
  }
  if (!inStock) return <span className="stock out">Épuisé</span>;
  return <span className="stock ok">{product.stock.toLocaleString("fr-FR")} en stock</span>;
}
