import { currencyCode } from "./constants";

export function formatMoney(amount: number): string {
  const currency = currencyCode();
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatWeight(weight: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(weight);
}
