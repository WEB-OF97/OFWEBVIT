import { formatMoney } from "@/lib/format";
import { effectivePrices } from "@/lib/pricing";
import type { Product } from "@/lib/types";

export function PriceTag({ product, large = false }: { product: Product; large?: boolean }) {
  const prices = effectivePrices(product);
  if (prices.ttc == null) return <span className="price ask">Prix sur demande</span>;
  return (
    <span className={large ? "price price-lg" : "price"}>
      {prices.promo && product.price_ttc != null ? <s>{formatMoney(product.price_ttc)}</s> : null}
      <strong>{formatMoney(prices.ttc)}</strong>
      <small>TTC</small>
    </span>
  );
}
