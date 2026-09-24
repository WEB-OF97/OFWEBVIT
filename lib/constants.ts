export const PAGE_SIZE = 8;

export const CART_STORAGE_KEY = "of-cart";

export function currencyCode(): string {
  return process.env.NEXT_PUBLIC_CURRENCY || "EUR";
}
