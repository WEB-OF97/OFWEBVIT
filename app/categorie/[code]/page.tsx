import type { Metadata } from "next";
import { CategoryList } from "@/components/CategoryList";
import { DemoBanner } from "@/components/DemoBanner";
import { Pagination } from "@/components/Pagination";
import { ProductGrid } from "@/components/ProductGrid";
import { getCategory, listCategories, listProducts, parsePage } from "@/lib/catalog";

export const revalidate = 120;

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const category = await getCategory(decodeURIComponent(code));
  return { title: category?.name ?? "Catégorie" };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  const categoryCode = decodeURIComponent(code);
  const page = parsePage(query.page);
  const [categories, category, catalog] = await Promise.all([
    listCategories(),
    getCategory(categoryCode),
    listProducts({ category: categoryCode, page }),
  ]);

  return (
    <div className="wrap page">
      {catalog.demo ? <DemoBanner /> : null}
      <h1>{category?.name ?? categoryCode}</h1>
      <CategoryList categories={categories} active={categoryCode} />
      <ProductGrid products={catalog.products} />
      <Pagination page={catalog.page} totalPages={catalog.totalPages} basePath={`/categorie/${categoryCode}`} />
    </div>
  );
}
