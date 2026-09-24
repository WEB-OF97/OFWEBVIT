import { PAGE_SIZE } from "./constants";
import { sampleCategories, sampleProducts } from "./sample-data";
import { createAnonServerSupabase } from "./supabase";
import type { CatalogPage, Category, Product } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";

let demoCache: { value: boolean; expires: number } | null = null;

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapRow(
  row: Record<string, unknown>,
  categoryName: string | null,
  barcodes: string[],
): Product {
  return {
    codpro: String(row.codpro),
    name: String(row.name),
    slug: row.slug ? String(row.slug) : String(row.codpro),
    description: row.description ? String(row.description) : null,
    category_code: row.category_code ? String(row.category_code) : null,
    category_name: categoryName,
    unit: row.unit ? String(row.unit) : null,
    price_ht: num(row.price_ht),
    vat_rate: num(row.vat_rate),
    price_ttc: num(row.price_ttc),
    promo_ht: num(row.promo_ht),
    promo_start: row.promo_start ? String(row.promo_start).slice(0, 10) : null,
    promo_end: row.promo_end ? String(row.promo_end).slice(0, 10) : null,
    weight: num(row.weight),
    stock: Math.max(0, Math.round(num(row.stock) ?? 0)),
    image_url: row.image_url ? String(row.image_url) : null,
    show_price: Boolean(row.show_price),
    show_stock: Boolean(row.show_stock),
    published: Boolean(row.published),
    barcodes,
  };
}

export function sanitizeSearch(value: string | undefined): string {
  if (!value) return "";
  return value.replace(/[%_,().*\\'"]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function parsePage(value: string | undefined): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return 1;
  return n;
}

export async function catalogIsDemo(): Promise<boolean> {
  if (demoCache && demoCache.expires > Date.now()) return demoCache.value;
  const sb = createAnonServerSupabase();
  let demo = true;
  if (sb) {
    const { count, error } = await sb
      .from("products")
      .select("codpro", { count: "exact", head: true })
      .eq("published", true);
    demo = Boolean(error) || !count;
  }
  demoCache = { value: demo, expires: Date.now() + 30_000 };
  return demo;
}

async function hydrate(
  sb: SupabaseClient,
  rows: Record<string, unknown>[],
  withBarcodes: boolean,
): Promise<Product[]> {
  const codes = [...new Set(rows.map((row) => row.category_code).filter(Boolean).map(String))];
  const names = new Map<string, string>();
  if (codes.length) {
    const { data } = await sb.from("categories").select("code,name").in("code", codes);
    for (const category of data ?? []) names.set(String(category.code), String(category.name));
  }

  const barcodeMap = new Map<string, string[]>();
  if (withBarcodes && rows.length) {
    const ids = rows.map((row) => String(row.codpro));
    const { data } = await sb.from("product_barcodes").select("codpro,barcode").in("codpro", ids);
    for (const row of data ?? []) {
      const id = String(row.codpro);
      const list = barcodeMap.get(id) ?? [];
      list.push(String(row.barcode));
      barcodeMap.set(id, list);
    }
  }

  return rows.map((row) =>
    mapRow(row, names.get(String(row.category_code)) ?? null, barcodeMap.get(String(row.codpro)) ?? []),
  );
}

function filterSample(opts: { category?: string; q?: string; page: number }): CatalogPage {
  let items = sampleProducts.filter((product) => product.published);
  if (opts.category) items = items.filter((product) => product.category_code === opts.category);
  const q = sanitizeSearch(opts.q).toLowerCase();
  if (opts.q !== undefined && !q) {
    return { products: [], total: 0, page: 1, totalPages: 1, demo: true };
  }
  if (q) {
    items = items.filter(
      (product) =>
        product.name.toLowerCase().includes(q) ||
        product.codpro.toLowerCase().includes(q) ||
        product.barcodes.some((barcode) => barcode.toLowerCase().includes(q)),
    );
  }
  items.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(opts.page, totalPages);
  const start = (page - 1) * PAGE_SIZE;
  return { products: items.slice(start, start + PAGE_SIZE), total, page, totalPages, demo: true };
}

export async function listCategories(): Promise<Category[]> {
  if (await catalogIsDemo()) return sampleCategories;
  const sb = createAnonServerSupabase();
  if (!sb) return sampleCategories;
  const { data, error } = await sb.from("categories").select("code,name,image_url").order("name");
  if (error || !data) return [];
  return data.map((row) => ({
    code: String(row.code),
    name: String(row.name),
    image_url: row.image_url ? String(row.image_url) : null,
  }));
}

export async function getCategory(code: string): Promise<Category | null> {
  const categories = await listCategories();
  return categories.find((category) => category.code === code) ?? null;
}

export async function listProducts(opts: {
  category?: string;
  q?: string;
  page: number;
}): Promise<CatalogPage> {
  if (await catalogIsDemo()) return filterSample(opts);

  const sb = createAnonServerSupabase();
  if (!sb) return filterSample(opts);

  const q = opts.q !== undefined ? sanitizeSearch(opts.q) : "";
  if (opts.q !== undefined && !q) {
    return { products: [], total: 0, page: 1, totalPages: 1, demo: false };
  }

  let query = sb.from("products").select("*", { count: "exact" }).eq("published", true);
  if (opts.category) query = query.eq("category_code", opts.category);
  if (q) {
    const { data: bars } = await sb.from("product_barcodes").select("codpro").ilike("barcode", `%${q}%`).limit(50);
    const ids = [...new Set((bars ?? []).map((row) => String(row.codpro)).filter((id) => /^[A-Za-z0-9._-]+$/.test(id)))];
    const parts = [`name.ilike.%${q}%`, `codpro.ilike.%${q}%`];
    if (ids.length) parts.push(`codpro.in.(${ids.join(",")})`);
    query = query.or(parts.join(","));
  }

  const from = (opts.page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, error, count } = await query.order("name").range(from, to);
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  if ((data?.length ?? 0) === 0 && total > 0 && opts.page > 1) {
    const last = Math.ceil(total / PAGE_SIZE);
    if (last !== opts.page) return listProducts({ ...opts, page: last });
  }

  const products = await hydrate(sb, (data ?? []) as Record<string, unknown>[], false);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return { products, total, page: Math.min(opts.page, totalPages), totalPages, demo: false };
}

export async function getProduct(slug: string): Promise<{ product: Product | null; demo: boolean }> {
  if (await catalogIsDemo()) {
    return { product: sampleProducts.find((item) => item.slug === slug) ?? null, demo: true };
  }
  const sb = createAnonServerSupabase();
  if (!sb) return { product: null, demo: true };
  const { data, error } = await sb.from("products").select("*").eq("slug", slug).eq("published", true).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { product: null, demo: false };
  const [product] = await hydrate(sb, [data as Record<string, unknown>], true);
  return { product, demo: false };
}

export async function getProductsByCodpro(ids: string[]): Promise<Product[]> {
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  if (await catalogIsDemo()) {
    const wanted = new Set(unique);
    return sampleProducts.filter((product) => wanted.has(product.codpro) && product.published);
  }
  const sb = createAnonServerSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from("products").select("*").in("codpro", unique).eq("published", true);
  if (error) throw new Error(error.message);
  return hydrate(sb, (data ?? []) as Record<string, unknown>[], false);
}
