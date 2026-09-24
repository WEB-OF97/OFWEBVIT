import { CategoryList } from "@/components/CategoryList";
import { DemoBanner } from "@/components/DemoBanner";
import { Pagination } from "@/components/Pagination";
import { ProductGrid } from "@/components/ProductGrid";
import { listCategories, listProducts, parsePage } from "@/lib/catalog";

export const revalidate = 120;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const [categories, catalog] = await Promise.all([listCategories(), listProducts({ page })]);

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <p className="eyebrow">Saint-Martin</p>
          <h1>Fournitures de bureau</h1>
          <p>Catalogue, prix TTC et commande. Magasins à Galisbay et Hope Estate.</p>
        </div>
      </section>
      <div className="wrap">
        {catalog.demo ? <DemoBanner /> : null}
        <section className="section">
          <h2>Catégories</h2>
          <CategoryList categories={categories} />
        </section>
        <section className="section">
          <h2>Produits</h2>
          <p className="muted">{`${catalog.total} article${catalog.total > 1 ? "s" : ""}`}</p>
          <ProductGrid products={catalog.products} />
          <Pagination page={catalog.page} totalPages={catalog.totalPages} basePath="/" />
        </section>
      </div>
    </>
  );
}
