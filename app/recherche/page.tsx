import { DemoBanner } from "@/components/DemoBanner";
import { Pagination } from "@/components/Pagination";
import { ProductGrid } from "@/components/ProductGrid";
import { listProducts, parsePage, sanitizeSearch } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export const metadata = { title: "Recherche" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = sanitizeSearch(params.q);
  const page = parsePage(params.page);
  const catalog = params.q ? await listProducts({ q: params.q, page }) : null;

  return (
    <div className="wrap page">
      {catalog?.demo ? <DemoBanner /> : null}
      <h1>Recherche</h1>
      {!params.q ? <p>Saisissez un nom, une référence ou un code-barres.</p> : null}
      {params.q && !q ? <p>Saisissez un terme plus simple.</p> : null}
      {catalog ? (
        <>
          <p className="muted">
            {`${catalog.total} résultat${catalog.total > 1 ? "s" : ""} pour « ${q} »`}
          </p>
          <ProductGrid products={catalog.products} />
          <Pagination page={catalog.page} totalPages={catalog.totalPages} basePath="/recherche" query={{ q }} />
        </>
      ) : null}
    </div>
  );
}
