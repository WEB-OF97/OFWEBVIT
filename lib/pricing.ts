import type { Product } from "./types";

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function priceTtc(priceHt: number, vatRate: number): number {
  return roundMoney(priceHt * (1 + vatRate / 100));
}

export type EffectivePrice = {
  ht: number | null;
  ttc: number | null;
  promo: boolean;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function effectivePrices(product: Product, on: string = todayIso()): EffectivePrice {
  if (!product.show_price || product.price_ht == null || product.price_ttc == null) {
    return { ht: null, ttc: null, promo: false };
  }

  const promoHt = product.promo_ht;
  const vat = product.vat_rate;
  if (promoHt != null && promoHt > 0 && vat != null) {
    const starts = !product.promo_start || product.promo_start <= on;
    const ends = !product.promo_end || product.promo_end >= on;
    if (starts && ends) {
      return { ht: promoHt, ttc: priceTtc(promoHt, vat), promo: promoHt !== product.price_ht };
    }
  }

  return { ht: product.price_ht, ttc: product.price_ttc, promo: false };
}
