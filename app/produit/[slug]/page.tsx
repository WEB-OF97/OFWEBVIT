import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/AddToCart";
import { PriceTag } from "@/components/PriceTag";
import { ProductImage } from "@/components/ProductGrid";
import { StockBadge } from "@/components/StockBadge";
import { formatMoney, formatWeight } from "@/lib/format";
import { effectivePrices } from "@/lib/pricing";
import { getProduct } from "@/lib/catalog";

export const revalidate = 30;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { product } = await getProduct(decodeURIComponent(slug));
  return { title: product?.name ?? "Produit" };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const { product } = await getProduct(decodeURIComponent(slug));
  if (!product) notFound();
  const prices = effectivePrices(product);

  return (
    <div className="wrap page">
      <p className="breadcrumb">
        <Link href="/">Catalogue</Link>
        {product.category_code ? (
          <>
            {" · "}
            <Link href={`/categorie/${product.category_code}`}>{product.category_name ?? product.category_code}</Link>
          </>
        ) : null}
      </p>
      <article className="product">
        <div className="product-media">
          <ProductImage product={product} />
        </div>
        <div>
          <p className="ref">Réf. {product.codpro}</p>
          <h1>{product.name}</h1>
          <PriceTag product={product} large />
          {prices.ht != null ? <p className="muted">{formatMoney(prices.ht)} HT</p> : null}
          <StockBadge product={product} />
          {product.unit ? <p>Unité : {product.unit}</p> : null}
          {product.weight != null ? <p>Poids : {formatWeight(product.weight)} kg</p> : null}
          {product.barcodes.length ? <p>Code-barres : {product.barcodes.join(", ")}</p> : null}
          <AddToCart
            codpro={product.codpro}
            slug={product.slug}
            name={product.name}
            imageUrl={product.image_url}
            unitHt={prices.ht}
            unitTtc={prices.ttc}
            showPrice={product.show_price}
            disabled={product.stock <= 0}
          />
          {product.description ? <p className="description">{product.description}</p> : null}
        </div>
      </article>
    </div>
  );
}
