export type Category = {
  code: string;
  name: string;
  image_url: string | null;
};

export type Product = {
  codpro: string;
  name: string;
  slug: string;
  description: string | null;
  category_code: string | null;
  category_name: string | null;
  unit: string | null;
  price_ht: number | null;
  vat_rate: number | null;
  price_ttc: number | null;
  promo_ht: number | null;
  promo_start: string | null;
  promo_end: string | null;
  weight: number | null;
  stock: number;
  image_url: string | null;
  show_price: boolean;
  show_stock: boolean;
  published: boolean;
  barcodes: string[];
};

export type CatalogPage = {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
  demo: boolean;
};

export type CartLine = {
  codpro: string;
  slug: string;
  name: string;
  image_url: string | null;
  qty: number;
  unit_ht: number | null;
  unit_ttc: number | null;
  show_price: boolean;
};

export type OrderSummary = {
  id: string;
  demo: boolean;
  total_ht: number | null;
  total_ttc: number | null;
  lines: number;
};
